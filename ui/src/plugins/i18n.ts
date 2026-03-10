import { createI18n } from "vue-i18n";

const messages = {
  "zh-CN": {
    menu: {
      datasources: "数据源",
      rules: "规则",
      data: "数据",
      checkcheck: "checkcheck",
      favorites: "收藏",
      tracking: "跟踪",
      analysis: "分析",
      settings: "系统设置",
      data_abandon: "数据废弃"
    },
    datasource: {
      title: "数据源插件",
      setting: "设置",
      history: "历史记录",
      cronPlaceholder: "使用 CRON 表达式配置调度频率",
      historyTitle: "调度历史",
      last10: "最近 10 条调度记录"
    }
  },
  "en-US": {
    menu: {
      datasources: "Data Sources",
      rules: "Rules",
      data: "Data",
      checkcheck: "Checkcheck",
      favorites: "Favorites",
      tracking: "Tracking",
      analysis: "Analysis",
      settings: "Settings",
      data_abandon: "数据废弃"
    },
    datasource: {
      title: "Data Source Plugins",
      setting: "Settings",
      history: "History",
      cronPlaceholder: "Use CRON expression to configure schedule",
      historyTitle: "Schedule History",
      last10: "Last 10 runs"
    }
  }
};

export function setupI18n() {
  return createI18n({
    legacy: false,
    locale: "zh-CN",
    fallbackLocale: "en-US",
    messages
  });
}
