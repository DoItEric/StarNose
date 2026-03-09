<template>
  <div>
    <div class="page-header">
      <div class="page-header__row">
        <h2>跟踪</h2>
        <a-space>
          <span class="toolbar-label">每页</span>
          <a-select
            v-model:value="pagination.pageSize"
            style="width: 110px"
            @change="onPageSizeChange"
          >
            <a-select-option :value="50">50</a-select-option>
            <a-select-option :value="100">100</a-select-option>
            <a-select-option :value="200">200</a-select-option>
            <a-select-option :value="500">500</a-select-option>
          </a-select>
          <a-segmented
            v-model:value="viewMode"
            :options="[
              { label: '列表', value: 'table' },
              { label: '卡片', value: 'card' }
            ]"
          />
        </a-space>
      </div>
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
          <a-select-option value="ignored">忽略</a-select-option>
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
        <a-button type="primary" @click="() => search(true)">查询</a-button>
      </a-form-item>
    </a-form>

    <a-table
      v-if="viewMode === 'table'"
      :columns="columns"
      :data-source="dataSource"
      :pagination="tablePagination"
      row-key="id"
      @change="onTableChange"
      @row-click="openDetail"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'title'">
          <a
            v-if="record.url"
            :href="record.url"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
          >
            {{ record.title }}
          </a>
          <template v-else>
            {{ record.title }}
          </template>
        </template>
        <template v-else-if="column.key === 'track'">
          <a-space>
            <a-button
              type="link"
              size="small"
              :disabled="!record.url"
              @click.stop="openPage(record)"
            >
              打开页面
            </a-button>
            <a-button
              type="link"
              size="small"
              :disabled="record.read === 1 || record.read === -1"
              @click.stop="ignoreItem(record)"
            >
              忽略
            </a-button>
            <a-button type="link" size="small" @click.stop="toggleTracking(record)">
              {{ record.tracking ? "取消跟踪" : "跟踪" }}
            </a-button>
          </a-space>
        </template>
        <template v-else-if="column.key === 'readStatus'">
          <a-tag :color="readStatusColor(record.read)">
            {{ readStatusText(record.read) }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'trackData'">
          {{ formatTrackData(record) }}
        </template>
        <template v-else>
          {{ record[column.dataIndex] }}
        </template>
      </template>
    </a-table>

    <div v-else class="card-view">
      <a-row :gutter="[12, 12]">
        <a-col v-for="item in dataSource" :key="item.id" :xs="24" :sm="12" :lg="8">
          <a-card
            class="data-card"
            size="small"
            hoverable
            @click="openCard(item)"
          >
            <template #title>
              <a
                v-if="item.url"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
                @click.stop
              >
                {{ item.title }}
              </a>
              <template v-else>{{ item.title }}</template>
            </template>

            <div class="data-card__meta">
              <a-tag :color="readStatusColor(item.read)">
                {{ readStatusText(item.read) }}
              </a-tag>
              <span class="muted">{{ item.source }}</span>
              <span class="muted">抓取：{{ formatUtcToBeijing(item.crawlTime) }}</span>
              <span v-if="item.publishTime" class="muted">
                发布：{{ formatUtcToBeijing(item.publishTime) }}
              </span>
            </div>

            <div v-if="item.summary" class="data-card__summary">
              {{ item.summary }}
            </div>

            <div v-if="item.hotWords" class="data-card__hotwords">
              <span class="muted">热词：</span>{{ item.hotWords }}
            </div>

            <div v-if="item.keywords?.length" class="data-card__keywords">
              <span class="muted">关键字：</span>{{ item.keywords.join(", ") }}
            </div>

            <template #actions>
              <span @click.stop="openPage(item)">打开</span>
              <span
                v-if="item.read !== 1 && item.read !== -1"
                @click.stop="ignoreItem(item)"
              >忽略</span>
              <span @click.stop="toggleTracking(item)">
                {{ item.tracking ? "取消跟踪" : "跟踪" }}
              </span>
            </template>
          </a-card>
        </a-col>
      </a-row>

      <div class="card-view__pager">
        <a-pagination
          :current="pagination.page"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          :show-size-changer="true"
          :page-size-options="['50', '100', '200', '500']"
          show-less-items
          @change="onPageChange"
          @showSizeChange="onPaginationShowSizeChange"
        />
      </div>
    </div>

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
import { computed, onMounted, ref, watch } from "vue";
import type { Dayjs } from "dayjs";
import { http } from "@/api/http";
import { formatUtcToBeijing } from "@/utils/time";

interface DataItem {
  id: string;
  ruleId: string;
  source: string;
  title: string;
  content: string;
  url?: string;
  keywords: string[];
  tracking: boolean;
  crawlTime: string;
  publishTime?: string;
  summary?: string;
  hotWords?: string;
  read: number;
  trackData?: Record<string, unknown>;
}

const filters = ref<{
  crawlRange: [Dayjs, Dayjs] | null;
  publishRange: [Dayjs, Dayjs] | null;
  plugins: string[];
  readStatus: "all" | "read" | "unread" | "ignored";
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
  { title: "描述", dataIndex: "summary", key: "summary", ellipsis: true },
  { title: "热词", dataIndex: "hotWords", key: "hotWords", ellipsis: true },
  {
    title: "关键字",
    dataIndex: "keywords",
    key: "keywords",
    ellipsis: true
  },
  { title: "抓取时间", dataIndex: "crawlTime", key: "crawlTime" },
  { title: "发布时间", dataIndex: "publishTime", key: "publishTime" },
  { title: "查阅状态", dataIndex: "readStatus", key: "readStatus" },
  { title: "跟踪数据", dataIndex: "trackData", key: "trackData", width: 100 },
  { title: "操作", key: "track" }
];

const dataSource = ref<DataItem[]>([]);

const viewMode = ref<"table" | "card">("card");
const pagination = ref<{ page: number; pageSize: number; total: number }>({
  page: 1,
  pageSize: 100,
  total: 0
});

const tablePagination = computed(() => ({
  current: pagination.value.page,
  pageSize: pagination.value.pageSize,
  total: pagination.value.total,
  showSizeChanger: true,
  pageSizeOptions: ["50", "100", "200", "500"],
  showTotal: (t: number) => `共 ${t} 条`
}));

const detailVisible = ref(false);
const currentRecord = ref<DataItem | null>(null);

async function search(resetPage = false) {
  if (resetPage) pagination.value.page = 1;
  const params: Record<string, unknown> = { trackingOnly: true };

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

  params.page = pagination.value.page;
  params.pageSize = pagination.value.pageSize;

  const resp = await http.get("/data", { params });

  const rows = (resp.data.items ?? []) as any[];
  dataSource.value = rows.map((r) => ({
    id: r.id,
    ruleId: r.ruleId,
    source: r.source,
    title: r.title,
    content: r.content,
    url: r.url,
    keywords: r.keywords,
    tracking: !!r.tracking,
    crawlTime: r.crawlTime,
    publishTime: r.publishTime,
    summary: r.summary,
    hotWords: r.hotWords,
    read: typeof r.read === "number" ? r.read : r.read ? 1 : 0,
    trackData: r.trackData
  }));
  pagination.value.total = Number(resp.data.total ?? 0);
}

function readStatusText(read: number): string {
  if (read === -1) return "忽略";
  if (read === 1) return "已阅";
  return "未阅";
}
function readStatusColor(read: number): string {
  if (read === -1) return "default";
  if (read === 1) return "green";
  return "blue";
}
function formatTrackData(record: DataItem): string {
  const d = record.trackData;
  if (!d || typeof d !== "object") return "—";
  if (record.source === "reddit") {
    const ups = (d as any).ups;
    const num = (d as any).num_comments;
    if (ups != null || num != null) return `↑ ${ups ?? "—"} · 💬 ${num ?? "—"}`;
  }
  return Object.keys(d).length ? JSON.stringify(d) : "—";
}

async function markRead(id: string, read: boolean | number) {
  await http.post("/data/read", { id, read });
}

async function setTracking(id: string, tracking: boolean) {
  await http.post("/data/track", { id, tracking });
}

async function openPage(record: DataItem) {
  if (!record.url) return;
  window.open(record.url, "_blank", "noopener,noreferrer");
  if (record.read !== 1) {
    await markRead(record.id, 1);
    record.read = 1;
  }
}

async function ignoreItem(record: DataItem) {
  if (record.read === 1 || record.read === -1) return;
  await markRead(record.id, -1);
  record.read = -1;
}

async function toggleTracking(record: DataItem) {
  const next = !record.tracking;
  await setTracking(record.id, next);
  record.tracking = next;
  if (!next) {
    void search(false);
  }
}

function openCard(record: DataItem) {
  if (record.url) {
    void openPage(record);
  } else {
    openDetail(record);
  }
}

function onPageChange(page: number) {
  pagination.value.page = page;
  void search(false);
}

function onPaginationShowSizeChange(_current: number, size: number) {
  pagination.value.pageSize = size;
  pagination.value.page = 1;
  void search(false);
}

function onPageSizeChange() {
  pagination.value.page = 1;
  void search(false);
}

function onTableChange(pag: any) {
  pagination.value.page = pag?.current ?? 1;
  pagination.value.pageSize = pag?.pageSize ?? pagination.value.pageSize;
  void search(false);
}

function openDetail(record: DataItem) {
  currentRecord.value = record;
  detailVisible.value = true;
}

watch(
  () => filters.value.readStatus,
  () => {
    void search(true);
  }
);

onMounted(() => {
  void search(true);
});
</script>

<style scoped>
.page-header {
  margin-bottom: 16px;
}

.page-header__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar-label {
  color: rgba(0, 0, 0, 0.65);
}

.filter-form {
  margin-bottom: 16px;
  row-gap: 12px;
}

.card-view__pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.data-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.muted {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
}

.data-card__summary {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 8px 0;
}

.data-card__hotwords {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 8px 0;
  font-size: 12px;
}

.data-card__keywords {
  margin-top: 8px;
  font-size: 12px;
}
</style>

