import axios, { type AxiosInstance } from "axios";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { getShanghaiISOString, getShanghaiDateHour } from "../../utils/time";

/** 主程序调用时传入 */
export interface PluginRunOptions {
  gatewayUrl: string;
  pluginKey: string;
}

export interface PluginRunResult {
  success: boolean;
  totalCount?: number;
  matchedCount?: number;
}

interface ForTrackItem {
  id: string;
  uniqueKey: string;
  source: string;
  channel: string | null;
}

/** Reddit API 返回的帖子数据结构（api/info.json 中 children[].data） */
interface RedditPostData {
  id?: string;
  ups?: number;
  num_comments?: number;
}

function generateRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

let currentRunId: string | null = null;

function getLogFilePath(): string {
  const baseDir = path.resolve(__dirname, "..");
  const dateHour = getShanghaiDateHour();
  const logDir = path.join(baseDir, "logs");
  fs.mkdirSync(logDir, { recursive: true });
  return path.join(logDir, `reddit_track-${dateHour}.log`);
}

function writeLog(step: string, detail?: unknown): void {
  try {
    const line = JSON.stringify({
      ts: getShanghaiISOString(),
      runId: currentRunId,
      step,
      detail
    });
    fs.appendFileSync(getLogFilePath(), line + "\n", "utf8");
  } catch {
    // ignore
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

/**
 * 从 Reddit 公开 API 批量获取帖子 ups、num_comments
 * 使用 User-Agent 避免 429
 * postIds: Reddit 帖子 id 数组（不带 t3_ 前缀）
 * 返回 Map<postId, { ups, num_comments }>
 */
async function fetchRedditPostsInfo(
  postIds: string[],
  requestIntervalMs: number
): Promise<Map<string, { ups: number; num_comments: number }>> {
  const result = new Map<string, { ups: number; num_comments: number }>();
  if (postIds.length === 0) return result;

  const fullnames = postIds.map((id) => `t3_${id}`).join(",");
  const url = `https://www.reddit.com/api/info.json?id=${fullnames}`;
  try {
    const resp = await axios.get<{
      data?: { children?: Array<{ data?: RedditPostData }> };
    }>(url, {
      timeout: 15000,
      headers: {
        "User-Agent":
          "StarNoseRedditTrack/1.0 (by /u/StarNose; contact for data)"
      }
    });
    const children = resp.data?.data?.children;
    if (!Array.isArray(children) || children.length === 0) {
      return result;
    }
    for (const child of children) {
      const data = child?.data;
      const id = data?.id;
      if (!id) continue;
      result.set(id, {
        ups: typeof data.ups === "number" ? data.ups : 0,
        num_comments:
          typeof data.num_comments === "number" ? data.num_comments : 0
      });
    }
    return result;
  } catch (err) {
    writeLog("reddit_api_error", {
      postIds,
      message: axios.isAxiosError(err) ? err.message : String(err)
    });
    return result;
  } finally {
    // 频率控制：两次请求之间至少间隔 requestIntervalMs 毫秒
    await sleep(requestIntervalMs);
  }
}

export async function run(
  options: PluginRunOptions
): Promise<PluginRunResult> {
  currentRunId = generateRunId();
  const gatewayUrl = options.gatewayUrl ?? config.gatewayUrl;
  const client: AxiosInstance = axios.create({
    baseURL: gatewayUrl,
    timeout: 60000
  });

  const { requestIntervalMs, concurrency } = config;
  writeLog("start", { gatewayUrl, requestIntervalMs, concurrency });

  try {
    const listResp = await client.get<{ items: ForTrackItem[] }>(
      "/api/data/for-track",
      { params: { source: "reddit" } }
    );
    const items = listResp.data?.items ?? [];
    writeLog("for_track_done", { count: items.length });

    if (items.length === 0) {
      writeLog("success", { reason: "no_items" });
      return { success: true, totalCount: 0, matchedCount: 0 };
    }

    let updatedCount = 0;

    // Reddit API 支持一次最多 100 个 id，按 100 条一组批量请求
    const BATCH_SIZE = 100;
    for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
      const batch = items.slice(offset, offset + BATCH_SIZE);
      const ids = batch.map((it) => it.uniqueKey);

      // 单次调用 reddit 接口，按 id 映射结果
      const infoMap = await fetchRedditPostsInfo(ids, requestIntervalMs);

      // 并发调用 gateway patch 接口写回 track_data，次数受 concurrency 控制
      await runWithLimit(batch, concurrency, async (item) => {
        const info = infoMap.get(item.uniqueKey);
        if (!info) return;
        try {
          await client.patch(`/api/data/${item.id}/track-update`, {
            trackData: { ups: info.ups, num_comments: info.num_comments }
          });
          updatedCount++;
        } catch (err) {
          writeLog("track_update_error", {
            id: item.id,
            error: axios.isAxiosError(err) ? err.message : String(err)
          });
        }
      });
    }

    writeLog("success", { totalCount: items.length, updatedCount });
    return {
      success: true,
      totalCount: items.length,
      matchedCount: updatedCount
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeLog("error", msg);
    // eslint-disable-next-line no-console
    console.error("reddit_track plugin error", msg);
    return { success: false, totalCount: 0, matchedCount: 0 };
  } finally {
    currentRunId = null;
  }
}
