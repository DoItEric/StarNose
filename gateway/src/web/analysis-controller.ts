import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";

interface Deps {
  pool: Pool;
  pluginRegistry: PluginRegistry;
}

export function createAnalysisController({ pool }: Deps): Router {
  const router = express.Router();

  router.get("/", async (req: Request, res: Response) => {
    const { crawlTimeFrom, crawlTimeTo, sources } = req.query as {
      crawlTimeFrom?: string;
      crawlTimeTo?: string;
      sources?: string | string[];
    };

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (crawlTimeFrom) {
      params.push(crawlTimeFrom);
      conditions.push(`crawl_time >= $${params.length}`);
    }
    if (crawlTimeTo) {
      params.push(crawlTimeTo);
      conditions.push(`crawl_time <= $${params.length}`);
    }
    if (sources) {
      const list = Array.isArray(sources) ? sources : [sources];
      params.push(list);
      conditions.push(`source = ANY($${params.length}::text[])`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
      // 1) 词云：按 keywords 统计频次（简单展开 text[]）
      const wordResult = await pool.query(
        `SELECT
           lower(trim(unnest(keywords))) AS word,
           COUNT(*) AS cnt
         FROM data_items
         ${whereClause}
         GROUP BY lower(trim(unnest(keywords)))
         ORDER BY cnt DESC
         LIMIT 100`,
        params
      );

      const wordCloud = wordResult.rows.map((r) => ({
        word: r.word as string,
        count: Number(r.cnt)
      }));

      // 2) 热点列表：按 heat_score 排序
      const hotResult = await pool.query(
        `SELECT
           id,
           title,
           heat_score AS "score"
         FROM data_items
         ${whereClause}
         ORDER BY heat_score DESC, crawl_time DESC
         LIMIT 50`,
        params
      );

      const hotList = hotResult.rows;

      res.json({
        wordCloud,
        hotList
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /web/analysis error", err);
      res.status(500).json({ message: "Failed to load analysis" });
    }
  });

  return router;
}

