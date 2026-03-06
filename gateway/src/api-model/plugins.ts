export interface PluginMeta {
  name: string;
  key: string; // e.g. "twitter"
  type: "datasource";
  version: string;
  description?: string;
}

/** 主程序调用插件时传入的参数（插件作为主程序一部分运行） */
export interface PluginRunOptions {
  gatewayUrl: string;
  pluginKey: string;
}

/** 插件 run() 返回结果，供主程序写入 plugin_runs */
export interface PluginRunResult {
  success: boolean;
  totalCount?: number;
  matchedCount?: number;
}

export interface PluginScheduleConfig {
  pluginKey: string;
  cron: string;
}

export interface PluginHistoryItem {
  id: string;
  pluginKey: string;
  startedAt: string;
  finishedAt?: string;
  success: boolean;
  totalCount: number;
  matchedCount: number;
}

export interface ListPluginHistoryQuery {
  pluginKey: string;
  limit?: number;
}

export interface TrackingItem {
  uniqueKey: string;
  source: string;
}

export interface ListTrackingResponse {
  items: TrackingItem[];
}
