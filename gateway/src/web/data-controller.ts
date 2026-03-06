import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import type {
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

    if (query.crawlTimeFrom) {
      params.push(query.crawlTimeFrom);
      conditions.push(`crawl_time >= $${params.length}`);
    }
    if (query.crawlTimeTo) {
      params.push(query.crawlTimeTo);
      conditions.push(`crawl_time <= $${params.length}`);
    }
    if (query.publishTimeFrom) {
      params.push(query.publishTimeFrom);
      conditions.push(`publish_time >= $${params.length}`);
    }
    if (query.publishTimeTo) {
      params.push(query.publishTimeTo);
      conditions.push(`publish_time <= $${params.length}`);
    }
    if (query.sources && query.sources.length > 0) {
      params.push(query.sources);
      conditions.push(`source = ANY($${params.length}::text[])`);
    }
    const trackingOnly = toBoolean((query as any).trackingOnly);
    if (trackingOnly) {
      conditions.push(
        `EXISTS (SELECT 1 FROM tracking_items ti WHERE ti.data_id = data_items.id)`
      );
    }
    if (query.readStatus && query.readStatus !== "all") {
      params.push(query.readStatus === "read");
      conditions.push(`read = $${params.length}`);
    }
    if (query.keyword) {
      params.push(`%${query.keyword}%`);
      params.push(`%${query.keyword}%`);
      conditions.push(
        `(title ILIKE $${params.length - 1} OR content ILIKE $${params.length})`
      );
    }

    let whereClause = "";
    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(" AND ")}`;
    }

    // 未阅优先（read=false 在前），再按时间排序
    let orderClause = "ORDER BY read ASC, crawl_time DESC";
    switch (query.sortBy) {
      case "crawlTimeAsc":
        orderClause = "ORDER BY read ASC, crawl_time ASC";
        break;
      case "crawlTimeDesc":
        orderClause = "ORDER BY read ASC, crawl_time DESC";
        break;
      case "publishTimeAsc":
        orderClause = "ORDER BY read ASC, publish_time ASC NULLS LAST";
        break;
      case "publishTimeDesc":
        orderClause = "ORDER BY read ASC, publish_time DESC NULLS LAST";
        break;
      default:
        break;
    }

    const offset = (page - 1) * pageSize;

    try {
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
           created_at AS "createdAt"
         FROM data_items
         ${whereClause}
         ${orderClause}
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      const result: ListDataResponse = {
        items: dataResult.rows,
        total
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
           SET tracking = $1
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
      await pool.query(
        `UPDATE data_items
           SET read = $1,
               updated_at = now()
         WHERE id = $2`,
        [body.read, body.id]
      );
      res.status(204).end();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /web/data/read error", err);
      res.status(500).json({ message: "Failed to update read status" });
    }
  });

  return router;
}

