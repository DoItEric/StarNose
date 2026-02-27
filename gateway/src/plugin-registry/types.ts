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
}
