import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import DataSourcesPage from "@/views/DataSourcesPage.vue";
import RulesPage from "@/views/RulesPage.vue";
import DataPage from "@/views/DataPage.vue";
import CheckCheckPage from "@/views/CheckCheckPage.vue";
import FavoritesPage from "@/views/FavoritesPage.vue";
import TrackingPage from "@/views/TrackingPage.vue";
import AnalysisPage from "@/views/AnalysisPage.vue";
import SettingsPage from "@/views/SettingsPage.vue";
import DataAbandonPage from "@/views/DataAbandonPage.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: { name: "datasources" } },
  { path: "/datasources", name: "datasources", component: DataSourcesPage },
  { path: "/rules", name: "rules", component: RulesPage },
  { path: "/data", name: "data", component: DataPage },
  { path: "/checkcheck", name: "checkcheck", component: CheckCheckPage },
  { path: "/favorites", name: "favorites", component: FavoritesPage },
  { path: "/data-abandon", name: "data_abandon", component: DataAbandonPage },
  { path: "/tracking", name: "tracking", component: TrackingPage },
  { path: "/analysis", name: "analysis", component: AnalysisPage },
  { path: "/settings", name: "settings", component: SettingsPage }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
