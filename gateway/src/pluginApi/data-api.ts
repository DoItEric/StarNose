import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import type { DataRecord } from "../api-model";

interface Deps {
  pool: Pool;
  pluginRegistry: PluginRegistry;
  logDir: string;
}

export function createDataApi({ pool }: Deps): Router {
  const router = express.Router();

  router.post("/", async (req: Request, res: Response) => {
    const body = req.body as DataRecord;
    try {
      const keywords: string[] =
        Array.isArray(body.keywords) && body.keywords.length > 0
          ? body.keywords
          : body.keywords
          ? [String(body.keywords)]
          : [];
      const readVal =
        body.read === 1 ? 1 : body.read === -1 ? -1 : 0;
      const result = await pool.query(
        `INSERT INTO data_items (
           rule_id,
           unique_key,
           source,
           channel,
           title,
           content,
           url,
           keywords,
           tracking,
           crawl_time,
           publish_time,
           summary,
           attributes,
           read,
           remark,
           heat_score,
           extra
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,
           COALESCE($9,false),
           $10,
           $11,
           $12,
           COALESCE($13,'{}'::jsonb),
           $14,
           $15,
           COALESCE($16,0),
           COALESCE($17,'{}'::jsonb)
         )
         ON CONFLICT (source, unique_key) DO UPDATE SET
           rule_id = EXCLUDED.rule_id,
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           url = EXCLUDED.url,
           keywords = EXCLUDED.keywords,
           channel = EXCLUDED.channel,
           crawl_time = EXCLUDED.crawl_time,
           publish_time = EXCLUDED.publish_time,
           summary = EXCLUDED.summary,
           attributes = EXCLUDED.attributes,
           read = EXCLUDED.read,
           remark = EXCLUDED.remark,
           heat_score = EXCLUDED.heat_score,
           extra = EXCLUDED.extra
         RETURNING id`,
        [
          body.ruleId, // $1
          body.uniqueKey, // $2
          body.source, // $3
          (body as any).channel ?? null, // $4
          body.title, // $5
          body.content, // $6
          body.url ?? null, // $7
          keywords, // $8 (text[])
          body.tracking ?? false, // $9
          body.crawlTime, // $10
          body.publishTime ?? null, // $11
          body.summary ?? null, // $12
          body.attributes ? JSON.stringify(body.attributes) : "{}", // $13
          readVal, // $14
          body.remark ?? null, // $15
          body.heatScore ?? 0, // $16
          body.extra ?? {} // $17
        ]
      );

      res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /api/data error", err);
      res.status(500).json({ message: "Failed to store data" });
    }
  });

  // 关键词命中但 LLM 未通过的数据，写入 data_items_abandon
  router.post("/abandon", async (req: Request, res: Response) => {
    const body = req.body as DataRecord;
    try {
      const keywords: string[] =
        Array.isArray(body.keywords) && body.keywords.length > 0
          ? body.keywords
          : body.keywords
          ? [String(body.keywords)]
          : [];
      const readVal =
         body.read === 1 ? 1 : body.read === -1 ? -1 : 0;
      const result = await pool.query(
        `INSERT INTO data_items_abandon (
           rule_id,
           unique_key,
           source,
           channel,
           title,
           content,
           url,
           keywords,
           tracking,
           crawl_time,
           publish_time,
           summary,
           attributes,
           read,
           remark,
           heat_score,
           extra
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,
           COALESCE($9,false),
           $10,
           $11,
           $12,
           COALESCE($13,'{}'::jsonb),
           $14,
           $15,
           COALESCE($16,0),
           COALESCE($17,'{}'::jsonb)
         )
         ON CONFLICT (source, unique_key) DO UPDATE SET
           rule_id = EXCLUDED.rule_id,
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           url = EXCLUDED.url,
           keywords = EXCLUDED.keywords,
           channel = EXCLUDED.channel,
           crawl_time = EXCLUDED.crawl_time,
           publish_time = EXCLUDED.publish_time,
           summary = EXCLUDED.summary,
           attributes = EXCLUDED.attributes,
           read = EXCLUDED.read,
           remark = EXCLUDED.remark,
           heat_score = EXCLUDED.heat_score,
           extra = EXCLUDED.extra
         RETURNING id`,
        [
          body.ruleId, // $1
          body.uniqueKey, // $2
          body.source, // $3
          (body as any).channel ?? null, // $4
          body.title, // $5
          body.content, // $6
          body.url ?? null, // $7
          keywords, // $8 (text[])
          body.tracking ?? false, // $9
          body.crawlTime, // $10
          body.publishTime ?? null, // $11
          body.summary ?? null, // $12
          body.attributes ? JSON.stringify(body.attributes) : "{}", // $13
          readVal, // $14
          body.remark ?? null, // $15
          body.heatScore ?? 0, // $16
          body.extra ?? {} // $17
        ]
      );

      res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /api/data/abandon error", err);
      res.status(500).json({ message: "Failed to store abandon data" });
    }
  });

  /** 供 track 插件拉取待跟踪数据：抓取时间>3天、距上次 track>3天、track 次数<3 */
  router.get("/for-track", async (req: Request, res: Response) => {
    const source = (req.query.source as string)?.trim() || null;
    try {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const conditions = [
        "crawl_time < $1",
        "(last_track_at IS NULL OR last_track_at < $1)",
        "track_count < 3"
      ];
      const params: unknown[] = [threeDaysAgo];
      if (source) {
        params.push(source);
        conditions.push(`source = $${params.length}`);
      }
      const whereClause = "WHERE " + conditions.join(" AND ");
      const result = await pool.query(
        `SELECT id, unique_key AS "uniqueKey", source, channel
         FROM data_items
         ${whereClause}
         ORDER BY last_track_at ASC NULLS FIRST
         LIMIT 500`,
        params
      );
      res.json({ items: result.rows });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /api/data/for-track error", err);
      res.status(500).json({ message: "Failed to load items for track" });
    }
  });

  /** 更新单条数据的 track 结果（供 track 插件调用） */
  router.patch("/:id/track-update", async (req: Request, res: Response) => {
    const id = req.params.id;
    const body = req.body as { trackData?: Record<string, unknown> };
    try {
      await pool.query(
        `UPDATE data_items
           SET track_data = COALESCE($1, track_data),
               last_track_at = now(),
               track_count = track_count + 1,
               updated_at = now()
         WHERE id = $2`,
        [body.trackData ? JSON.stringify(body.trackData) : null, id]
      );
      res.status(204).end();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("PATCH /api/data/:id/track-update error", err);
      res.status(500).json({ message: "Failed to update track" });
    }
  });

  return router;
}

