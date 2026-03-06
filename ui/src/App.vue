<template>
  <a-layout class="app-layout">
    <a-layout-sider theme="light" width="220" class="app-sider">
      <div class="logo">StarNose</div>
      <a-menu
        mode="inline"
        :selected-keys="[selectedKey]"
        @click="onMenuClick"
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
        <a-menu-item key="tracking">
          {{ $t("menu.tracking") }}
        </a-menu-item>
        <a-menu-item key="analysis">
          {{ $t("menu.analysis") }}
        </a-menu-item>
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
        <div class="header-title">{{ currentTitle }}</div>
      </a-layout-header>
      <a-layout-content class="app-content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

const router = useRouter();
const route = useRoute();
const { t, locale } = useI18n();

const selectedKey = computed(() => (route.name as string) || "datasources");

const currentTitle = computed(() => {
  switch (route.name) {
    case "datasources":
      return t("menu.datasources");
    case "rules":
      return t("menu.rules");
    case "data":
      return t("menu.data");
    case "tracking":
      return t("menu.tracking");
    case "analysis":
      return t("menu.analysis");
    case "settings":
      return t("menu.settings");
    default:
      return "StarNose";
  }
});

function onMenuClick(info: { key: string }) {
  router.push({ name: info.key });
}
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
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
  padding-inline: 24px;
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
}

.lang-switch {
  padding: 12px 16px;
  margin-top: auto;
}
</style>
