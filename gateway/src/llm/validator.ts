import type {
  ValidateContentRequest,
  ValidateContentResponse
} from "starnose-api-model";
import fs from "node:fs";
import path from "node:path";
import { callOpenRouter } from "starnose-agents";
import { loadPromptPair, fillTemplate } from "./prompts";

const JSON_MATCH_RE = /\{[\s\S]*"match"[\s\S]*\}/;

function parseValidateJson(raw: string): { match: boolean; summary?: string } {
  const trimmed = raw.trim();
  const jsonStr = trimmed.replace(/^```\w*\n?|```\s*$/g, "").trim();
  const m = jsonStr.match(JSON_MATCH_RE);
  if (!m) return { match: false };
  try {
    const o = JSON.parse(m[0]) as { match?: boolean; summary?: string };
    return {
      match: Boolean(o.match),
      summary: typeof o.summary === "string" ? o.summary : undefined
    };
  } catch {
    return { match: false };
  }
}

export async function validateContentWithLLM(
  payload: ValidateContentRequest,
  logDir: string
): Promise<ValidateContentResponse> {
  const useSummary =
    payload.withSummary === true &&
    typeof payload.ruleDescription === "string" &&
    payload.ruleDescription.length > 0;

  const promptName = useSummary
    ? "validate_content_with_summary_zh"
    : "validate_content_zh";
  const pair = loadPromptPair(promptName);
  const ruleDesc = payload.ruleDescription ?? "";
  const user = fillTemplate(pair.userTemplate, {
    ruleDescription: ruleDesc,
    content: payload.content
  });

  const text = await callOpenRouter({
    system: pair.system,
    user
  });

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

  if (useSummary) {
    const parsed = parseValidateJson(text);
    return {
      passed: parsed.match,
      summary: parsed.summary
    };
  }

  const passed = /yes/i.test(text);
  return { passed };
}

