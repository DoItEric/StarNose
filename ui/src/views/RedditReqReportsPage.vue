<template>
  <div>
    <div class="page-header">
      <h2>reddit需求</h2>
    </div>

    <a-card>
      <a-table
        :columns="columns"
        :data-source="reports"
        row-key="id"
        :loading="loading"
        :pagination="false"
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
import { http } from "@/api/http";
import { formatUtcToBeijing } from "@/utils/time";

interface ReportItem {
  id: string;
  generatedAt: string | null;
}

const router = useRouter();
const loading = ref(false);
const reports = ref<ReportItem[]>([]);

const columns = [
  { title: "报告ID", dataIndex: "id", key: "id" },
  { title: "生成时间", dataIndex: "generatedAt", key: "generatedAt" },
  { title: "操作", key: "action", width: 100 }
];

async function loadReports() {
  loading.value = true;
  try {
    const { data } = await http.get("/reports/reddit-req");
    reports.value = (data.items ?? []) as ReportItem[];
  } finally {
    loading.value = false;
  }
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
</style>
