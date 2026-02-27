<template>
  <div>
    <div class="page-header">
      <h2>{{ $t("datasource.title") }}</h2>
    </div>
    <a-row :gutter="[16, 16]">
      <a-col
        v-for="plugin in plugins"
        :key="plugin.id"
        :xs="24"
        :sm="12"
        :md="8"
        :lg="6"
      >
        <a-card :title="plugin.name" hoverable>
          <template #extra>
            <a-switch
              :checked="plugin.enabled !== false"
              @change="(checked: boolean) => togglePlugin(plugin, checked)"
            />
          </template>
          <p>{{ plugin.description }}</p>
          <p v-if="plugin.lastRunAt" style="font-size: 12px; color: #999">
            最后调用时间：{{ plugin.lastRunAt }}
          </p>
          <template #actions>
            <a @click="openSetting(plugin)">
              {{ $t("datasource.setting") }}
            </a>
            <a @click="openHistory(plugin)">
              {{ $t("datasource.history") }}
            </a>
            <a @click="callPlugin(plugin)">
              调用
            </a>
          </template>
        </a-card>
      </a-col>
    </a-row>

    <a-modal
      v-model:open="settingVisible"
      :title="currentPlugin?.name"
      @ok="saveCron"
      @cancel="closeSetting"
    >
      <a-form layout="vertical">
        <a-form-item label="CRON 表达式">
          <a-input
            v-model:value="cron"
            :placeholder="$t('datasource.cronPlaceholder')"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="historyVisible"
      :title="$t('datasource.historyTitle')"
      :footer="null"
      width="640px"
    >
      <a-table
        :columns="historyColumns"
        :data-source="history"
        :pagination="false"
        row-key="id"
        size="small"
      />
      <div style="margin-top: 8px; text-align: right; font-size: 12px">
        {{ $t("datasource.last10") }}
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { http } from "@/api/http";

interface Plugin {
  id?: string;
  key: string;
  name: string;
  description: string;
  enabled?: boolean;
  lastRunAt?: string | null;
}

interface HistoryItem {
  id: string;
  startedAt: string;
  finishedAt?: string;
  success: boolean;
  totalCount: number;
  matchedCount: number;
}

const plugins = ref<Plugin[]>([]);

async function loadPlugins() {
  const resp = await http.get("/plugins");
  plugins.value = resp.data.items ?? [];
}

onMounted(() => {
  void loadPlugins();
});

const historyColumns = [
  { title: "开始时间", dataIndex: "startedAt", key: "startedAt" },
  {
    title: "状态",
    dataIndex: "success",
    key: "success",
    customRender: ({ value }: { value: boolean }) => (value ? "成功" : "失败")
  },
  { title: "总数据量", dataIndex: "totalCount", key: "totalCount" },
  { title: "匹配规则数量", dataIndex: "matchedCount", key: "matchedCount" }
];

const settingVisible = ref(false);
const historyVisible = ref(false);
const currentPlugin = ref<Plugin | null>(null);
const cron = ref("");
const history = ref<HistoryItem[]>([]);

async function callPlugin(plugin: Plugin) {
  const resp = await http.post(`/plugins/${plugin.key}/call`);
  plugin.lastRunAt = resp.data.lastRunAt ?? plugin.lastRunAt;
}

async function togglePlugin(plugin: Plugin, enabled: boolean) {
  await http.post(`/plugins/${plugin.key}/enabled`, { enabled });
  plugin.enabled = enabled;
}

function openSetting(plugin: Plugin) {
  currentPlugin.value = plugin;
  settingVisible.value = true;
}

function closeSetting() {
  settingVisible.value = false;
}

async function saveCron() {
  if (!currentPlugin.value) return;
  await http.post(`/plugins/${currentPlugin.value.key}/schedule`, {
    pluginKey: currentPlugin.value.key,
    cron: cron.value
  });
  settingVisible.value = false;
}

async function openHistory(plugin: Plugin) {
  currentPlugin.value = plugin;
  const resp = await http.get(`/plugins/${plugin.key}/history`);
  history.value = resp.data.items ?? [];
  historyVisible.value = true;
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
</style>

