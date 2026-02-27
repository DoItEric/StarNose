export interface Rule {
  id: string; // UUID
  name: string;
  description: string;
  keywords: string[];
  disabled: boolean;
  lastRunAt?: string; // ISO UTC
  remark?: string;
  extra?: Record<string, unknown>;
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
