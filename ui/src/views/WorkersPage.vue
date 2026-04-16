<template>
  <div class="workers-page">
    <div class="page-header">
      <h2>Worker 调度管理</h2>
      <a-button type="primary" @click="openCreate">新增调度</a-button>
    </div>

    <a-table
      :columns="scheduleColumns"
      :data-source="schedules"
      :pagination="false"
      row-key="id"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'enabled'">
          <a-switch
            :checked="record.enabled"
            @change="(val: boolean) => toggleSchedule(record, val)"
          />
        </template>
        <template v-else-if="column.key === 'config'">
          <span class="cell-ellipsis" :title="JSON.stringify(record.config)">
            {{ JSON.stringify(record.config) }}
          </span>
        </template>
        <template v-else-if="column.key === 'action'">
          <a @click.stop="openEdit(record)">编辑</a>
          <a-divider type="vertical" />
          <a-popconfirm
            title="确定删除该调度配置？"
            ok-text="删除"
            cancel-text="取消"
            @confirm="() => deleteSchedule(record)"
          >
            <a style="color: #ff4d4f">删除</a>
          </a-popconfirm>
        </template>
      </template>
    </a-table>

    <h3 style="margin-top: 24px">运行日志</h3>
    <a-table
      :columns="logColumns"
      :data-source="runLogs"
      :pagination="false"
      row-key="id"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 'success' ? 'green' : record.status === 'running' ? 'blue' : 'red'">
            {{ record.status }}
          </a-tag>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="modalVisible"
      :title="editId ? '编辑调度' : '新增调度'"
      @ok="submitSchedule"
    >
      <a-form layout="vertical">
        <a-form-item label="名称">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item label="Worker Kind">
          <a-select v-model:value="form.workerKind">
            <a-select-option value="cron">cron</a-select-option>
            <a-select-option value="ingest">ingest</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Worker Type">
          <a-input v-model:value="form.workerType" placeholder="如 reddit" />
        </a-form-item>
        <a-form-item label="Source ID">
          <a-input v-model:value="form.sourceId" />
        </a-form-item>
        <a-form-item label="Config (JSON)">
          <a-textarea v-model:value="form.configJson" :rows="3" placeholder='{"interval_seconds": 600}' />
        </a-form-item>
        <a-form-item label="Fetch Config (JSON)">
          <a-textarea v-model:value="form.fetchConfigJson" :rows="3" placeholder="{}" />
        </a-form-item>
        <a-form-item label="最大并发实例">
          <a-input-number v-model:value="form.maxInstances" :min="1" style="width: 100%" />
        </a-form-item>
        <a-form-item label="超时秒数">
          <a-input-number v-model:value="form.timeoutSeconds" :min="1" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { message } from "ant-design-vue";
import { http } from "@/api/http";

interface Schedule {
  id: string;
  name: string;
  workerKind: string;
  workerType: string;
  enabled: boolean;
  sourceId: string;
  config: Record<string, unknown>;
  fetchConfig: Record<string, unknown>;
  maxInstances: number;
  timeoutSeconds: number;
  lastRunAt?: string;
  lastStatus?: string;
  runCount: number;
}

interface RunLog {
  id: string;
  scheduleId: string;
  workerKind: string;
  workerType: string;
  startedAt: string;
  finishedAt?: string;
  status: string;
  itemsCount: number;
  elapsedMs: number;
  error?: string;
}

const scheduleColumns = [
  { title: "名称", dataIndex: "name", key: "name" },
  { title: "Kind", dataIndex: "workerKind", key: "workerKind", width: 80 },
  { title: "Type", dataIndex: "workerType", key: "workerType", width: 100 },
  { title: "Source", dataIndex: "sourceId", key: "sourceId", width: 120 },
  { title: "启用", key: "enabled", width: 80 },
  { title: "Config", key: "config", ellipsis: true },
  { title: "上次运行", dataIndex: "lastRunAt", key: "lastRunAt", width: 160 },
  { title: "状态", dataIndex: "lastStatus", key: "lastStatus", width: 80 },
  { title: "运行次数", dataIndex: "runCount", key: "runCount", width: 80 },
  { title: "操作", key: "action", width: 120 },
];

const logColumns = [
  { title: "Worker Type", dataIndex: "workerType", key: "workerType" },
  { title: "状态", key: "status", width: 100 },
  { title: "开始时间", dataIndex: "startedAt", key: "startedAt" },
  { title: "结束时间", dataIndex: "finishedAt", key: "finishedAt" },
  { title: "条目数", dataIndex: "itemsCount", key: "itemsCount", width: 80 },
  { title: "耗时(ms)", dataIndex: "elapsedMs", key: "elapsedMs", width: 100 },
  { title: "错误", dataIndex: "error", key: "error", ellipsis: true },
];

const schedules = ref<Schedule[]>([]);
const runLogs = ref<RunLog[]>([]);
const modalVisible = ref(false);
const editId = ref<string | null>(null);

const form = ref({
  name: "",
  workerKind: "cron",
  workerType: "",
  sourceId: "",
  configJson: "{}",
  fetchConfigJson: "{}",
  maxInstances: 10,
  timeoutSeconds: 300,
});

async function loadSchedules() {
  try {
    const resp = await http.get("/workers/schedules");
    schedules.value = resp.data.items ?? [];
  } catch {
    schedules.value = [];
  }
}

async function loadRunLogs() {
  try {
    const resp = await http.get("/workers/run-logs", { params: { limit: 50 } });
    runLogs.value = resp.data.items ?? [];
  } catch {
    runLogs.value = [];
  }
}

function openCreate() {
  editId.value = null;
  form.value = {
    name: "",
    workerKind: "cron",
    workerType: "",
    sourceId: "",
    configJson: "{}",
    fetchConfigJson: "{}",
    maxInstances: 10,
    timeoutSeconds: 300,
  };
  modalVisible.value = true;
}

function openEdit(record: Schedule) {
  editId.value = record.id;
  form.value = {
    name: record.name,
    workerKind: record.workerKind,
    workerType: record.workerType,
    sourceId: record.sourceId,
    configJson: JSON.stringify(record.config ?? {}, null, 2),
    fetchConfigJson: JSON.stringify(record.fetchConfig ?? {}, null, 2),
    maxInstances: record.maxInstances,
    timeoutSeconds: record.timeoutSeconds,
  };
  modalVisible.value = true;
}

async function submitSchedule() {
  let config: Record<string, unknown> = {};
  let fetchConfig: Record<string, unknown> = {};
  try {
    config = JSON.parse(form.value.configJson);
  } catch {
    message.error("Config JSON 格式错误");
    return;
  }
  try {
    fetchConfig = JSON.parse(form.value.fetchConfigJson);
  } catch {
    message.error("Fetch Config JSON 格式错误");
    return;
  }

  const payload: Record<string, unknown> = {
    name: form.value.name,
    workerKind: form.value.workerKind,
    workerType: form.value.workerType,
    sourceId: form.value.sourceId,
    config,
    fetchConfig,
    maxInstances: form.value.maxInstances,
    timeoutSeconds: form.value.timeoutSeconds,
  };
  if (editId.value) payload.id = editId.value;

  try {
    await http.post("/workers/schedules", payload);
    modalVisible.value = false;
    await loadSchedules();
  } catch {
    message.error("保存失败");
  }
}

async function toggleSchedule(record: Schedule, enabled: boolean) {
  try {
    await http.post(`/workers/schedules/${record.id}/toggle`, { enabled });
    record.enabled = enabled;
  } catch {
    message.error("切换失败");
  }
}

async function deleteSchedule(record: Schedule) {
  try {
    await http.delete(`/workers/schedules/${record.id}`);
    await loadSchedules();
  } catch {
    message.error("删除失败");
  }
}

onMounted(() => {
  void loadSchedules();
  void loadRunLogs();
});
</script>

<style scoped>
.workers-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.cell-ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}
</style>
