export interface SchedulerStatus {
  registeredPlugins: number;
  queueLength: number;
  recentErrorCount24h: number;
}

export interface ValidateContentRequest {
  ruleId: string;
  pluginKey: string;
  content: string;
}

export interface ValidateContentResponse {
  passed: boolean;
  reason?: string;
}
