import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import type {
  BlacklistChannelRequest,
  ListDataQuery,
  ListDataResponse,
  MarkDataReadRequest,
  ToggleFavoriteRequest,
  TrackDataRequest
} from "../api-model";

interface Deps {
  pool: Pool;
  pluginRegistry: PluginRegistry;
}

export function createDataController({ pool }: Deps): Router {
  const router = express.Router();

  router.get("/", async (req: Request, res: Response) => {
    const query = req.query as unknown as ListDataQuery;

    const toNumber = (v: unknown): number | undefined => {
      if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
      if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      }
      return undefined;
    };
    const toBoolean = (v: unknown): boolean | undefined => {
      if (typeof v === "boolean") return v;
      if (typeof v === "string") {
        if (v === "true" || v === "1") return true;
        if (v === "false" || v === "0") return false;
      }
      return undefined;
    };

    const pageRaw = toNumber(query.page);
    const page = pageRaw && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSizeRaw = toNumber(query.pageSize);
    const pageSize =
      pageSizeRaw && pageSizeRaw > 0 && pageSizeRaw <= 500
        ? Math.floor(pageSizeRaw)
        : 100;

    const conditions: string[] = [];
    const params: unknown[] = [];

    const conditionsForStats: string[] = [];
    const paramsForStats: unknown[] = [];

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
      params.push(`%${String(query.channel).trim()}%`);
      conditions.push(`channel ILIKE $${params.length}`);

      paramsForStats.push(`%${String(query.channel).trim()}%`);
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
        `EXISTS (SELECT 1 FROM tracking_items ti WHERE ti.data_id = data_items.id)`
      );
      conditionsForStats.push(
        `EXISTS (SELECT 1 FROM tracking_items ti WHERE ti.data_id = data_items.id)`
      );
    }
    const favoriteOnly = toBoolean((query as any).favoriteOnly);
    const favoriteListId = typeof (query as any).favoriteListId === "string"
      ? String((query as any).favoriteListId).trim()
      : "";
    if (favoriteOnly) {
      if (favoriteListId) {
        params.push(favoriteListId);
        conditions.push(
          `EXISTS (SELECT 1 FROM favorite_items fi WHERE fi.data_id = data_items.id AND fi.list_id = $${params.length}::uuid)`
        );
        paramsForStats.push(favoriteListId);
        conditionsForStats.push(
          `EXISTS (SELECT 1 FROM favorite_items fi WHERE fi.data_id = data_items.id AND fi.list_id = $${paramsForStats.length}::uuid)`
        );
      } else {
        conditions.push(
          `EXISTS (SELECT 1 FROM favorite_items fi WHERE fi.data_id = data_items.id)`
        );
        conditionsForStats.push(
          `EXISTS (SELECT 1 FROM favorite_items fi WHERE fi.data_id = data_items.id)`
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
    if (query.readStatus && query.readStatus !== "all") {
      if (query.readStatus === "read") {
        params.push(1);
        conditions.push(`read = $${params.length}`);
      } else if (query.readStatus === "unread") {
        params.push(0);
        conditions.push(`read = $${params.length}`);
      } else if (query.readStatus === "ignored") {
        params.push(-1);
        conditions.push(`read = $${params.length}`);
      }
    }
    if (query.keyword) {
      params.push(`%${query.keyword}%`);
      params.push(`%${query.keyword}%`);
      conditions.push(
        `(title ILIKE $${params.length - 1} OR content ILIKE $${params.length})`
      );

      paramsForStats.push(`%${query.keyword}%`);
      paramsForStats.push(`%${query.keyword}%`);
      conditionsForStats.push(
        `(title ILIKE $${paramsForStats.length - 1} OR content ILIKE $${paramsForStats.length})`
      );
    }
    const attributesKeyword = typeof (query as any).attributesKeyword === "string"
      ? String((query as any).attributesKeyword).trim()
      : "";
    if (attributesKeyword) {
      params.push(`%${attributesKeyword}%`);
      conditions.push(`attributes::text ILIKE $${params.length}`);

      paramsForStats.push(`%${attributesKeyword}%`);
      conditionsForStats.push(`attributes::text ILIKE $${paramsForStats.length}`);
    }
    if (query.ruleId) {
      params.push(query.ruleId);
      conditions.push(`rule_id = $${params.length}`);
    }

    let whereClause = "";
    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(" AND ")}`;
    }

    let whereClauseForStats = "";
    if (conditionsForStats.length > 0) {
      whereClauseForStats = `WHERE ${conditionsForStats.join(" AND ")}`;
    }

    // 未阅(0)优先，已阅(1)次之，忽略(-1)最后
    let orderClause = "ORDER BY CASE WHEN read = 0 THEN 0 WHEN read = 1 THEN 1 ELSE 2 END ASC, crawl_time DESC";
    switch (query.sortBy) {
      case "crawlTimeAsc":
        orderClause = "ORDER BY CASE WHEN read = 0 THEN 0 WHEN read = 1 THEN 1 ELSE 2 END ASC, crawl_time ASC";
        break;
      case "crawlTimeDesc":
        orderClause = "ORDER BY CASE WHEN read = 0 THEN 0 WHEN read = 1 THEN 1 ELSE 2 END ASC, crawl_time DESC";
        break;
      case "publishTimeAsc":
        orderClause = "ORDER BY CASE WHEN read = 0 THEN 0 WHEN read = 1 THEN 1 ELSE 2 END ASC, publish_time ASC NULLS LAST";
        break;
      case "publishTimeDesc":
        orderClause = "ORDER BY CASE WHEN read = 0 THEN 0 WHEN read = 1 THEN 1 ELSE 2 END ASC, publish_time DESC NULLS LAST";
        break;
      default:
        break;
    }

    const offset = (page - 1) * pageSize;

    try {
      const statsResult = await pool.query(
        `SELECT
           rule_id AS "ruleId",
           COUNT(*) FILTER (WHERE read = 0) AS "unreadCount"
         FROM data_items
         ${whereClauseForStats}
         GROUP BY rule_id`,
        paramsForStats
      );

      const countResult = await pool.query(
        `SELECT COUNT(*) AS cnt FROM data_items ${whereClause}`,
        params
      );
      const total = Number(countResult.rows[0].cnt ?? 0);

      params.push(pageSize);
      params.push(offset);

      const dataResult = await pool.query(
        `SELECT
           data_items.id,
           data_items.rule_id AS "ruleId",
           data_items.unique_key AS "uniqueKey",
           data_items.source,
           data_items.channel,
           data_items.title,
           data_items.content,
           data_items.url,
           data_items.keywords,
           EXISTS (SELECT 1 FROM tracking_items ti WHERE ti.data_id = data_items.id) AS tracking,
           data_items.crawl_time AS "crawlTime",
           data_items.publish_time AS "publishTime",
           data_items.summary,
           data_items.attributes,
           data_items.read,
           data_items.remark,
           data_items.heat_score AS "heatScore",
           data_items.extra,
           data_items.params,
           data_items.track_data AS "trackData",
           data_items.last_track_at AS "lastTrackAt",
           data_items.track_count AS "trackCount",
           (favorite_items.id IS NOT NULL) AS favorite,
           favorite_items.list_id AS "favoriteListId",
           favorite_lists.name AS "favoriteListName",
           data_items.created_at AS "createdAt"
         FROM data_items
         LEFT JOIN favorite_items
           ON favorite_items.data_id = data_items.id
         LEFT JOIN favorite_lists
           ON favorite_lists.id = favorite_items.list_id
         ${whereClause}
         ${orderClause}
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      const result: ListDataResponse = {
        items: dataResult.rows,
        total,
        ruleUnreadStats: statsResult.rows as ListDataResponse["ruleUnreadStats"]
      };
      res.json(result);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /web/data error", err);
      res.status(500).json({ message: "Failed to load data" });
    }
  });

  router.post("/track", async (req: Request, res: Response) => {
    const body = req.body as TrackDataRequest;

    try {
      // 1) 更新 data_items.tracking
      await pool.query(
        `UPDATE data_items
           SET tracking = $1,
               read = CASE WHEN $1 THEN 1 ELSE read END,
               updated_at = now()
         WHERE id = $2`,
        [body.tracking, body.id]
      );

      // 2) 更新 tracking_items 表
      const dataResult = await pool.query(
        `SELECT id, unique_key, source
           FROM data_items
          WHERE id = $1`,
        [body.id]
      );

      if (dataResult.rowCount && dataResult.rows[0]) {
        const row = dataResult.rows[0] as {
          id: string;
          unique_key: string;
          source: string;
        };

        if (body.tracking) {
          await pool.query(
            `INSERT INTO tracking_items (data_id, unique_key, source)
             VALUES ($1, $2, $3)
             ON CONFLICT (source, unique_key) DO NOTHING`,
            [row.id, row.unique_key, row.source]
          );
        } else {
          await pool.query(
            `DELETE FROM tracking_items
              WHERE source = $1 AND unique_key = $2`,
            [row.source, row.unique_key]
          );
        }
      }

      res.status(204).end();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /web/data/track error", err);
      res.status(500).json({ message: "Failed to update tracking" });
    }
  });

  router.post("/read", async (req: Request, res: Response) => {
    const body = req.body as MarkDataReadRequest;
    try {
      const readVal =
        body.read === true || body.read === 1
          ? 1
          : body.read === false || body.read === 0
            ? 0
            : body.read === -1 
              ? -1
              : Number(body.read);
      const normalized = Number.isFinite(readVal) ? readVal : 0;
      await pool.query(
        `UPDATE data_items
           SET read = $1,
               updated_at = now()
         WHERE id = $2`,
        [normalized, body.id]
      );
      res.status(204).end();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /web/data/read error", err);
      res.status(500).json({ message: "Failed to update read status" });
    }
  });

  router.post("/favorite", async (req: Request, res: Response) => {
    const body = req.body as ToggleFavoriteRequest;
    try {
      if (body.favorite) {
        const listIdRaw = typeof (body as any).listId === "string" ? (body as any).listId.trim() : "";
        const listNameRaw =
          typeof (body as any).listName === "string" ? (body as any).listName.trim() : "";

        let listId: string | null = listIdRaw || null;
        if (!listId && listNameRaw) {
          const existed = await pool.query<{ id: string }>(
            `SELECT id FROM favorite_lists WHERE lower(name) = lower($1) LIMIT 1`,
            [listNameRaw]
          );
          if (existed.rowCount && existed.rows[0]) {
            listId = existed.rows[0].id;
          } else {
            const created = await pool.query<{ id: string }>(
              `INSERT INTO favorite_lists (name) VALUES ($1) RETURNING id`,
              [listNameRaw]
            );
            listId = created.rows[0].id;
          }
        }
        if (!listId) {
          const def = await pool.query<{ id: string }>(
            `SELECT id FROM favorite_lists WHERE lower(name) = lower('默认') LIMIT 1`
          );
          listId = def.rowCount && def.rows[0] ? def.rows[0].id : null;
        }

        await pool.query(
          `INSERT INTO favorite_items (data_id, list_id, updated_at)
             VALUES ($1, $2::uuid, now())
           ON CONFLICT (data_id) DO UPDATE
                 SET list_id = EXCLUDED.list_id,
                     updated_at = now()`,
          [body.id, listId]
        );
      } else {
        await pool.query(
          `DELETE FROM favorite_items
             WHERE data_id = $1`,
          [body.id]
        );
      }
      res.status(204).end();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /web/data/favorite error", err);
      res.status(500).json({ message: "Failed to update favorite status" });
    }
  });

  // req0310: 联系状态切换（params.connected / params.connected_at）
  router.post("/connected", async (req: Request, res: Response) => {
    const body = req.body as { id?: string; connected?: boolean };
    const id = String(body.id ?? "").trim();
    const connected = body.connected === true;
    if (!id) {
      res.status(400).json({ message: "id required" });
      return;
    }
    try {
      if (connected) {
        await pool.query(
          `UPDATE data_items
              SET params = jsonb_set(
                           jsonb_set(COALESCE(params, '{}'::jsonb), '{connected}', 'true'::jsonb, true),
                           '{connected_at}',
                           to_jsonb(now()),
                           true
                         ),
                  updated_at = now()
            WHERE id = $1::uuid`,
          [id]
        );
      } else {
        await pool.query(
          `UPDATE data_items
              SET params = (COALESCE(params, '{}'::jsonb) - 'connected' - 'connected_at'),
                  updated_at = now()
            WHERE id = $1::uuid`,
          [id]
        );
      }
      res.status(204).end();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /web/data/connected error", err);
      res.status(500).json({ message: "Failed to update connected status" });
    }
  });

  // 将指定 channel 加入黑名单，并把对应数据全部标记为已读。
  // 目前只实现 Reddit：将 channel 视为 subreddit，写入 reddit_subreddit_blacklist，
  // 同时将 data_items 中 source='reddit' 且 channel=该值的记录标记为 read=true。
  router.post(
    "/channel/blacklist",
    async (req: Request, res: Response): Promise<void> => {
      const body = req.body as BlacklistChannelRequest;
      const source = (body.source ?? "").trim();
      const channel = (body.channel ?? "").trim();
      const ruleId = typeof (body as any).ruleId === "string" ? (body as any).ruleId.trim() : "";

      if (!source || !channel) {
        res.status(400).json({ message: "source and channel are required" });
        return;
      }

      if (source !== "reddit") {
        // 预留给未来其它数据源的实现
        res.status(400).json({ message: "only reddit is supported for now" });
        return;
      }

      try {
        // 1) 写入 reddit_subreddit_blacklist
        try {
          await pool.query(
            `INSERT INTO reddit_subreddit_blacklist (rule_id, name)
             VALUES (NULLIF($1, '')::uuid, $2)
             ON CONFLICT DO NOTHING`,
            [ruleId, channel]
          );
        } catch (e) {
          const pgErr = e as { code?: string };
          // 42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
          // 兼容旧库未加唯一约束的情况，降级为普通 INSERT（允许重复行）
          if (pgErr.code === "42P10") {
            await pool.query(
              `INSERT INTO reddit_subreddit_blacklist (rule_id, name)
               VALUES (NULLIF($1, '')::uuid, $2)`,
              [ruleId, channel]
            );
          } else {
            throw e;
          }
        }

        // 2) 将对应数据标记为已读
        const result = await pool.query(
          `UPDATE data_items
              SET read = 1,
                  updated_at = now()
            WHERE source = $1
              AND channel = $2
              AND read = 0`,
          [source, channel]
        );

        res.json({
          ok: true,
          updatedCount: result.rowCount ?? 0
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("POST /web/data/channel/blacklist error", err);
        res
          .status(500)
          .json({ message: "Failed to blacklist channel and mark read" });
      }
    }
  );

  return router;
}

