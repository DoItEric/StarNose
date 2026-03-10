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
  negativeKeywords?: string[];
  disabled: boolean;
  promptFile?: string;
  contentLength?: number;
  contentMinLength?: number;
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
  hotword?: string;
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
  hotWords?: string;
  read: boolean;
  remark?: string;
  heatScore: number;
  extra?: Record<string, unknown>;
}

/** 当前时间 ISO 字符串（上海时区 Asia/Shanghai） */
function getShanghaiISOString(): string {
  const s = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" });
  return s.replace(" ", "T") + "+08:00";
}

async function fetchSubredditBlacklist(
  client: AxiosInstance
): Promise<Set<string>> {
  try {
    const resp = await client.get<{ items?: { name: string }[] }>(
      "/api/reddit/subreddit-blacklist"
    );
    const list = resp.data?.items ?? [];
    const set = new Set<string>();
    for (const row of list) {
      if (row?.name) {
        set.add(row.name.toLowerCase());
      }
    }
    writeLog("fetch_subreddit_blacklist_done", { count: set.size });
    return set;
  } catch (err) {
    writeLog("fetch_subreddit_blacklist_error", axiosErrorToDetail(err));
    return new Set();
  }
}

async function fetchSubredditFilters(
  client: AxiosInstance
): Promise<{
  blacklistByRuleId: Record<string, Set<string>>;
  whitelistByRuleId: Record<string, Set<string>>;
  globalBlacklist: Set<string>;
}> {
  try {
    const resp = await client.get<{
      items?: { ruleId: string; blacklist?: string[]; whitelist?: string[] }[];
      globalBlacklist?: string[];
    }>("/api/reddit/subreddit-filters");
    const items = resp.data?.items ?? [];
    const blacklistByRuleId: Record<string, Set<string>> = {};
    const whitelistByRuleId: Record<string, Set<string>> = {};
    for (const row of items) {
      if (!row?.ruleId) continue;
      blacklistByRuleId[row.ruleId] = new Set(
        (row.blacklist ?? []).map((s) => String(s).toLowerCase())
      );
      whitelistByRuleId[row.ruleId] = new Set(
        (row.whitelist ?? []).map((s) => String(s).toLowerCase())
      );
    }
    const globalBlacklist = new Set(
      (resp.data?.globalBlacklist ?? []).map((s) => String(s).toLowerCase())
    );
    writeLog("fetch_subreddit_filters_done", {
      rules: items.length,
      globalBlacklist: globalBlacklist.size
    });
    return { blacklistByRuleId, whitelistByRuleId, globalBlacklist };
  } catch (err) {
    writeLog("fetch_subreddit_filters_error", axiosErrorToDetail(err));
    return {
      blacklistByRuleId: {},
      whitelistByRuleId: {},
      globalBlacklist: new Set()
    };
  }
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
      ts: getShanghaiISOString(),
      step,
      detail
    });
    fs.appendFileSync(logPath, line + "\n", "utf8");
  } catch {
    // 写日志失败不影响主流程
  }
}

function axiosErrorToDetail(err: unknown): Record<string, unknown> {
  if (!axios.isAxiosError(err)) {
    return {
      kind: "unknown",
      message: err instanceof Error ? err.message : String(err)
    };
  }
  return {
    kind: "axios",
    message: err.message,
    code: err.code,
    url: err.config?.url,
    method: err.config?.method,
    baseURL: err.config?.baseURL,
    timeout: err.config?.timeout,
    status: err.response?.status,
    response: err.response?.data
  };
}

function matchedKeywords(
  keywordRules: string[],
  title: string,
  content: string
): string[] {
  const partsList = parseKeywordRules(keywordRules ?? []);
  const text = `${title ?? ""}\n${content ?? ""}`.toLowerCase();
  const out: string[] = [];
  for (let i = 0; i < partsList.length; i++) {
    const parts = partsList[i];
    if (!parts || parts.length === 0) continue;
    const allFound = parts.every((p) => text.includes(p.toLowerCase()));
    if (allFound) out.push(keywordRules[i]);
  }
  return out;
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
 * 插件主逻辑，由主程序（gateway）在同一进程内调用。
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
    const allPosts = postsResp.data?.items ?? [];
    const posts = allPosts.slice(0, 200);
    writeLog("fetch_posts_done", {
      count: allPosts.length,
      limitedCount: posts.length
    });

    if (posts.length === 0) {
      writeLog("success", { reason: "no_posts" });
      return { success: true, totalCount: 0, matchedCount: 0 };
    }

    const toMarkProcessed = new Set<string>();
    const emptyContentIds: string[] = [];
    const noMatchIds: string[] = [];
    const candidateList: {
      post: RedditPostItem;
      rule: RuleItem;
      matchedKeywords: string[];
    }[] = [];

    // 加载 subreddit 黑/白名单（按 rule 维度），兼容旧版全局黑名单接口
    const legacyGlobalBlacklist = await fetchSubredditBlacklist(client);
    const { blacklistByRuleId, whitelistByRuleId, globalBlacklist } =
      await fetchSubredditFilters(client);
    for (const v of legacyGlobalBlacklist) globalBlacklist.add(v);

    const title = (p: RedditPostItem) => p.title ?? "";
    const content = (p: RedditPostItem) => p.content ?? "";

    const rulePartsList = rules.map((r) => parseKeywordRules(r.keywords ?? []));
    const negativeRulePartsList = rules.map((r) =>
      parseKeywordRules(r.negativeKeywords ?? [])
    );
    for (const post of posts) {
      const subLower = (post.subreddit ?? "").toLowerCase();
      if (content(post).trim() === "") {
        emptyContentIds.push(post.id);
        toMarkProcessed.add(post.id);
        continue;
      }
      let matched = false;
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        // 白名单优先：规则配置了白名单则仅放行白名单；否则用规则黑名单 + 全局黑名单过滤
        if (subLower) {
          const wl = whitelistByRuleId[rule.id];
          if (wl && wl.size > 0) {
            if (!wl.has(subLower)) continue;
          } else {
            const bl = blacklistByRuleId[rule.id];
            if ((bl && bl.has(subLower)) || globalBlacklist.has(subLower)) {
              continue;
            }
          }
        }
        if (ruleMatches(rulePartsList[i], title(post), content(post))) {
          // 正面命中后再做负面匹配：若负面命中，则视为该规则不匹配，继续尝试下一条规则
          if (
            (rule.negativeKeywords?.length ?? 0) > 0 &&
            ruleMatches(
              negativeRulePartsList[i],
              title(post),
              content(post)
            )
          ) {
            continue;
          }
          candidateList.push({
            post,
            rule,
            matchedKeywords: matchedKeywords(rule.keywords ?? [], title(post), content(post))
          });
          matched = true;
          break;
        }
      }
      if (!matched) {
        noMatchIds.push(post.id);
        toMarkProcessed.add(post.id);
      }
    }

    // 内容长度过滤：规则配置了 contentMinLength/contentLength 时，不满足则忽略（不进入 LLM），仅标记已处理
    const contentLengthExceededIds: string[] = [];
    const contentLengthTooShortIds: string[] = [];
    const filteredCandidateList: typeof candidateList = [];
    for (const item of candidateList) {
      const len = (title(item.post) + "\n" + content(item.post)).length;
      const minLen = item.rule.contentMinLength;
      const maxLen = item.rule.contentLength;
      if (minLen != null && minLen > 0 && len < minLen) {
        contentLengthTooShortIds.push(item.post.id);
        toMarkProcessed.add(item.post.id);
      } else if (maxLen != null && maxLen > 0 && len > maxLen) {
        contentLengthExceededIds.push(item.post.id);
        toMarkProcessed.add(item.post.id);
      } else {
        filteredCandidateList.push(item);
      }
    }
    const finalCandidateList = filteredCandidateList;

    writeLog("keyword_match_done", {
      emptyContent: emptyContentIds.length,
      noMatch: noMatchIds.length,
      contentLengthTooShort: contentLengthTooShortIds.length,
      contentLengthExceeded: contentLengthExceededIds.length,
      toValidate: finalCandidateList.length
    });

    if (finalCandidateList.length === 0) {
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

    interface ValidateResult {
      post: RedditPostItem;
      rule: RuleItem;
      matchedKeywords: string[];
      passed: boolean;
      summary?: string;
      hotword?: string;
    }

    const noLlmList: ValidateResult[] = [];
    const toValidateList: typeof finalCandidateList = [];
    for (const item of finalCandidateList) {
      const desc = (item.rule.description ?? "").trim();
      if (desc === "") {
        noLlmList.push({
          post: item.post,
          rule: item.rule,
          matchedKeywords: item.matchedKeywords,
          passed: true
        });
      } else {
        toValidateList.push(item);
      }
    }

    const validateResultsFromLlm: ValidateResult[] =
      toValidateList.length === 0
        ? []
        : await runWithLimit(
            toValidateList,
            llmConcurrency,
            async ({ post, rule, matchedKeywords: mk }) => {
              const body: ValidateBody = {
                ruleId: rule.id,
                pluginKey,
                content: `${title(post)}\n\n${content(post)}`,
                ruleDescription: rule.description,
                withSummary: true
              };
              try {
                const res = await client.post<ValidateResponse>("/api/validate", body);
                return {
                  post,
                  rule,
                  matchedKeywords: mk,
                  passed: res.data?.passed ?? false,
                  summary: res.data?.summary,
                  hotword: res.data?.hotword
                };
              } catch (err) {
                // 某条校验请求失败时只记录日志并视为未通过，避免中断整个任务
                writeLog("validate_error", {
                  ruleId: rule.id,
                  postId: post.id,
                  error: axiosErrorToDetail(err)
                });
                return {
                  post,
                  rule,
                  matchedKeywords: mk,
                  passed: false
                };
              }
            }
          );

    const validateResults: ValidateResult[] = [...noLlmList, ...validateResultsFromLlm];

    const passedList = validateResults.filter((r) => r.passed);
    const failedList = validateResults.filter((r) => !r.passed);
    writeLog("llm_done", {
      total: validateResults.length,
      passed: passedList.length,
      failed: failedList.length
    });

    let savedCount = 0;
    let saveFailedCount = 0;
    writeLog("save_data_start", { toSave: passedList.length });
    for (const { post, rule, summary, hotword, matchedKeywords: mk } of passedList) {
      const record: DataRecordBody = {
        ruleId: rule.id,
        uniqueKey: post.id,
        source: "reddit",
        // 将 subreddit 写入通用 channel 字段
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(post.subreddit ? ({ channel: post.subreddit } as any) : {}),
        title: title(post),
        content: content(post),
        url: buildRedditUrl(post),
        keywords: mk,
        tracking: false,
        crawlTime: new Date().toISOString(),
        publishTime: publishTimeFromUtc(post.created_utc ?? null),
        summary: summary ?? undefined,
        hotWords: hotword ?? undefined,
        read: false,
        heatScore: 0,
        extra: {
          subreddit: post.subreddit ?? undefined,
          source: post.source ?? undefined
        }
      };
      try {
        await client.post("/api/data", record);
        savedCount++;
      } catch (err) {
        saveFailedCount++;
        writeLog("save_data_error", {
          uniqueKey: record.uniqueKey,
          ruleId: record.ruleId,
          error: axiosErrorToDetail(err)
        });
      }
    }
    writeLog("save_data_done", {
      saved: savedCount,
      failed: saveFailedCount
    });

    // 对于关键词命中但 LLM 未通过的数据，写入 data_items_abandon 表
    let abandonSavedCount = 0;
    let abandonSaveFailedCount = 0;
    writeLog("save_abandon_data_start", { toSave: failedList.length });
    for (const { post, rule, summary, hotword, matchedKeywords: mk } of failedList) {
      const record: DataRecordBody = {
        ruleId: rule.id,
        uniqueKey: post.id,
        source: "reddit",
        // 将 subreddit 写入通用 channel 字段
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(post.subreddit ? ({ channel: post.subreddit } as any) : {}),
        title: title(post),
        content: content(post),
        url: buildRedditUrl(post),
        keywords: mk,
        tracking: false,
        crawlTime: new Date().toISOString(),
        publishTime: publishTimeFromUtc(post.created_utc ?? null),
        summary: summary ?? undefined,
        hotWords: hotword ?? undefined,
        read: false,
        heatScore: 0,
        extra: {
          subreddit: post.subreddit ?? undefined,
          source: post.source ?? undefined
        }
      };
      try {
        await client.post("/api/data/abandon", record);
        abandonSavedCount++;
      } catch (err) {
        abandonSaveFailedCount++;
        writeLog("save_abandon_data_error", {
          uniqueKey: record.uniqueKey,
          ruleId: record.ruleId,
          error: axiosErrorToDetail(err)
        });
      }
    }
    writeLog("save_abandon_data_done", {
      saved: abandonSavedCount,
      failed: abandonSaveFailedCount
    });

    for (const { post } of finalCandidateList) toMarkProcessed.add(post.id);
    if (toMarkProcessed.size > 0) {
      try {
        await client.post("/api/reddit/posts/mark-processed", {
          ids: Array.from(toMarkProcessed)
        });
      } catch (err) {
        writeLog("mark_processed_error", {
          count: toMarkProcessed.size,
          error: axiosErrorToDetail(err)
        });
      }
    }

    writeLog("success", {
      markedProcessed: toMarkProcessed.size,
      passed: passedList.length,
      saved: savedCount,
      saveFailed: saveFailedCount
    });
    return {
      success: saveFailedCount === 0 && abandonSaveFailedCount === 0,
      totalCount: posts.length,
      matchedCount: savedCount
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeLog("error", msg);
    // eslint-disable-next-line no-console
    console.error("reddit plugin error", msg);
    return { success: false, totalCount: 0, matchedCount: 0 };
  }
}
