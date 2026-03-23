import type { ListDataQuery } from "../api-model";

export type DataListBaseTable = "data_items" | "data_items_abandon";

export type DataListReadFilterMode = "fromQuery" | "forceUnread" | "omit";

function toBoolean(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
  }
  return undefined;
}

/**
 * 与列表查询 / 批量已读共用的 WHERE 条件（主表 data_items 或 data_items_abandon）。
 * attributesKeyword：在 attributes 任意 **键名** 上做 ILIKE 模糊匹配。
 */
export function buildDataListConditions(
  query: ListDataQuery & Record<string, unknown>,
  baseTable: DataListBaseTable,
  readFilterMode: DataListReadFilterMode
): {
  conditions: string[];
  params: unknown[];
  conditionsForStats: string[];
  paramsForStats: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const conditionsForStats: string[] = [];
  const paramsForStats: unknown[] = [];
  const idRef = `${baseTable}.id`;

  if (query.crawlTimeFrom) {
    params.push(query.crawlTimeFrom);
    conditions.push(`crawl_time >= $${params.length}`);
    paramsForStats.push(query.crawlTimeFrom);
    conditionsForStats.push(`crawl_time >= $${paramsForStats.length}`);
  }
  if (query.crawlTimeTo) {
    params.push(query.crawlTimeTo);
    conditions.push(`crawl_time <= $${params.length}`);
    paramsForStats.push(query.crawlTimeTo);
    conditionsForStats.push(`crawl_time <= $${paramsForStats.length}`);
  }
  if (query.publishTimeFrom) {
    params.push(query.publishTimeFrom);
    conditions.push(`publish_time >= $${params.length}`);
    paramsForStats.push(query.publishTimeFrom);
    conditionsForStats.push(`publish_time >= $${paramsForStats.length}`);
  }
  if (query.publishTimeTo) {
    params.push(query.publishTimeTo);
    conditions.push(`publish_time <= $${params.length}`);
    paramsForStats.push(query.publishTimeTo);
    conditionsForStats.push(`publish_time <= $${paramsForStats.length}`);
  }
  if (query.channel && String(query.channel).trim() !== "") {
    const ch = `%${String(query.channel).trim()}%`;
    params.push(ch);
    conditions.push(`channel ILIKE $${params.length}`);
    paramsForStats.push(ch);
    conditionsForStats.push(`channel ILIKE $${paramsForStats.length}`);
  }
  if (query.sources && query.sources.length > 0) {
    params.push(query.sources);
    conditions.push(`source = ANY($${params.length}::text[])`);
    paramsForStats.push(query.sources);
    conditionsForStats.push(`source = ANY($${paramsForStats.length}::text[])`);
  }

  const trackingOnly = toBoolean((query as any).trackingOnly);
  if (trackingOnly) {
    conditions.push(
      `EXISTS (SELECT 1 FROM tracking_items ti WHERE ti.data_id = ${idRef})`
    );
    conditionsForStats.push(
      `EXISTS (SELECT 1 FROM tracking_items ti WHERE ti.data_id = ${idRef})`
    );
  }

  const favoriteOnly = toBoolean((query as any).favoriteOnly);
  const favoriteListId =
    typeof (query as any).favoriteListId === "string"
      ? String((query as any).favoriteListId).trim()
      : "";
  if (favoriteOnly) {
    if (favoriteListId) {
      params.push(favoriteListId);
      conditions.push(
        `EXISTS (SELECT 1 FROM favorite_items fi WHERE fi.data_id = ${idRef} AND fi.list_id = $${params.length}::uuid)`
      );
      paramsForStats.push(favoriteListId);
      conditionsForStats.push(
        `EXISTS (SELECT 1 FROM favorite_items fi WHERE fi.data_id = ${idRef} AND fi.list_id = $${paramsForStats.length}::uuid)`
      );
    } else {
      conditions.push(
        `EXISTS (SELECT 1 FROM favorite_items fi WHERE fi.data_id = ${idRef})`
      );
      conditionsForStats.push(
        `EXISTS (SELECT 1 FROM favorite_items fi WHERE fi.data_id = ${idRef})`
      );
    }
  }

  const connected =
    (query as any).connected === true || (query as any).connected === "true"
      ? true
      : (query as any).connected === false || (query as any).connected === "false"
        ? false
        : undefined;
  if (connected != null) {
    if (connected) {
      conditions.push(`COALESCE((params->>'connected')::boolean, false) = true`);
      conditionsForStats.push(
        `COALESCE((params->>'connected')::boolean, false) = true`
      );
    } else {
      conditions.push(`COALESCE((params->>'connected')::boolean, false) = false`);
      conditionsForStats.push(
        `COALESCE((params->>'connected')::boolean, false) = false`
      );
    }
  }

  if (readFilterMode === "forceUnread") {
    params.push(0);
    conditions.push(`read = $${params.length}`);
    paramsForStats.push(0);
    conditionsForStats.push(`read = $${paramsForStats.length}`);
  } else if (readFilterMode === "fromQuery" && query.readStatus && query.readStatus !== "all") {
    if (query.readStatus === "read") {
      params.push(1);
      conditions.push(`read = $${params.length}`);
      paramsForStats.push(1);
      conditionsForStats.push(`read = $${paramsForStats.length}`);
    } else if (query.readStatus === "unread") {
      params.push(0);
      conditions.push(`read = $${params.length}`);
      paramsForStats.push(0);
      conditionsForStats.push(`read = $${paramsForStats.length}`);
    } else if (query.readStatus === "ignored") {
      params.push(-1);
      conditions.push(`read = $${params.length}`);
      paramsForStats.push(-1);
      conditionsForStats.push(`read = $${paramsForStats.length}`);
    }
  }

  if (query.keyword) {
    const a = `%${query.keyword}%`;
    params.push(a, a);
    conditions.push(
      `(title ILIKE $${params.length - 1} OR content ILIKE $${params.length})`
    );
    paramsForStats.push(a, a);
    conditionsForStats.push(
      `(title ILIKE $${paramsForStats.length - 1} OR content ILIKE $${paramsForStats.length})`
    );
  }

  const attributesKeyword =
    typeof (query as any).attributesKeyword === "string"
      ? String((query as any).attributesKeyword).trim()
      : "";
  if (attributesKeyword) {
    const pat = `%${attributesKeyword}%`;
    params.push(pat);
    conditions.push(
      `(attributes IS NOT NULL AND jsonb_typeof(attributes) = 'object' AND EXISTS (SELECT 1 FROM jsonb_each(attributes) AS kv WHERE kv.key ILIKE $${params.length}))`
    );
    paramsForStats.push(pat);
    conditionsForStats.push(
      `(attributes IS NOT NULL AND jsonb_typeof(attributes) = 'object' AND EXISTS (SELECT 1 FROM jsonb_each(attributes) AS kv WHERE kv.key ILIKE $${paramsForStats.length}))`
    );
  }

  if (query.ruleId) {
    params.push(query.ruleId);
    conditions.push(`rule_id = $${params.length}`);
    paramsForStats.push(query.ruleId);
    conditionsForStats.push(`rule_id = $${paramsForStats.length}`);
  }

  return { conditions, params, conditionsForStats, paramsForStats };
}

export function whereClauseFrom(conditions: string[]): string {
  if (conditions.length === 0) return "";
  return `WHERE ${conditions.join(" AND ")}`;
}
