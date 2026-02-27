<template>
  <div>
    <div class="page-header">
      <h2>分析</h2>
    </div>

    <a-form layout="inline" class="filter-form">
      <a-form-item label="抓取时间">
        <a-range-picker v-model:value="filters.crawlRange" show-time />
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
      <a-form-item>
        <a-button type="primary" @click="fetchAnalysis">分析</a-button>
      </a-form-item>
    </a-form>

    <a-row :gutter="16">
      <a-col :xs="24" :lg="12">
        <a-card title="词云">
          <!-- 这里预留给前端词云组件（如 echarts-wordcloud），暂用列表占位 -->
          <ul class="word-list">
            <li v-for="word in wordCloud" :key="word.word">
              <span>{{ word.word }}</span>
              <span class="count">{{ word.count }}</span>
            </li>
          </ul>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card title="热点数据清单（自高而低）">
          <a-table
            :columns="hotColumns"
            :data-source="hotList"
            :pagination="false"
            size="small"
            row-key="id"
          />
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { Dayjs } from "dayjs";
import { http } from "@/api/http";

interface WordCloudItem {
  word: string;
  count: number;
}

interface HotItem {
  id: string;
  title: string;
  score: number;
}

const filters = ref<{
  crawlRange: [Dayjs, Dayjs] | null;
  plugins: string[];
}>({
  crawlRange: null,
  plugins: []
});

const wordCloud = ref<WordCloudItem[]>([]);
const hotList = ref<HotItem[]>([]);

const hotColumns = [
  { title: "标题", dataIndex: "title", key: "title", ellipsis: true },
  { title: "热度", dataIndex: "score", key: "score" }
];

async function fetchAnalysis() {
  const params: Record<string, unknown> = {};

  if (filters.value.crawlRange) {
    params.crawlTimeFrom = filters.value.crawlRange[0].toISOString();
    params.crawlTimeTo = filters.value.crawlRange[1].toISOString();
  }
  if (filters.value.plugins.length > 0) {
    params.sources = filters.value.plugins;
  }

  const resp = await http.get("/analysis", { params });
  wordCloud.value = resp.data.wordCloud ?? [];
  hotList.value = resp.data.hotList ?? [];
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

.word-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.word-list li {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.count {
  color: #999;
}
</style>

