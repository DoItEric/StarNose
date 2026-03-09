export interface DataRecord {
  id: string; // UUID
  ruleId: string;
  uniqueKey: string; // e.g. URL MD5
  source: string;
  channel?: string;
  title: string;
  content: string;
  url?: string;
  keywords: string[];
  tracking: boolean;
  crawlTime: string; // ISO UTC
  publishTime?: string; // ISO UTC
  summary?: string;
  hotWords?: string;
  read: number; // 0=未阅, 1=已阅, -1=忽略
  remark?: string;
  heatScore: number; // 0-100
  extra?: Record<string, unknown>;
  /** 跟踪数据 JSON，各数据源结构不同，如 reddit: { ups, num_comments } */
  trackData?: Record<string, unknown>;
  lastTrackAt?: string; // ISO UTC
  trackCount?: number;
}

export interface RuleUnreadStat {
  ruleId: string;
  unreadCount: number;
}

export interface ListDataQuery {
  crawlTimeFrom?: string;
  crawlTimeTo?: string;
  publishTimeFrom?: string;
  publishTimeTo?: string;
  sources?: string[];
  trackingOnly?: boolean;
  readStatus?: "all" | "read" | "unread" | "ignored";
  keyword?: string;
  ruleId?: string;
  page?: number;
  pageSize?: number;
  sortBy?:
    | "crawlTimeAsc"
    | "crawlTimeDesc"
    | "publishTimeAsc"
    | "publishTimeDesc";
}

export interface ListDataResponse {
  items: DataRecord[];
  total: number;
  ruleUnreadStats?: RuleUnreadStat[];
}

export interface TrackDataRequest {
  id: string;
  tracking: boolean;
}

export interface MarkDataReadRequest {
  id: string;
  read: boolean | number; // true/1=已阅, false/0=未阅, -1=忽略
}

export interface BlacklistChannelRequest {
  source: string;
  channel: string;
}
