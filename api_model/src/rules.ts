export interface Rule {
  id: string; // UUID
  name: string;
  description: string;
  keywords: string[];
  disabled: boolean;
  lastRunAt?: string; // ISO UTC
  remark?: string;
  extra?: Record<string, unknown>;
  /** LLM 筛选时使用的提示词文件名（不含扩展名），位于 prompts 目录 */
  promptFile?: string;
}

export interface CreateRuleRequest {
  name: string;
  description: string;
}

export interface GenerateRuleKeywordsResponse {
  keywords: string[];
}

export interface SaveRuleRequest {
  id?: string;
  name: string;
  description: string;
  keywords: string[];
  disabled?: boolean;
}

export interface ListRulesQuery {
  plugin?: string;
}

export interface RuleForPlugin extends Rule {
  plugin?: string;
}
