import cron from "node-cron";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import { isPluginEnabled } from "../plugin-registry/state";

interface Deps {
  pool: Pool;
  pluginRegistry: PluginRegistry;
  logDir: string;
}

export function initScheduler({ pluginRegistry }: Deps) {
  // 这里只做简单示例：每分钟检查一次哪些插件是启用状态
  cron.schedule("* * * * *", () => {
    const enabledPlugins = pluginRegistry
      .listPlugins()
      .filter((p) => isPluginEnabled(p.key))
      .map((p) => p.key);

    // eslint-disable-next-line no-console
    console.log(
      "[scheduler] enabled plugins that would be scheduled:",
      enabledPlugins
    );
  });
}

