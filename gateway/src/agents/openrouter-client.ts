import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getShanghaiISOString, getShanghaiDateHour } from "../utils/time";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_MODEL = "openai/gpt-4.1-mini";

/** LLM 调用场景，对应 .env 中的 OPENROUTER_MODEL_* 配置项 */
export type LLMScene = "default" | "keywords" | "validate";

function getModelForScene(scene: LLMScene): string {
  const fallback = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  switch (scene) {
    case "keywords":
      return process.env.OPENROUTER_MODEL_KEYWORDS?.trim() || fallback;
    case "validate":
      return process.env.OPENROUTER_MODEL_VALIDATE?.trim() || fallback;
    default:
      return fallback;
  }
}

export interface OpenRouterCallOptions {
  system: string;
  user: string;
}

/** 非流式调用的返回：正文 + 可选的思维链（部分模型如 o1/o3 会返回） */
export interface OpenRouterResult {
  text: string;
  reasoning?: string;
  model: string;
  usage?: unknown;
}

/**
 * 可选：传入则在该 client 内按天写入 LLM 详细日志（便于蒸馏与排查）。
 * logContext 会合并进每条日志；requestExtra 会合并进 request 字段。
 */
export interface OpenRouterLogOptions {
  logDir: string;
  /** 与 kind、ruleId 等一起写入日志；requestExtra 会合并进 request */
  logContext?: Record<string, unknown> & { requestExtra?: Record<string, unknown> };
}

export async function callOpenRouter(
  options: OpenRouterCallOptions,
  scene: LLMScene = "default",
  logOptions?: OpenRouterLogOptions
): Promise<OpenRouterResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = getModelForScene(scene);

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const proxyUrl = (process.env.HTTPS_PROXY ?? process.env.PROXY_URL)?.trim();
  const httpsAgent = proxyUrl
    ? new HttpsProxyAgent(proxyUrl)
    : undefined;

  const startedAt = Date.now();

  try {
    const response = await axios.post(
      OPENROUTER_BASE_URL,
      {
        model,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.user }
        ],
        stream: false
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 60_000,
        ...(httpsAgent && { httpsAgent, proxy: false })
      }
    );

    const data = response.data;
    const message = data?.choices?.[0]?.message;
    const text = message?.content != null ? String(message.content) : "";
    const reasoning =
      message?.reasoning != null && String(message.reasoning).trim() !== ""
        ? String(message.reasoning).trim()
        : undefined;

    const durationMs = Date.now() - startedAt;

    if (logOptions?.logDir) {
      const { logContext = {} } = logOptions;
      const { requestExtra, ...rest } = logContext as { requestExtra?: Record<string, unknown>; [k: string]: unknown };
      const request = {
        systemPrompt: options.system,
        userPrompt: options.user,
        ...(requestExtra ?? {})
      };
      const line = JSON.stringify({
        ts: getShanghaiISOString(),
        scene,
        provider: "openrouter",
        model,
        usage: data?.usage,
        durationMs,
        request,
        response: { text, ...(reasoning != null && { reasoning }) },
        ...rest
      });
      const dateHour = getShanghaiDateHour();
      const logPath = path.join(logOptions.logDir, `llm-${dateHour}.log`);
      fs.mkdirSync(logOptions.logDir, { recursive: true });
      fs.appendFileSync(logPath, line + "\n", "utf8");
    }

    return {
      text,
      ...(reasoning && { reasoning }),
      model,
      usage: data?.usage
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const isAxios = axios.isAxiosError(err);
    const msg =
      (isAxios && (err as { message?: string; code?: string }).message) ||
      (err instanceof Error ? err.message : String(err));
    const code = isAxios ? (err as { code?: string }).code : undefined;

    if (logOptions?.logDir) {
      const { logContext = {} } = logOptions;
      const { requestExtra: _ro, ...rest } = logContext as { requestExtra?: Record<string, unknown>; [k: string]: unknown };
      const kind = (rest.kind as string) ?? "call";
      const line = JSON.stringify({
        ts: getShanghaiISOString(),
        kind: `${kind}_error`,
        scene,
        provider: "openrouter",
        durationMs,
        error: { message: msg, ...(code != null && { code }) },
        ...rest
      });
      const dateHour = getShanghaiDateHour();
      const logPath = path.join(logOptions.logDir, `llm-${dateHour}.log`);
      fs.mkdirSync(logOptions.logDir, { recursive: true });
      fs.appendFileSync(logPath, line + "\n", "utf8");
    }

    throw err;
  }
}
