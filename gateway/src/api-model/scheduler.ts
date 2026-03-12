export interface SchedulerStatus {
  registeredPlugins: number;
  queueLength: number;
  recentErrorCount24h: number;
}

export interface ValidateContentRequest {
  ruleId: string;
  pluginKey: string;
  content: string;
  /** 用户关心的规则描述，用于填充 prompt 占位符 */
  ruleDescription?: string;
  /** 为 true 时 LLM 返回 JSON { match, summary }，响应中带回 summary */
  withSummary?: boolean;
}

export interface ValidateContentResponse {
  passed: boolean;
  reason?: string;
  /** 匹配时从 LLM 返回的 300 字以内摘要（withSummary 为 true 时有效） */
  summary?: string;
  /** LLM 输出的完整属性（industry, persona, phase, scene, issue, summary, hotword 等） */
  attributes?: Record<string, unknown>;
}
