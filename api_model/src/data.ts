export interface DataRecord {
  id: string; // UUID
  ruleId: string;
  uniqueKey: string; // e.g. URL MD5
  source: string;
  title: string;
  content: string;
  url?: string;
  keywords: string[];
  tracking: boolean;
  crawlTime: string; // ISO UTC
  publishTime?: string; // ISO UTC
  summary?: string;
  read: boolean;
  remark?: string;
  heatScore: number; // 0-100
  extra?: Record<string, unknown>;
}

export interface ListDataQuery {
  crawlTimeFrom?: string;
  crawlTimeTo?: string;
  publishTimeFrom?: string;
  publishTimeTo?: string;
  sources?: string[];
  readStatus?: "all" | "read" | "unread";
  keyword?: string;
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
}

export interface TrackDataRequest {
  id: string;
  tracking: boolean;
}
