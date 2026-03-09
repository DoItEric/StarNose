import type {
  CreateRuleRequest,
  GenerateRuleKeywordsResponse,
  SupplementRuleKeywordsRequest
} from "../api-model";
import { callOpenRouter } from "../agents";
import { loadPromptPair, fillTemplate } from "./prompts";

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

  const res = await callOpenRouter(
    { system: pair.system, user },
    "keywords",
    {
      logDir,
      logContext: {
        kind: "keywords_generate",
        requestExtra: { description: desc }
      }
    }
  );
  const text = res.text;

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

  const res = await callOpenRouter(
    { system: pair.system, user },
    "keywords",
    {
      logDir,
      logContext: {
        kind: "keywords_supplement",
        requestExtra: { description: desc, keywords: payload.keywords }
      }
    }
  );
  const text = res.text;

  const keywords = text
    .split(/[,\n]/)
    .map((s: string) => s.trim())
    .filter(Boolean);

  return { keywords };
}

