import axios, { type AxiosInstance } from "axios";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { parseKeywordRules, ruleMatches } from "./keywords";

/** 主程序调用时传入，与 starnose-api-model PluginRunOptions 一致 */
export interface PluginRunOptions {
  gatewayUrl: string;
  pluginKey: string;
}

/** 主程序写入 plugin_runs 用，与 starnose-api-model PluginRunResult 一致 */
export interface PluginRunResult {
  success: boolean;
  totalCount?: number;
  matchedCount?: number;
}

interface RuleItem {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  disabled: boolean;
  promptFile?: string;
}

interface RedditPostItem {
  id: string;
  subreddit: string | null;
  title: string | null;
  created_utc: number | null;
  source: string | null;
  content: string | null;
}

interface ValidateBody {
  ruleId: string;
  pluginKey: string;
  content: string;
  ruleDescription?: string;
  withSummary?: boolean;
}

interface ValidateResponse {
  passed: boolean;
  summary?: string;
}

interface DataRecordBody {
  ruleId: string;
  uniqueKey: string;
  source: string;
  title: string;
  content: string;
  url?: string;
  keywords: string[];
  tracking: boolean;
  crawlTime: string;
  publishTime?: string;
  summary?: string;
  read: boolean;
  remark?: string;
  heatScore: number;
  extra?: Record<string, unknown>;
}

function getLogFilePath(): string {
  const baseDir = path.resolve(__dirname, "..");
  const date = new Date().toISOString().slice(0, 10);
  const logDir = path.join(baseDir, "logs");
  fs.mkdirSync(logDir, { recursive: true });
  return path.join(logDir, `reddit-${date}.log`);
}

function writeLog(step: string, detail?: unknown): void {
  try {
    const logPath = getLogFilePath();
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      step,
      detail
    });
    fs.appendFileSync(logPath, line + "\n", "utf8");
  } catch {
    // 写日志失败不影响主流程
  }
}

async function runWithLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      const r = await fn(items[i]);
      results[i] = r;
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

function buildRedditUrl(post: RedditPostItem): string {
  const sub = post.subreddit ?? "reddit";
  return `https://www.reddit.com/r/${sub}/comments/${post.id}`;
}

function publishTimeFromUtc(created_utc: number | null): string | undefined {
  if (created_utc == null) return undefined;
  return new Date(created_utc * 1000).toISOString();
}

/**
 * 插件主逻辑，由主程序（gateway）在同一进程内调用，不再独立起进程。
 */
export async function run(options: PluginRunOptions): Promise<PluginRunResult> {
  const gatewayUrl = options.gatewayUrl;
  const pluginKey = options.pluginKey;
  const llmConcurrency = config.llmConcurrency;
  const client: AxiosInstance = axios.create({
    baseURL: gatewayUrl,
    timeout: 60000
  });
  writeLog("start", { gatewayUrl, pluginKey, llmConcurrency });

  try {
    // 一、获取数据
    writeLog("fetch_rules_start");
    const rulesResp = await client.get<{ items: RuleItem[] }>(
      "/api/rules",
      { params: { plugin: pluginKey } }
    );
    const rules = (rulesResp.data?.items ?? []).filter((r) => !r.disabled);
    writeLog("fetch_rules_done", { count: rules.length });

    writeLog("fetch_posts_start");
    const postsResp = await client.get<{ items: RedditPostItem[] }>(
      "/api/reddit/posts"
    );
    const posts = postsResp.data?.items ?? [];
    writeLog("fetch_posts_done", { count: posts.length });

    if (posts.length === 0) {
      writeLog("success", { reason: "no_posts" });
      return { success: true, totalCount: 0, matchedCount: 0 };
    }

    const toMarkProcessed = new Set<string>();
    const emptyContentIds: string[] = [];
    const noMatchIds: string[] = [];
    const candidateList: { post: RedditPostItem; rule: RuleItem }[] = [];

    const title = (p: RedditPostItem) => p.title ?? "";
    const content = (p: RedditPostItem) => p.content ?? "";

    for (const post of posts) {
      if (content(post).trim() === "") {
        emptyContentIds.push(post.id);
        toMarkProcessed.add(post.id);
        continue;
      }
      const rulePartsList = rules.map((r) => parseKeywordRules(r.keywords ?? []));
      let matched = false;
      for (let i = 0; i < rules.length; i++) {
        if (ruleMatches(rulePartsList[i], title(post), content(post))) {
          candidateList.push({ post, rule: rules[i] });
          matched = true;
          break;
        }
      }
      if (!matched) {
        noMatchIds.push(post.id);
        toMarkProcessed.add(post.id);
      }
    }

    writeLog("keyword_match_done", {
      emptyContent: emptyContentIds.length,
      noMatch: noMatchIds.length,
      toValidate: candidateList.length
    });

    if (candidateList.length === 0) {
      if (toMarkProcessed.size > 0) {
        await client.post("/api/reddit/posts/mark-processed", {
          ids: Array.from(toMarkProcessed)
        });
      }
      writeLog("success", { reason: "no_candidates" });
      return {
        success: true,
        totalCount: posts.length,
        matchedCount: 0
      };
    }

    // 三、LLM 批量匹配
    interface ValidateResult {
      post: RedditPostItem;
      rule: RuleItem;
      passed: boolean;
      summary?: string;
    }
    const validateResults: ValidateResult[] = await runWithLimit(
      candidateList,
      llmConcurrency,
      async ({ post, rule }) => {
        const body: ValidateBody = {
          ruleId: rule.id,
          pluginKey,
          content: `${title(post)}\n\n${content(post)}`,
          ruleDescription: rule.description,
          withSummary: true
        };
        const res = await client.post<ValidateResponse>("/api/validate", body);
        return {
          post,
          rule,
          passed: res.data?.passed ?? false,
          summary: res.data?.summary
        };
      }
    );

    const passedList = validateResults.filter((r) => r.passed);
    writeLog("llm_done", {
      total: validateResults.length,
      passed: passedList.length
    });

    // 四、入库
    for (const { post, rule, summary } of passedList) {
      const record: DataRecordBody = {
        ruleId: rule.id,
        uniqueKey: post.id,
        source: "reddit",
        title: title(post),
        content: content(post),
        url: buildRedditUrl(post),
        keywords: rule.keywords ?? [],
        tracking: false,
        crawlTime: new Date().toISOString(),
        publishTime: publishTimeFromUtc(post.created_utc ?? null),
        summary: summary ?? undefined,
        read: false,
        heatScore: 0,
        extra: {
          subreddit: post.subreddit ?? undefined,
          source: post.source ?? undefined
        }
      };
      await client.post("/api/data", record);
    }

    // 标记所有处理过的帖子为已处理（含空内容、未匹配、以及参与 LLM 的）
    for (const { post } of candidateList) toMarkProcessed.add(post.id);
    if (toMarkProcessed.size > 0) {
      await client.post("/api/reddit/posts/mark-processed", {
        ids: Array.from(toMarkProcessed)
      });
    }

    writeLog("success", {
      markedProcessed: toMarkProcessed.size,
      saved: passedList.length
    });
    return {
      success: true,
      totalCount: posts.length,
      matchedCount: passedList.length
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeLog("error", msg);
    // eslint-disable-next-line no-console
    console.error("reddit plugin error", msg);
    return { success: false, totalCount: 0, matchedCount: 0 };
  }
}

/** 仅在被直接运行（node dist/main.js）时执行，保留路径与入口以便调试 */
function main(): void {
  const opts: PluginRunOptions = {
    gatewayUrl: config.gatewayUrl,
    pluginKey: config.pluginKey
  };
  run(opts)
    .then((r) => process.exit(r.success ? 0 : 1))
    .catch(() => process.exit(1));
}

if (require.main === module) {
  main();
}
