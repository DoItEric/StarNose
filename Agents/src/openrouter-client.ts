import axios from "axios";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterCallOptions {
  system: string;
  user: string;
}

export async function callOpenRouter(
  options: OpenRouterCallOptions
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

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
      timeout: 60_000
    }
  );

  const text =
    response.data?.choices?.[0]?.message?.content ??
    "";

  return String(text);
}

