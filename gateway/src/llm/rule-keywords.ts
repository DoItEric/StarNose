import type {
  CreateRuleRequest,
  GenerateRuleKeywordsResponse
} from "starnose-api-model";
import { callOpenRouter } from "starnose-agents";
import { loadPromptPair, fillTemplate } from "./prompts";

export async function generateRuleKeywords(
  payload: CreateRuleRequest
): Promise<GenerateRuleKeywordsResponse> {
  const pair = loadPromptPair("rule_keywords_zh");
  const user = fillTemplate(pair.userTemplate, {
    description: payload.description
  });

  const text = await callOpenRouter({
    system: pair.system,
    user
  });

  const keywords = text
    .split(/[,\n]/)
    .map((s: string) => s.trim())
    .filter(Boolean);

  return { keywords };
}

