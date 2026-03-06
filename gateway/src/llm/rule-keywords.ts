import type {
  CreateRuleRequest,
  GenerateRuleKeywordsResponse,
  SupplementRuleKeywordsRequest
} from "../api-model";
import fs from "node:fs";
import path from "node:path";
import { callOpenRouter } from "../agents";
import { loadPromptPair, fillTemplate } from "./prompts";

function writeKeywordsLog(
  logDir: string,
  kind: "keywords_generate" | "keywords_supplement",
  request: { description: string; keywords?: string[] },
  result: string
): void {
  const date = new Date().toISOString().slice(0, 10);
  const logPath = path.join(logDir, `llm-${date}.log`);
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    kind,
    request,
    result
  });
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(logPath, line + "\n", "utf8");
}

export async function generateRuleKeywords(
  payload: CreateRuleRequest,
  logDir: string
): Promise<GenerateRuleKeywordsResponse> {
  const desc =
    payload.keywordDescription ?? payload.description ?? "";
  const pair = loadPromptPair("rule_keywords_zh");
  const user = fillTemplate(pair.userTemplate, {
    description: desc
  });

  const text = await callOpenRouter(
    { system: pair.system, user },
    "keywords"
  );

  writeKeywordsLog(
    logDir,
    "keywords_generate",
    { description: desc },
    text
  );

  const keywords = text
    .split(/[,\n]/)
    .map((s: string) => s.trim())
    .filter(Boolean);

  return { keywords };
}

export async function supplementRuleKeywords(
  payload: SupplementRuleKeywordsRequest,
  logDir: string
): Promise<GenerateRuleKeywordsResponse> {
  const desc =
    payload.keywordDescription ?? payload.description ?? "";
  const pair = loadPromptPair("rule_keywords_supplement_zh");
  const user = fillTemplate(pair.userTemplate, {
    description: desc,
    keywords: payload.keywords.join("，")
  });

  const text = await callOpenRouter(
    { system: pair.system, user },
    "keywords"
  );

  writeKeywordsLog(
    logDir,
    "keywords_supplement",
    { description: desc, keywords: payload.keywords },
    text
  );

  const keywords = text
    .split(/[,\n]/)
    .map((s: string) => s.trim())
    .filter(Boolean);

  return { keywords };
}

