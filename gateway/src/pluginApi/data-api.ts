import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import type { DataRecord } from "starnose-api-model";

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
      const result = await pool.query(
        `INSERT INTO data_items (
           rule_id,
           unique_key,
           source,
           title,
           content,
           url,
           keywords,
           tracking,
           crawl_time,
           publish_time,
           summary,
           read,
           remark,
           heat_score,
           extra
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,
           COALESCE($8,false),
           $9,
           $10,
           $11,
           COALESCE($12,false),
           $13,
           COALESCE($14,0),
           COALESCE($15,'{}'::jsonb)
         )
         ON CONFLICT (source, unique_key) DO UPDATE SET
           rule_id = EXCLUDED.rule_id,
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           url = EXCLUDED.url,
           keywords = EXCLUDED.keywords,
           crawl_time = EXCLUDED.crawl_time,
           publish_time = EXCLUDED.publish_time,
           summary = EXCLUDED.summary,
           read = EXCLUDED.read,
           remark = EXCLUDED.remark,
           heat_score = EXCLUDED.heat_score,
           extra = EXCLUDED.extra
         RETURNING id`,
        [
          body.ruleId,
          body.uniqueKey,
          body.source,
          body.title,
          body.content,
          body.url ?? null,
          body.keywords ?? [],
          body.tracking ?? false,
          body.crawlTime,
          body.publishTime ?? null,
          body.summary ?? null,
          body.read ?? false,
          body.remark ?? null,
          body.heatScore ?? 0,
          body.extra ?? {}
        ]
      );

      res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /api/data error", err);
      res.status(500).json({ message: "Failed to store data" });
    }
  });

  return router;
}

