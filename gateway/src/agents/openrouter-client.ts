import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

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

export async function callOpenRouter(
  options: OpenRouterCallOptions,
  scene: LLMScene = "default"
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = getModelForScene(scene);

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const proxyUrl = (process.env.HTTPS_PROXY ?? process.env.PROXY_URL)?.trim();
  const httpsAgent = proxyUrl
    ? new HttpsProxyAgent(proxyUrl)
    : undefined;

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

  const text =
    response.data?.choices?.[0]?.message?.content ??
    "";

  return String(text);
}
