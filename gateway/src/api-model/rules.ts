export interface Rule {
  id: string; // UUID
  name: string;
  /** 关键字需求描述，用于生成/补充关键词 */
  keywordDescription?: string;
  /** 信息偏好描述，用于 LLM 匹配 */
  description: string;
  keywords: string[];
  /** 负面关键字：命中则忽略该条数据（仅手工配置，不参与生成） */
  negativeKeywords?: string[];
  disabled: boolean;
  /** 规则生效的插件，存储格式为 ,key1,key2, 便于 LIKE 匹配 */
  plugins?: string;
  lastRunAt?: string; // ISO UTC
  remark?: string;
  extra?: Record<string, unknown>;
  /** LLM 筛选时使用的提示词文件名（不含扩展名），位于 prompts 目录 */
  promptFile?: string;
  /** 内容最大长度（字符数），超过则忽略，不进行 LLM 匹配；未配置则不限制 */
  contentLength?: number;
}

export interface CreateRuleRequest {
  name: string;
  /** 关键字需求描述，用于生成关键词 */
  keywordDescription?: string;
  description?: string;
}

export interface SupplementRuleKeywordsRequest {
  /** 关键字需求描述 */
  keywordDescription?: string;
  description?: string;
  keywords: string[];
}

export interface GenerateRuleKeywordsResponse {
  keywords: string[];
}

export interface SaveRuleRequest {
  id?: string;
  name: string;
  /** 关键字需求描述 */
  keywordDescription?: string;
  /** 信息偏好描述，用于 LLM 匹配 */
  description: string;
  keywords: string[];
  /** 负面关键字：命中则忽略该条数据 */
  negativeKeywords?: string[];
  /** 规则生效的插件，格式 ,key1,key2, */
  plugins?: string;
  disabled?: boolean;
  /** 筛选对应的 prompt 文件名（不含扩展名） */
  promptFile?: string;
  /** 内容最大长度（字符数），超过则忽略；未配置则不限制 */
  contentLength?: number;
}

export interface ListRulesQuery {
  plugin?: string;
}

export interface RuleForPlugin extends Rule {
  plugin?: string;
}
