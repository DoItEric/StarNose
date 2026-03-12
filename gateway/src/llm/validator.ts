import type {
  ValidateContentRequest,
  ValidateContentResponse
} from "../api-model";
import axios from "axios";
import { callOpenRouter } from "../agents";
import { loadPromptPair, fillTemplate } from "./prompts";

const JSON_MATCH_RE = /\{[\s\S]*"match"[\s\S]*\}/;

function parseValidateJson(raw: string): {
  match: boolean;
  summary?: string;
  attributes?: Record<string, unknown>;
} {
  const trimmed = raw.trim();
  const jsonStr = trimmed.replace(/^```\w*\n?|```\s*$/g, "").trim();
  const m = jsonStr.match(JSON_MATCH_RE);
  if (!m) return { match: false };
  try {
    const o = JSON.parse(m[0]) as Record<string, unknown>;
    const matched = Boolean(o.match);
    const summary = typeof o.summary === "string" ? o.summary : undefined;
    const { match: _m, ...rest } = o;
    return { match: matched, summary, attributes: Object.keys(rest).length > 0 ? rest : undefined };
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

  const logContext = {
    kind: "validate",
    ruleId: payload.ruleId,
    pluginKey: payload.pluginKey,
    requestExtra: {
      ruleDescription: ruleDesc,
      content: payload.content,
      withSummary: useSummary
    }
  };

  let text: string;
  try {
    const res = await callOpenRouter(
      { system: pair.system, user },
      "validate",
      { logDir, logContext }
    );
    text = res.text;
  } catch (err) {
    const isAxios = axios.isAxiosError(err);
    const msg =
      (isAxios && (err.message || err.code)) ||
      (err instanceof Error ? err.message : String(err));

    return {
      passed: false,
      reason: msg
    };
  }

  if (useSummary) {
    const parsed = parseValidateJson(text);
    return {
      passed: parsed.match,
      summary: parsed.summary,
      attributes: parsed.attributes
    };
  }

  const passed = /yes/i.test(text);
  return { passed };
}

