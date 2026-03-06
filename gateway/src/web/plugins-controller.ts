import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import type {
  PluginHistoryItem,
  PluginScheduleConfig
} from "starnose-api-model";
import { isPluginEnabled, setPluginEnabled } from "../plugin-registry/state";

interface Deps {
  pool: Pool;
  pluginRegistry: PluginRegistry;
}

export function createPluginsController({ pool, pluginRegistry }: Deps): Router {
  const router = express.Router();

  router.get("/", async (_req: Request, res: Response) => {
    try {
      const plugins = pluginRegistry.listPlugins();
      const keys = plugins.map((p) => p.key);

      let lastRunMap: Record<string, string> = {};
      if (keys.length > 0) {
        const dbResult = await pool.query(
          `SELECT p.key, max(pr.started_at) AS last_started_at
             FROM plugin_runs pr
             JOIN plugins p ON pr.plugin_id = p.id
            WHERE p.key = ANY($1::text[])
            GROUP BY p.key`,
          [keys]
        );
        lastRunMap = dbResult.rows.reduce(
          (acc, row) => {
            acc[row.key as string] = row.last_started_at as string;
            return acc;
          },
          {} as Record<string, string>
        );
      }

      const items = plugins.map((p) => ({
        ...p,
        enabled: isPluginEnabled(p.key),
        lastRunAt: lastRunMap[p.key] ?? null
      }));

      res.json({ items });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /web/plugins error", err);
      res.status(500).json({ message: "Failed to load plugins" });
    }
  });

  router.get(
    "/:pluginKey/history",
    async (req: Request, res: Response) => {
      const { pluginKey } = req.params;
      try {
        const dbResult = await pool.query(
          `SELECT
             pr.id,
             p.key AS "pluginKey",
             pr.started_at AS "startedAt",
             pr.finished_at AS "finishedAt",
             pr.success,
             pr.total_count AS "totalCount",
             pr.matched_count AS "matchedCount"
           FROM plugin_runs pr
           JOIN plugins p ON pr.plugin_id = p.id
          WHERE p.key = $1
          ORDER BY pr.started_at DESC
          LIMIT 10`,
          [pluginKey]
        );

        const history: PluginHistoryItem[] = dbResult.rows;
        res.json({ items: history });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("GET /web/plugins/:pluginKey/history error", err);
        res.status(500).json({ message: "Failed to load plugin history" });
      }
    }
  );

  router.post(
    "/:pluginKey/schedule",
    async (req: Request, res: Response) => {
      const { pluginKey } = req.params;
      const body = req.body as PluginScheduleConfig;
      try {
        // 找到插件 ID
        const pluginResult = await pool.query(
          `SELECT id FROM plugins WHERE key = $1`,
          [pluginKey]
        );

        if (!pluginResult.rowCount) {
          res.status(404).json({ message: "Plugin not found" });
          return;
        }

        const pluginId = pluginResult.rows[0].id as string;

        // UPSERT 调度配置
        await pool.query(
          `INSERT INTO plugin_schedules (plugin_id, cron_expression, enabled)
           VALUES ($1, $2, true)
           ON CONFLICT (plugin_id)
           DO UPDATE SET
             cron_expression = EXCLUDED.cron_expression,
             enabled = EXCLUDED.enabled,
             updated_at = now()`,
          [pluginId, body.cron]
        );

        // 调度器动态刷新逻辑可后续扩展，这里先只做持久化
        res.status(204).end();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("POST /web/plugins/:pluginKey/schedule error", err);
        res.status(500).json({ message: "Failed to save schedule" });
      }
    }
  );

  router.post(
    "/:pluginKey/call",
    async (req: Request, res: Response) => {
      const { pluginKey } = req.params;
      try {
        // 确保 plugins 表中有此插件记录
        const reg = pluginRegistry
          .listPlugins()
          .find((p) => p.key === pluginKey);
        if (!reg) {
          res.status(404).json({ message: "Plugin not found" });
          return;
        }

        let pluginId: string;
        const existing = await pool.query(
          `SELECT id FROM plugins WHERE key = $1`,
          [pluginKey]
        );
        if (existing.rowCount && existing.rows[0]) {
          pluginId = existing.rows[0].id as string;
        } else {
          const inserted = await pool.query(
            `INSERT INTO plugins (key, name, type, version, description)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
              reg.key,
              reg.name,
              reg.type,
              reg.version,
              reg.description ?? null
            ]
          );
          pluginId = inserted.rows[0].id as string;
        }

        const gatewayUrl =
          process.env.GATEWAY_URL ||
          `http://127.0.0.1:${process.env.PORT || 3000}`;
        const startedAt = new Date().toISOString();

        const runPlugin = pluginRegistry.runPlugin;
        if (!runPlugin) {
          res.status(501).json({ message: "Plugin in-process run not available" });
          return;
        }
        const result = await runPlugin(pluginKey, {
          gatewayUrl,
          pluginKey
        });
        const finishedAt = new Date().toISOString();

        await pool.query(
          `INSERT INTO plugin_runs (
             plugin_id, started_at, finished_at, success, total_count, matched_count
           ) VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6)`,
          [
            pluginId,
            startedAt,
            finishedAt,
            result.success,
            result.totalCount ?? 0,
            result.matchedCount ?? 0
          ]
        );

        res.status(201).json({
          lastRunAt: startedAt,
          success: result.success,
          totalCount: result.totalCount ?? 0,
          matchedCount: result.matchedCount ?? 0
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("POST /web/plugins/:pluginKey/call error", err);
        res.status(500).json({
          message:
            err instanceof Error ? err.message : "Failed to call plugin"
        });
      }
    }
  );

  router.post(
    "/:pluginKey/enabled",
    async (req: Request, res: Response) => {
      const { pluginKey } = req.params;
      const { enabled } = req.body as { enabled: boolean };
      try {
        const exists = pluginRegistry
          .listPlugins()
          .some((p) => p.key === pluginKey);
        if (!exists) {
          res.status(404).json({ message: "Plugin not found" });
          return;
        }
        setPluginEnabled(pluginKey, enabled);
        res.status(204).end();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("POST /web/plugins/:pluginKey/enabled error", err);
        res.status(500).json({ message: "Failed to update plugin state" });
      }
    }
  );

  return router;
}

