import fs from "node:fs";
import path from "node:path";
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
    }
  };
}

