import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import type {
  BlacklistChannelRequest,
  ListDataQuery,
  ListDataResponse,
  MarkDataReadRequest,
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
           id,
           rule_id AS "ruleId",
           unique_key AS "uniqueKey",
           source,
           channel,
           title,
           content,
           url,
           keywords,
           EXISTS (SELECT 1 FROM tracking_items ti WHERE ti.data_id = data_items.id) AS tracking,
           crawl_time AS "crawlTime",
           publish_time AS "publishTime",
           summary,
           hot_words AS "hotWords",
           read,
           remark,
           heat_score AS "heatScore",
           extra,
           track_data AS "trackData",
           last_track_at AS "lastTrackAt",
           track_count AS "trackCount",
           created_at AS "createdAt"
         FROM data_items
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
            : body.read === -1 || body.read === "-1"
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

  // 将指定 channel 加入黑名单，并把对应数据全部标记为已读。
  // 目前只实现 Reddit：将 channel 视为 subreddit，写入 reddit_subreddit_blacklist，
  // 同时将 data_items 中 source='reddit' 且 channel=该值的记录标记为 read=true。
  router.post(
    "/channel/blacklist",
    async (req: Request, res: Response): Promise<void> => {
      const body = req.body as BlacklistChannelRequest;
      const source = (body.source ?? "").trim();
      const channel = (body.channel ?? "").trim();

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
            `INSERT INTO reddit_subreddit_blacklist (name)
             VALUES ($1)
             ON CONFLICT (name) DO NOTHING`,
            [channel]
          );
        } catch (e) {
          const pgErr = e as { code?: string };
          // 42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
          // 兼容旧库未加唯一约束的情况，降级为普通 INSERT（允许重复行）
          if (pgErr.code === "42P10") {
            await pool.query(
              `INSERT INTO reddit_subreddit_blacklist (name)
               VALUES ($1)`,
              [channel]
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

