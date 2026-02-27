import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import type { ListRulesQuery, RuleForPlugin } from "starnose-api-model";

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
        // 目前规则尚未与插件做严格绑定，这里只是预留条件
        void query.plugin;
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const dbResult = await pool.query(
        `SELECT
           id,
           name,
           description,
           keywords,
           disabled,
           last_run_at AS "lastRunAt",
           remark,
           extra
         FROM rules
         ${whereClause}
         ORDER BY created_at DESC`,
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

