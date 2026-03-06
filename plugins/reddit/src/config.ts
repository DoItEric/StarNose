import fs from "node:fs";
import path from "node:path";

const PLUGIN_KEY = "reddit";
const DEFAULT_LLM_CONCURRENCY = 10;

export interface RedditPluginConfig {
  gatewayUrl: string;
  pluginKey: string;
  llmConcurrency: number;
}

function loadConfig(): RedditPluginConfig {
  const gatewayUrl = process.env.GATEWAY_URL ?? "http://localhost:3000";
  let llmConcurrency = DEFAULT_LLM_CONCURRENCY;
  try {
    const configPath = path.resolve(__dirname, "../config.json");
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf8");
      const data = JSON.parse(raw) as { llmConcurrency?: number };
      if (
        typeof data.llmConcurrency === "number" &&
        data.llmConcurrency > 0 &&
        data.llmConcurrency <= 50
      ) {
        llmConcurrency = data.llmConcurrency;
      }
    }
  } catch {
    // 使用默认并发数
  }
  const envConcurrency = process.env.PLUGIN_REDDIT_LLM_CONCURRENCY;
  if (envConcurrency != null) {
    const n = Number(envConcurrency);
    if (Number.isInteger(n) && n > 0 && n <= 50) llmConcurrency = n;
  }
  return {
    gatewayUrl,
    pluginKey: PLUGIN_KEY,
    llmConcurrency
  };
}

export const config = loadConfig();
