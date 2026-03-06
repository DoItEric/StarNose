import cron from "node-cron";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import { isPluginEnabled } from "../plugin-registry/state";

interface Deps {
  pool: Pool;
  pluginRegistry: PluginRegistry;
  logDir: string;
}

function getGatewayUrl(): string {
  return (
    process.env.GATEWAY_URL ||
    `http://127.0.0.1:${process.env.PORT || 3000}`
  );
}

export function initScheduler({
  pool,
  pluginRegistry
}: Deps) {
  const runPlugin = pluginRegistry.runPlugin;

  cron.schedule("* * * * *", async () => {
    const gatewayUrl = getGatewayUrl();
    const enabledPlugins = pluginRegistry
      .listPlugins()
      .filter((p) => isPluginEnabled(p.key));

    if (enabledPlugins.length === 0 || !runPlugin) return;

    for (const plugin of enabledPlugins) {
      if (!pluginRegistry.hasPluginRunner(plugin.key)) continue;
      (async () => {
        try {
          const result = await runPlugin(plugin.key, {
            gatewayUrl,
            pluginKey: plugin.key
          });
          const existing = await pool.query(
            `SELECT id FROM plugins WHERE key = $1`,
            [plugin.key]
          );
          let pluginId: string;
          if (existing.rowCount && existing.rows[0]) {
            pluginId = existing.rows[0].id as string;
          } else {
            const inserted = await pool.query(
              `INSERT INTO plugins (key, name, type, version, description)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id`,
              [
                plugin.key,
                plugin.name,
                plugin.type,
                plugin.version,
                plugin.description ?? null
              ]
            );
            pluginId = inserted.rows[0].id as string;
          }
          const startedAt = new Date().toISOString();
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
          // eslint-disable-next-line no-console
          console.log(
            `[scheduler] ${plugin.key} finished: success=${result.success} total=${result.totalCount ?? 0} matched=${result.matchedCount ?? 0}`
          );
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[scheduler] ${plugin.key} error:`, err);
        }
      })();
    }
  });
}

