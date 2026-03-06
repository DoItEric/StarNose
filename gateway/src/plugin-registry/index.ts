import fs from "node:fs";
import path from "node:path";
import type { PluginRunOptions, PluginRunResult } from "../api-model";
import type { PluginInfo, PluginRegistry } from "./types";
import { getPluginRunner, hasPluginRunner } from "./runners";

export function initPluginRegistry(
  pluginsDir: string,
  _logDir: string
): PluginRegistry {
  const plugins: PluginInfo[] = [];

  if (fs.existsSync(pluginsDir)) {
    for (const folder of fs.readdirSync(pluginsDir)) {
      const pluginPath = path.join(pluginsDir, folder);
      const metaPath = path.join(pluginPath, "plugin.json");
      if (!fs.existsSync(metaPath)) continue;
      try {
        const metaRaw = fs.readFileSync(metaPath, "utf8");
        const meta = JSON.parse(metaRaw) as {
          key: string;
          name: string;
          version: string;
          description?: string;
        };
        plugins.push({
          key: meta.key,
          name: meta.name,
          version: meta.version,
          description: meta.description,
          type: "datasource",
          entry: ""
        });
      } catch {
        // ignore broken plugin
      }
    }
  }

  return {
    listPlugins() {
      return plugins;
    },
    hasPluginRunner(pluginKey: string) {
      return hasPluginRunner(pluginKey);
    },
    async runPlugin(
      pluginKey: string,
      options: PluginRunOptions
    ): Promise<PluginRunResult> {
      const plugin = plugins.find((p) => p.key === pluginKey);
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginKey}`);
      }
      const run = getPluginRunner(pluginKey);
      if (!run) {
        throw new Error(`Plugin ${pluginKey} has no registered runner`);
      }
      return run(options);
    }
  };
}

