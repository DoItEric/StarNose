import type {
  ValidateContentRequest,
  ValidateContentResponse
} from "starnose-api-model";
import fs from "node:fs";
import path from "node:path";
import { callOpenRouter } from "starnose-agents";
import { loadPromptPair, fillTemplate } from "./prompts";

export async function validateContentWithLLM(
  payload: ValidateContentRequest,
  logDir: string
): Promise<ValidateContentResponse> {
  const pair = loadPromptPair("validate_content_zh");
  const user = fillTemplate(pair.userTemplate, {
    ruleDescription: "",
    content: payload.content
  });

  const text = await callOpenRouter({
    system: pair.system,
    user
  });

  const passed = /yes/i.test(text);

  const date = new Date().toISOString().slice(0, 10);
  const logPath = path.join(logDir, `llm-${date}.log`);
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    kind: "validate",
    ruleId: payload.ruleId,
    pluginKey: payload.pluginKey,
    result: text
  });
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(logPath, line + "\n", "utf8");

  return { passed };
}

