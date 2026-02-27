import axios from "axios";
import fs from "node:fs";
import path from "node:path";

interface EnvConfig {
  gatewayUrl: string;
  taskId?: string;
  from?: string;
  to?: string;
}

function readEnv(): EnvConfig {
  const gatewayUrl =
    process.env.GATEWAY_URL || "http://localhost:3000";
  return {
    gatewayUrl,
    taskId: process.env.TASK_ID,
    from: process.env.FROM,
    to: process.env.TO
  };
}

function getLogFilePath(): string {
  const baseDir = path.resolve(__dirname, "..");
  const date = new Date().toISOString().slice(0, 10);
  const logDir = path.join(baseDir, "logs");
  fs.mkdirSync(logDir, { recursive: true });
  return path.join(logDir, `twitter-${date}.log`);
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
    // 如果写日志失败，不影响插件主流程
  }
}

async function main() {
  const env = readEnv();
  writeLog("start", env);

  try {
    // 1. 获取规则
    writeLog("fetch_rules_start");
    const rulesResp = await axios.get(
      `${env.gatewayUrl}/api/rules?plugin=twitter`
    );
    const rules = rulesResp.data.items ?? [];
    writeLog("fetch_rules_done", { count: rules.length });

    // 2. 获取跟踪列表
    writeLog("fetch_tracking_start");
    const trackingResp = await axios.get(
      `${env.gatewayUrl}/api/tracking?plugin=twitter`
    );
    const tracking = trackingResp.data.items ?? [];
    writeLog("fetch_tracking_done", { count: tracking.length });

    // TODO: 3. 抓取远程平台数据 + 本地去重 + 关键字匹配 + /api/validate + /api/data
    writeLog("crawl_and_match_todo");

    writeLog("success");
    process.exit(0);
  } catch (err) {
    writeLog("error", err instanceof Error ? err.message : String(err));
    // eslint-disable-next-line no-console
    console.error("twitter plugin error", err);
    process.exit(1);
  }
}

void main();

