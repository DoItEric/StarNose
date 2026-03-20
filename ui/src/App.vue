<template>
  <a-layout class="app-layout">
    <!-- 桌面端侧边栏 -->
    <a-layout-sider
      v-if="!isMobile"
      theme="light"
      width="220"
      class="app-sider"
    >
      <div class="logo">StarNose</div>
      <a-menu
        mode="inline"
        :selected-keys="[selectedKey]"
        :open-keys="openKeys"
        @click="onMenuClick"
        @openChange="onOpenChange"
      >
        <a-menu-item key="datasources">
          {{ $t("menu.datasources") }}
        </a-menu-item>
        <a-menu-item key="rules">
          {{ $t("menu.rules") }}
        </a-menu-item>
        <a-menu-item key="data">
          {{ $t("menu.data") }}
        </a-menu-item>
        <a-menu-item key="checkcheck">
          {{ $t("menu.checkcheck") }}
        </a-menu-item>
        <a-menu-item key="favorites">
          {{ $t("menu.favorites") }}
        </a-menu-item>
        <a-menu-item key="data_abandon">
          {{ $t("menu.data_abandon") }}
        </a-menu-item>
        <a-menu-item key="tracking">
          {{ $t("menu.tracking") }}
        </a-menu-item>
        <a-sub-menu key="analysis_group">
          <template #title>{{ $t("menu.analysis") }}</template>
          <a-menu-item key="analysis">
            {{ $t("menu.analysis_overview") }}
          </a-menu-item>
          <a-menu-item key="reddit_req_reports">
            {{ $t("menu.reddit_req") }}
          </a-menu-item>
        </a-sub-menu>
        <a-menu-item key="settings">
          {{ $t("menu.settings") }}
        </a-menu-item>
      </a-menu>
      <div class="lang-switch">
        <a-segmented
          size="small"
          :options="[
            { label: '中文', value: 'zh-CN' },
            { label: 'English', value: 'en-US' }
          ]"
          v-model:value="locale"
        />
      </div>
    </a-layout-sider>

    <a-layout>
      <a-layout-header class="app-header">
        <div class="header-left">
          <a-button
            v-if="isMobile"
            type="text"
            class="menu-toggle"
            @click="mobileMenuVisible = true"
          >
            ☰
          </a-button>
          <div class="header-title">{{ currentTitle }}</div>
        </div>
      </a-layout-header>

      <a-layout-content class="app-content">
        <router-view />
      </a-layout-content>
    </a-layout>

    <!-- 移动端抽屉菜单 -->
    <a-drawer
      v-if="isMobile"
      v-model:open="mobileMenuVisible"
      placement="left"
      :width="260"
      title="StarNose"
    >
      <a-menu
        mode="inline"
        :selected-keys="[selectedKey]"
        :open-keys="openKeys"
        @click="onMobileMenuClick"
        @openChange="onOpenChange"
      >
        <a-menu-item key="datasources">
          {{ $t("menu.datasources") }}
        </a-menu-item>
        <a-menu-item key="rules">
          {{ $t("menu.rules") }}
        </a-menu-item>
        <a-menu-item key="data">
          {{ $t("menu.data") }}
        </a-menu-item>
        <a-menu-item key="checkcheck">
          {{ $t("menu.checkcheck") }}
        </a-menu-item>
        <a-menu-item key="favorites">
          {{ $t("menu.favorites") }}
        </a-menu-item>
        <a-menu-item key="data_abandon">
          {{ $t("menu.data_abandon") }}
        </a-menu-item>
        <a-menu-item key="tracking">
          {{ $t("menu.tracking") }}
        </a-menu-item>
        <a-sub-menu key="analysis_group">
          <template #title>{{ $t("menu.analysis") }}</template>
          <a-menu-item key="analysis">
            {{ $t("menu.analysis_overview") }}
          </a-menu-item>
          <a-menu-item key="reddit_req_reports">
            {{ $t("menu.reddit_req") }}
          </a-menu-item>
        </a-sub-menu>
        <a-menu-item key="settings">
          {{ $t("menu.settings") }}
        </a-menu-item>
      </a-menu>
      <div class="lang-switch lang-switch--mobile">
        <a-segmented
          size="small"
          :options="[
            { label: '中文', value: 'zh-CN' },
            { label: 'English', value: 'en-US' }
          ]"
          v-model:value="locale"
        />
      </div>
    </a-drawer>
  </a-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

const router = useRouter();
const route = useRoute();
const { t, locale } = useI18n();

const selectedKey = computed(() => {
  const name = (route.name as string) || "datasources";
  if (name === "reddit_req_report_detail") {
    return "reddit_req_reports";
  }
  return name;
});
const openKeys = computed(() => {
  const name = route.name as string;
  if (name === "analysis" || name === "reddit_req_reports" || name === "reddit_req_report_detail") {
    return ["analysis_group"];
  }
  return [];
});

const isMobile = ref(false);
const mobileMenuVisible = ref(false);

const currentTitle = computed(() => {
  switch (route.name) {
    case "datasources":
      return t("menu.datasources");
    case "rules":
      return t("menu.rules");
    case "data":
      return t("menu.data");
    case "checkcheck":
      return t("menu.checkcheck");
    case "favorites":
      return t("menu.favorites");
    case "data_abandon":
      return t("menu.data_abandon");
    case "tracking":
      return t("menu.tracking");
    case "analysis":
      return t("menu.analysis");
    case "reddit_req_reports":
      return t("menu.reddit_req");
    case "reddit_req_report_detail":
      return t("menu.reddit_req");
    case "settings":
      return t("menu.settings");
    default:
      return "StarNose";
  }
});

function onMenuClick(info: { key: string }) {
  router.push({ name: info.key });
}

function onMobileMenuClick(info: { key: string }) {
  mobileMenuVisible.value = false;
  router.push({ name: info.key });
}

function onOpenChange(_keys: string[]) {
  // 受控模式下由路由决定展开项，这里保留事件以避免菜单警告
}

function updateIsMobile() {
  if (typeof window === "undefined") return;
  isMobile.value = window.innerWidth <= 768;
}

let resizeHandler: (() => void) | null = null;

onMounted(() => {
  updateIsMobile();
  resizeHandler = () => updateIsMobile();
  window.addEventListener("resize", resizeHandler);
});

onBeforeUnmount(() => {
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
  }
});
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
}

.app-sider {
  border-right: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
}

.logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 18px;
  color: #1677ff;
  border-bottom: 1px solid #f0f0f0;
}

.app-header {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  padding-inline: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-toggle {
  padding: 0;
  font-size: 20px;
}

.header-title {
  font-size: 18px;
  font-weight: 500;
}

.app-content {
  margin: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  height: calc(100vh - 64px - 32px);
  overflow: auto;
}

.lang-switch {
  padding: 12px 16px;
  margin-top: auto;
}

.lang-switch--mobile {
  margin-top: 16px;
  padding: 0;
}

@media (max-width: 768px) {
  .app-layout {
    height: 100vh;
    overflow: hidden;
  }

  .app-content {
    margin: 8px;
    padding: 8px;
    height: auto;
  }
}
</style>
