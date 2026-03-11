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
  /** 自定义状态等扩展字段（req0310） */
  params?: Record<string, unknown>;
  /** 跟踪数据 JSON，各数据源结构不同，如 reddit: { ups, num_comments } */
  trackData?: Record<string, unknown>;
  lastTrackAt?: string; // ISO UTC
  trackCount?: number;
  /** 是否被收藏 */
  favorite?: boolean;
  /** 收藏所属列表 id（req0310） */
  favoriteListId?: string | null;
  /** 收藏所属列表名称（req0310） */
  favoriteListName?: string | null;
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
  favoriteOnly?: boolean;
  /** 收藏列表筛选（req0310） */
  favoriteListId?: string;
  readStatus?: "all" | "read" | "unread" | "ignored";
  keyword?: string;
  ruleId?: string;
  /** channel 模糊查询（req0310） */
  channel?: string;
  /** 是否已联络（仅收藏页用，req0310） */
  connected?: boolean;
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
  /** 关联规则 id（req0310） */
  ruleId?: string;
}

export interface ToggleFavoriteRequest {
  id: string;
  favorite: boolean;
  /** 指定收藏列表（优先使用 id，其次 name 自动创建/匹配） */
  listId?: string;
  listName?: string;
}
