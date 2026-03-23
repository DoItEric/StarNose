<template>
  <div>
    <div class="page-header">
      <h2>reddit需求</h2>
    </div>

    <a-card>
      <div class="list-toolbar">
        <a-space wrap align="center">
          <span class="toolbar-label">生成时间</span>
          <a-range-picker
            v-model:value="generatedRange"
            show-time
            style="width: min(100%, 360px)"
          />
          <a-button type="primary" :loading="loading" @click="loadReports">查询</a-button>
          <a-button @click="clearRange">清空</a-button>
        </a-space>
      </div>

      <a-table
        :columns="columns"
        :data-source="reports"
        row-key="id"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 'max-content' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'generatedAt'">
            {{ record.generatedAt ? formatUtcToBeijing(record.generatedAt) : "—" }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" @click="openDetail(record.id)">查看</a-button>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import type { Dayjs } from "dayjs";
import { http } from "@/api/http";
import { formatUtcToBeijing } from "@/utils/time";

interface ReportItem {
  id: string;
  generatedAt: string | null;
}

const router = useRouter();
const loading = ref(false);
const reports = ref<ReportItem[]>([]);
const generatedRange = ref<[Dayjs, Dayjs] | null>(null);

const columns = [
  { title: "报告ID", dataIndex: "id", key: "id" },
  { title: "生成时间", dataIndex: "generatedAt", key: "generatedAt" },
  { title: "操作", key: "action", width: 100 }
];

async function loadReports() {
  loading.value = true;
  try {
    const params: Record<string, string> = {};
    if (generatedRange.value?.[0] && generatedRange.value?.[1]) {
      params.generatedFrom = generatedRange.value[0].toISOString();
      params.generatedTo = generatedRange.value[1].toISOString();
    }
    const { data } = await http.get("/reports/reddit-req", { params });
    reports.value = (data.items ?? []) as ReportItem[];
  } finally {
    loading.value = false;
  }
}

function clearRange() {
  generatedRange.value = null;
  void loadReports();
}

function openDetail(reportId: string) {
  router.push({ name: "reddit_req_report_detail", params: { reportId } });
}

onMounted(() => {
  void loadReports();
});
</script>

<style scoped>
.page-header {
  margin-bottom: 12px;
}

.list-toolbar {
  margin-bottom: 12px;
}

.toolbar-label {
  color: rgba(0, 0, 0, 0.65);
  white-space: nowrap;
}
</style>
