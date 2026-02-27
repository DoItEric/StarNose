import fs from "node:fs";
import path from "node:path";

export type PluginStateMap = Record<string, boolean>;

function getStateFilePathFromHere() {
  // dist/plugin-registry -> ../../plugin-state.json => gateway 根目录
  return path.resolve(__dirname, "../../plugin-state.json");
}

export function loadPluginStates(): PluginStateMap {
  const filePath = getStateFilePathFromHere();
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw) as PluginStateMap;
    return data;
  } catch {
    return {};
  }
}

export function isPluginEnabled(pluginKey: string): boolean {
  const states = loadPluginStates();
  const value = states[pluginKey];
  // 未配置视为启用
  if (typeof value !== "boolean") return true;
  return value;
}

export function setPluginEnabled(pluginKey: string, enabled: boolean): void {
  const filePath = getStateFilePathFromHere();
  const states = loadPluginStates();
  states[pluginKey] = enabled;
  fs.writeFileSync(filePath, JSON.stringify(states, null, 2), "utf8");
}

