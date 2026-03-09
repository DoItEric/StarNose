import cron from "node-cron";
import fs from "node:fs";
import path from "node:path";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";

interface Deps {
  pool: Pool;
  pluginRegistry: PluginRegistry;
  logDir: string;
}

function matchCronField(expr: string, value: number): boolean {
  if (expr === "*") return true;
  if (expr.startsWith("*/")) {
    const step = Number(expr.slice(2));
    if (!Number.isFinite(step) || step <= 0) return false;
    return value % step === 0;
  }
  const num = Number(expr);
  if (Number.isFinite(num)) {
    return value === num;
  }
  return false;
}

/**
 * 简单的 cron 表达式匹配，仅支持 5/6 段形式。
 */
function matchesCronExpression(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) return false;

  const [secExpr, minExpr, hourExpr] =
    parts.length === 6
      ? [parts[0], parts[1], parts[2]]
      : ["0", parts[0], parts[1]];

  const sec = date.getSeconds();
  const min = date.getMinutes();
  const hour = date.getHours();

  if (!matchCronField(secExpr, sec)) return false;
  if (!matchCronField(minExpr, min)) return false;
  if (!matchCronField(hourExpr, hour)) return false;

  // day-of-month / month / day-of-week 目前只支持 "*"，有需要再扩展
  return true;
}

function getSchedulerLogFilePath(logDir: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.resolve(logDir);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `scheduler-${date}.log`);
}

function writeSchedulerLog(
  logDir: string,
  step: string,
  detail?: unknown
): void {
  try {
    const logPath = getSchedulerLogFilePath(logDir);
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      step,
      detail
    });
    fs.appendFileSync(logPath, line + "\n", "utf8");
  } catch {
    // 写日志失败不影响调度器主流程
  }
}

function getGatewayUrl(): string {
  return (
    process.env.GATEWAY_URL ||
    `http://127.0.0.1:${process.env.PORT || 3000}`
  );
}

export function initScheduler({
  pool,
  pluginRegistry,
  logDir
}: Deps) {
  const runPlugin = pluginRegistry.runPlugin;

  // 外层调度改为秒级，每秒 tick 一次，再由每个插件自己的 cron_expression（支持 5/6 段）决定是否实际执行
  cron.schedule("* * * * * *", async () => {
    const gatewayUrl = getGatewayUrl();
    const plugins = pluginRegistry.listPlugins();

    if (plugins.length === 0 || !runPlugin) return;

    try {
      // 读取所有插件的调度配置
      const dbResult = await pool.query<{
        plugin_id: string;
        key: string;
        cron_expression: string;
        enabled: boolean;
      }>(
        `SELECT p.id AS plugin_id,
                p.key,
                ps.cron_expression,
                ps.enabled
           FROM plugins p
           JOIN plugin_schedules ps ON ps.plugin_id = p.id`
      );

      const schedulesByKey = new Map<
        string,
        { cron: string; enabled: boolean }
      >();
      for (const row of dbResult.rows) {
        schedulesByKey.set(row.key, {
          cron: row.cron_expression,
          enabled: row.enabled
        });
      }

      writeSchedulerLog(logDir, "cron_tick", {
        plugins: plugins.map((p) => ({
          key: p.key,
          schedule: schedulesByKey.get(p.key) ?? null
        }))
      });

      const now = new Date();

      for (const plugin of plugins) {
        const schedule = schedulesByKey.get(plugin.key);
        if (!schedule || !schedule.enabled) continue;
        if (!pluginRegistry.hasPluginRunner(plugin.key)) continue;

        const cronExpr = schedule.cron;
        if (!cron.validate(cronExpr)) {
          writeSchedulerLog(logDir, "skip_invalid_cron", {
            pluginKey: plugin.key,
            cron: cronExpr
          });
          continue;
        }

        // 使用自定义的 cron 表达式匹配当前时间（支持 5/6 段）
        if (!matchesCronExpression(cronExpr, now)) {
          continue;
        }

        (async () => {
          try {
            writeSchedulerLog(logDir, "run_plugin_start", {
              pluginKey: plugin.key
            });
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
            writeSchedulerLog(logDir, "run_plugin_finished", {
              pluginKey: plugin.key,
              success: result.success,
              total: result.totalCount ?? 0,
              matched: result.matchedCount ?? 0
            });
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`[scheduler] ${plugin.key} error:`, err);
            writeSchedulerLog(logDir, "run_plugin_error", {
              pluginKey: plugin.key,
              error: err instanceof Error ? err.message : String(err)
            });
          }
        })();
      }
    } catch (err) {
      writeSchedulerLog(logDir, "cron_tick_error", {
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
}

