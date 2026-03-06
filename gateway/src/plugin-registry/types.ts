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
  /** 在主进程内加载并执行插件，不再 spawn 子进程 */
  runPlugin?(
    pluginKey: string,
    options: { gatewayUrl: string; pluginKey: string }
  ): Promise<{ success: boolean; totalCount?: number; matchedCount?: number }>;
}
