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
           hot_words,
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
           $13,
           COALESCE($14,false),
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
           hot_words = EXCLUDED.hot_words,
           read = EXCLUDED.read,
           remark = EXCLUDED.remark,
           heat_score = EXCLUDED.heat_score,
           extra = EXCLUDED.extra
         RETURNING id`,
        [
          body.ruleId, // $1
          body.uniqueKey, // $2
          body.source, // $3
          // 通用 channel 字段，如 subreddit / topic 等，暂时由各插件自行决定是否传入
          // Reddit 插件会写入 subreddit
          (body as any).channel ?? null, // $4
          body.title, // $5
          body.content, // $6
          body.url ?? null, // $7
          keywords, // $8 (text[])
          body.tracking ?? false, // $9
          body.crawlTime, // $10
          body.publishTime ?? null, // $11
          body.summary ?? null, // $12
          body.hotWords ?? null, // $13
          body.read ?? false, // $14
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

  return router;
}

