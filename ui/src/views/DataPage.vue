<template>
  <div>
    <div class="page-header">
      <h2>数据</h2>
    </div>

    <a-form layout="inline" class="filter-form">
      <a-form-item label="抓取时间">
        <a-range-picker v-model:value="filters.crawlRange" show-time />
      </a-form-item>
      <a-form-item label="发布时间">
        <a-range-picker v-model:value="filters.publishRange" show-time />
      </a-form-item>
      <a-form-item label="数据源">
        <a-select
          v-model:value="filters.plugins"
          mode="multiple"
          style="min-width: 160px"
        >
          <a-select-option value="twitter">Twitter</a-select-option>
          <a-select-option value="rss">RSS</a-select-option>
          <a-select-option value="reddit">Reddit</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="查阅状态">
        <a-select v-model:value="filters.readStatus" style="width: 120px">
          <a-select-option value="all">全部</a-select-option>
          <a-select-option value="read">已阅</a-select-option>
          <a-select-option value="unread">未阅</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="关键字">
        <a-input
          v-model:value="filters.keyword"
          placeholder="标题/正文关键字"
          style="width: 220px"
        />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" @click="search">查询</a-button>
      </a-form-item>
    </a-form>

    <a-table
      :columns="columns"
      :data-source="dataSource"
      :pagination="{ pageSize: 100 }"
      row-key="id"
      @row-click="openDetail"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'track'">
          <a-button type="link" size="small">跟踪</a-button>
        </template>
        <template v-else-if="column.key === 'readStatus'">
          <a-tag :color="record.read ? 'green' : 'blue'">
            {{ record.read ? "已阅" : "未阅" }}
          </a-tag>
        </template>
        <template v-else>
          {{ record[column.dataIndex] }}
        </template>
      </template>
    </a-table>

    <a-drawer
      v-model:open="detailVisible"
      title="数据详情"
      placement="right"
      width="480"
    >
      <pre v-if="currentRecord">
{{ JSON.stringify(currentRecord, null, 2) }}
      </pre>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { Dayjs } from "dayjs";
import { http } from "@/api/http";

interface DataItem {
  id: string;
  ruleId: string;
  source: string;
  title: string;
  content: string;
  keywords: string[];
  crawlTime: string;
  publishTime?: string;
  read: boolean;
}

const filters = ref<{
  crawlRange: [Dayjs, Dayjs] | null;
  publishRange: [Dayjs, Dayjs] | null;
  plugins: string[];
  readStatus: "all" | "read" | "unread";
  keyword: string;
}>({
  crawlRange: null,
  publishRange: null,
  plugins: [],
  readStatus: "all",
  keyword: ""
});

const columns = [
  { title: "规则 ID", dataIndex: "ruleId", key: "ruleId" },
  { title: "数据源", dataIndex: "source", key: "source" },
  { title: "标题", dataIndex: "title", key: "title", ellipsis: true },
  {
    title: "关键字",
    dataIndex: "keywords",
    key: "keywords",
    ellipsis: true
  },
  { title: "抓取时间", dataIndex: "crawlTime", key: "crawlTime" },
  { title: "发布时间", dataIndex: "publishTime", key: "publishTime" },
  { title: "查阅状态", dataIndex: "readStatus", key: "readStatus" },
  { title: "操作", key: "track" }
];

const dataSource = ref<DataItem[]>([]);

const detailVisible = ref(false);
const currentRecord = ref<DataItem | null>(null);

async function search() {
  const params: Record<string, unknown> = {};

  if (filters.value.crawlRange) {
    params.crawlTimeFrom = filters.value.crawlRange[0].toISOString();
    params.crawlTimeTo = filters.value.crawlRange[1].toISOString();
  }
  if (filters.value.publishRange) {
    params.publishTimeFrom = filters.value.publishRange[0].toISOString();
    params.publishTimeTo = filters.value.publishRange[1].toISOString();
  }
  if (filters.value.plugins.length > 0) {
    params.sources = filters.value.plugins;
  }
  if (filters.value.readStatus !== "all") {
    params.readStatus = filters.value.readStatus;
  }
  if (filters.value.keyword) {
    params.keyword = filters.value.keyword;
  }

  const resp = await http.get("/data", { params });

  const rows = (resp.data.items ?? []) as any[];
  dataSource.value = rows.map((r) => ({
    id: r.id,
    ruleId: r.ruleId,
    source: r.source,
    title: r.title,
    content: r.content,
    keywords: r.keywords,
    crawlTime: r.crawlTime,
    publishTime: r.publishTime,
    read: r.read
  }));
}

function openDetail(record: DataItem) {
  currentRecord.value = record;
  detailVisible.value = true;
}
</script>

<style scoped>
.page-header {
  margin-bottom: 16px;
}

.filter-form {
  margin-bottom: 16px;
  row-gap: 12px;
}
</style>

