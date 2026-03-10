import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import type { ListRulesQuery, RuleForPlugin } from "../api-model";

interface Deps {
  pool: Pool;
  pluginRegistry: PluginRegistry;
  logDir: string;
}

export function createRulesApi({ pool }: Deps): Router {
  const router = express.Router();

  router.get("/", async (req: Request, res: Response) => {
    const query = req.query as unknown as ListRulesQuery;
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (query.plugin) {
        params.push(`%,${String(query.plugin).trim()},%`);
        conditions.push(`plugins LIKE $${params.length}`);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const dbResult = await pool.query(
        `SELECT
           id,
           name,
           description,
           keywords,
           negative_keywords AS "negativeKeywords",
           disabled,
           last_run_at AS "lastRunAt",
           remark,
           extra,
           prompt_file AS "promptFile",
           content_length AS "contentLength",
           content_min_length AS "contentMinLength"
         FROM rules
         ${whereClause}
         ORDER BY created_at ASC`,
        params
      );

      const items: RuleForPlugin[] = dbResult.rows;
      res.json({ items });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /api/rules error", err);
      res.status(500).json({ message: "Failed to load rules for plugin" });
    }
  });

  return router;
}

