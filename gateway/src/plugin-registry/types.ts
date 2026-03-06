export interface PluginInfo {
  key: string;
  name: string;
  type: "datasource";
  version: string;
  description?: string;
  entry: string;
}

export interface PluginRegistry {
  listPlugins(): PluginInfo[];
  /** 是否有该插件的硬编码 runner（仅对有 runner 的插件才执行） */
  hasPluginRunner(pluginKey: string): boolean;
  /** 直接调用插件 run，不依赖路径 */
  runPlugin(
    pluginKey: string,
    options: { gatewayUrl: string; pluginKey: string }
  ): Promise<{ success: boolean; totalCount?: number; matchedCount?: number }>;
}
