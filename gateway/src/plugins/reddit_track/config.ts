import fs from "node:fs";
import path from "node:path";

const PLUGIN_KEY = "reddit_track";

/** 每次请求 Reddit API 后的最小间隔（毫秒），避免被封（默认 2 次/分钟） */
const DEFAULT_REQUEST_INTERVAL_MS = 30000;
/** 并发请求 gateway /api/data/for-track 后的处理并发数 */
const DEFAULT_CONCURRENCY = 3;

export interface RedditTrackConfig {
  gatewayUrl: string;
  pluginKey: string;
  /** 每次请求 Reddit 后的最小间隔 ms */
  requestIntervalMs: number;
  /** 并发更新条数 */
  concurrency: number;
}

function loadConfig(): RedditTrackConfig {
  const gatewayUrl = process.env.GATEWAY_URL ?? "http://localhost:3000";
  let requestIntervalMs = DEFAULT_REQUEST_INTERVAL_MS;
  let concurrency = DEFAULT_CONCURRENCY;
  try {
    const configPath = path.resolve(__dirname, "config.json");
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf8");
      const data = JSON.parse(raw) as {
        requestIntervalMs?: number;
        concurrency?: number;
      };
      if (
        typeof data.requestIntervalMs === "number" &&
        data.requestIntervalMs >= 1000
      ) {
        requestIntervalMs = data.requestIntervalMs;
      }
      if (
        typeof data.concurrency === "number" &&
        data.concurrency >= 1 &&
        data.concurrency <= 20
      ) {
        concurrency = data.concurrency;
      }
    }
  } catch {
    // use defaults
  }
  const envInterval = process.env.PLUGIN_REDDIT_TRACK_REQUEST_INTERVAL_MS;
  if (envInterval != null) {
    const n = Number(envInterval);
    if (Number.isInteger(n) && n >= 1000) requestIntervalMs = n;
  }
  const envConcurrency = process.env.PLUGIN_REDDIT_TRACK_CONCURRENCY;
  if (envConcurrency != null) {
    const n = Number(envConcurrency);
    if (Number.isInteger(n) && n >= 1 && n <= 20) concurrency = n;
  }
  return {
    gatewayUrl,
    pluginKey: PLUGIN_KEY,
    requestIntervalMs,
    concurrency
  };
}

export const config = loadConfig();
