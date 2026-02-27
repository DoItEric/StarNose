export interface PluginMeta {
  name: string;
  key: string; // e.g. "twitter"
  type: "datasource";
  version: string;
  description?: string;
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
