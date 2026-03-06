import type { PluginRunOptions, PluginRunResult } from "../api-model";
import { run as redditRun } from "../plugins/reddit/main";

/** 插件 key 与 run 函数的硬编码映射，直接引用并调用，不依赖路径解析 */
const RUNNERS: Record<string, (opts: PluginRunOptions) => Promise<PluginRunResult>> = {
  reddit: redditRun
};

export function getPluginRunner(pluginKey: string): ((opts: PluginRunOptions) => Promise<PluginRunResult>) | undefined {
  return RUNNERS[pluginKey];
}

export function hasPluginRunner(pluginKey: string): boolean {
  return pluginKey in RUNNERS;
}
