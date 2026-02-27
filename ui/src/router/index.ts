import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import DataSourcesPage from "@/views/DataSourcesPage.vue";
import RulesPage from "@/views/RulesPage.vue";
import DataPage from "@/views/DataPage.vue";
import AnalysisPage from "@/views/AnalysisPage.vue";
import SettingsPage from "@/views/SettingsPage.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: { name: "datasources" } },
  { path: "/datasources", name: "datasources", component: DataSourcesPage },
  { path: "/rules", name: "rules", component: RulesPage },
  { path: "/data", name: "data", component: DataPage },
  { path: "/analysis", name: "analysis", component: AnalysisPage },
  { path: "/settings", name: "settings", component: SettingsPage }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
