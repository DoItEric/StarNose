import fs from "node:fs";
import path from "node:path";
import type { PluginRunOptions, PluginRunResult } from "starnose-api-model";
import type { PluginInfo, PluginRegistry } from "./types";

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
          entry?: string;
        };
        plugins.push({
          key: meta.key,
          name: meta.name,
          version: meta.version,
          description: meta.description,
          type: "datasource",
          entry: meta.entry ?? "dist/main.js"
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
    async runPlugin(
      pluginKey: string,
      options: PluginRunOptions
    ): Promise<PluginRunResult> {
      const plugin = plugins.find((p) => p.key === pluginKey);
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginKey}`);
      }
      const entryPath = path.resolve(pluginsDir, pluginKey, plugin.entry);
      if (!fs.existsSync(entryPath)) {
        throw new Error(`Plugin entry not found: ${entryPath}`);
      }
      const mod = require(entryPath) as { run?: (opts: PluginRunOptions) => Promise<PluginRunResult> };
      if (typeof mod.run !== "function") {
        throw new Error(`Plugin ${pluginKey} does not export run() (in-process run not supported)`);
      }
      return mod.run(options);
    }
  };
}

