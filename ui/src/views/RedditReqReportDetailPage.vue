<template>
  <div class="report-page">
    <div class="page-header">
      <a-space>
        <a-button @click="goBack">返回列表</a-button>
        <h2 class="page-title">reddit需求报告：{{ reportId }}</h2>
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <template v-if="report">
        <a-row :gutter="12" class="overview-row">
          <a-col :xs="24" :md="8">
            <a-card size="small" title="生成时间">{{ report.overview?.generated_at ?? "—" }}</a-card>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-card size="small" title="数据时间范围">
              {{ report.overview?.start_date ?? "—" }} ~ {{ report.overview?.end_date ?? "—" }}
            </a-card>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-card size="small" title="数量">
              原始 {{ report.overview?.total_raw ?? 0 }} / 有效 {{ report.overview?.total_count ?? 0 }}
            </a-card>
          </a-col>
        </a-row>

        <a-card title="Analysis 结构图" class="section">
          <div class="analysis-toolbar">
            <a-space wrap>
              <a-select v-model:value="activeDimension" style="width: 220px">
                <a-select-option v-for="d in analysisNodes" :key="d.name" :value="d.name">
                  {{ d.name }}
                </a-select-option>
              </a-select>
              <a-button @click="expandAll">全展开</a-button>
              <a-button @click="collapseAll">合并到第一级</a-button>
              <span class="muted">滚轮缩放，按住鼠标左键拖动画布</span>
            </a-space>
          </div>
          <div
            class="canvas-shell"
            @wheel.prevent="onCanvasWheel"
            @mousedown="onCanvasDown"
            @mousemove="onCanvasMove"
            @mouseup="onCanvasUp"
            @mouseleave="onCanvasUp"
          >
            <div class="canvas-content" :style="canvasStyle">
              <a-tree
                v-if="treeData.length"
                :tree-data="treeData"
                :expanded-keys="expandedKeys"
                block-node
                @expand="onExpand"
              >
                <template #title="{ key, title, isLeaf, itemCount, item, nodeType }">
                  <div class="tree-node" :class="{ 'tree-node--pinned': isPinned(String(key)) }">
                    <span class="tree-title">{{ title }}</span>
                    <a-tag v-if="!isLeaf">{{ itemCount }}</a-tag>
                    <a-space size="small">
                      <a-button
                        size="small"
                        type="link"
                        @click.stop="togglePin(String(key))"
                      >
                        {{ isPinned(String(key)) ? "取消图钉" : "图钉" }}
                      </a-button>
                      <a-button
                        v-if="!isLeaf && nodeType !== 'leaf-group'"
                        size="small"
                        type="link"
                        @click.stop="markNodeRead(String(key))"
                      >
                        批量已读
                      </a-button>
                    </a-space>
                  </div>
                  <div v-if="isLeaf && item" class="leaf-card">
                    <div class="leaf-title">
                      <a :href="item.url" target="_blank" rel="noopener noreferrer">{{ item.title }}</a>
                    </div>
                    <div class="leaf-summary">{{ item.summary || item.content || "—" }}</div>
                    <div class="leaf-actions">
                      <a-button size="small" @click.stop="markItemRead(item)">已读</a-button>
                      <a-button size="small" @click.stop="toggleFavorite(item)">
                        {{ item.favorite ? "取消收藏" : "收藏" }}
                      </a-button>
                      <a-button size="small" @click.stop="toggleIgnore(item)">
                        {{ item.read === -1 ? "恢复已读" : "忽略" }}
                      </a-button>
                    </div>
                  </div>
                </template>
              </a-tree>
            </div>
          </div>
        </a-card>

        <a-card title="统计饼图" class="section">
          <a-row :gutter="[12, 12]">
            <a-col v-for="chart in pieCharts" :key="chart.title" :xs="24" :md="12" :lg="8">
              <a-card size="small" :title="chart.title">
                <div class="pie-wrap">
                  <div class="pie" :style="{ background: chart.css }" />
                  <div class="pie-legend">
                    <div v-for="item in chart.items" :key="item.name" class="pie-legend-item">
                      <span class="dot" :style="{ background: item.color }" />
                      <span>{{ item.name }}</span>
                      <span class="muted">{{ item.value }}</span>
                    </div>
                  </div>
                </div>
              </a-card>
            </a-col>
          </a-row>
        </a-card>

        <a-card title="WordCloud" class="section">
          <a-tabs>
            <a-tab-pane key="global" tab="全局词云">
              <div class="cloud-grid">
                <a-card v-for="(words, key) in report.word_cloud" :key="key" size="small" :title="key">
                  <WordCloudChart :words="words ?? []" :max-items="300" :height="260" />
                </a-card>
              </div>
            </a-tab-pane>
            <a-tab-pane key="analysis" tab="analysis词云">
              <a-collapse>
                <a-collapse-panel v-for="n in analysisNodes" :key="n.name" :header="n.name">
                  <div class="cloud-grid">
                    <a-card
                      v-for="(words, key) in n.word_cloud || {}"
                      :key="`${n.name}_${key}`"
                      size="small"
                      :title="key"
                    >
                      <WordCloudChart :words="words ?? []" :max-items="300" :height="260" />
                    </a-card>
                  </div>
                </a-collapse-panel>
              </a-collapse>
            </a-tab-pane>
          </a-tabs>
        </a-card>

        <a-card title="AI Summary" class="section">
          <div class="markdown-text markdown-body" v-html="renderedSummary" />
        </a-card>
      </template>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message } from "ant-design-vue";
import { http } from "@/api/http";
import MarkdownIt from "markdown-it";
import WordCloudChart from "@/components/WordCloudChart.vue";

interface WordItem {
  word: string;
  count: number;
}

interface ReportItem {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  url?: string;
  read?: number;
  favorite?: boolean;
}

interface AnalysisNode {
  name: string;
  data?: Array<AnalysisNode | ReportItem>;
  word_cloud?: Record<string, WordItem[]>;
}

interface ReportData {
  overview?: Record<string, unknown>;
  analysis?: AnalysisNode[];
  word_cloud?: Record<string, WordItem[]>;
  ai_summary?: string;
}

interface TreeNode {
  key: string;
  title: string;
  isLeaf?: boolean;
  itemCount?: number;
  nodeType?: "group" | "leaf-group" | "leaf";
  item?: ReportItem;
  children?: TreeNode[];
}

interface PiePart {
  name: string;
  value: number;
  color: string;
}

interface PieChartData {
  title: string;
  css: string;
  items: PiePart[];
}

const route = useRoute();
const router = useRouter();
const reportId = String(route.params.reportId ?? "");
const loading = ref(false);
const report = ref<ReportData | null>(null);
const activeDimension = ref("");
const expandedKeys = ref<string[]>([]);
const pinnedNodeKeys = ref<string[]>([]);

const scale = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
const dragging = ref(false);
const lastX = ref(0);
const lastY = ref(0);

const analysisNodes = computed(() => (report.value?.analysis ?? []) as AnalysisNode[]);
const pieColors = ["#1677ff", "#36cfc9", "#9254de", "#faad14", "#f5222d", "#52c41a", "#13c2c2"];

const activeNode = computed(
  () => analysisNodes.value.find((x) => x.name === activeDimension.value) ?? null
);

const allExpandableKeys = computed(() => {
  const keys: string[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (n.children?.length) {
        keys.push(n.key);
        walk(n.children);
      }
    }
  };
  walk(treeData.value);
  return keys;
});

function countLeafItems(node: AnalysisNode): number {
  const list = Array.isArray(node.data) ? node.data : [];
  let total = 0;
  for (const item of list) {
    if (typeof (item as ReportItem).id === "string") {
      total += 1;
      continue;
    }
    total += countLeafItems(item as AnalysisNode);
  }
  return total;
}

function buildTreeNode(node: AnalysisNode, parentPath: string): TreeNode {
  const key = parentPath ? `${parentPath}/${node.name}` : node.name;
  const list = Array.isArray(node.data) ? node.data : [];
  const children: TreeNode[] = [];
  for (const item of list) {
    const leafId = (item as ReportItem).id;
    if (typeof leafId === "string") {
      const leaf = item as ReportItem;
      children.push({
        key: `${key}/item-${leaf.id}`,
        title: leaf.title,
        isLeaf: true,
        nodeType: "leaf",
        item: leaf
      });
      continue;
    }
    children.push(buildTreeNode(item as AnalysisNode, key));
  }
  return {
    key,
    title: node.name,
    itemCount: countLeafItems(node),
    nodeType: "group",
    children
  };
}

const treeData = computed<TreeNode[]>(() => {
  if (!activeNode.value) return [];
  return [buildTreeNode(activeNode.value, "")];
});

function buildPieFromParts(title: string, parts: Array<{ name: string; value: number }>): PieChartData {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  const normalized = parts
    .filter((x) => x.value > 0)
    .map((x, idx) => ({
      ...x,
      color: pieColors[idx % pieColors.length]
    }));
  if (!normalized.length || total <= 0) {
    return {
      title,
      css: "#f5f5f5",
      items: []
    };
  }
  let start = 0;
  const slices: string[] = [];
  for (const p of normalized) {
    const ratio = (p.value / total) * 100;
    const end = start + ratio;
    slices.push(`${p.color} ${start}% ${end}%`);
    start = end;
  }
  return {
    title,
    css: `conic-gradient(${slices.join(", ")})`,
    items: normalized
  };
}

const pieCharts = computed<PieChartData[]>(() => {
  const dimensions = analysisNodes.value;
  const dimensionParts = dimensions.map((d) => ({
    name: d.name,
    value: countLeafItems(d)
  }));
  const charts: PieChartData[] = [buildPieFromParts("维度占比", dimensionParts)];
  if (activeNode.value?.data?.length) {
    const children = activeNode.value.data.filter(
      (x): x is AnalysisNode => typeof (x as AnalysisNode).name === "string"
    );
    charts.push(
      buildPieFromParts(
        `${activeNode.value.name} 一级分类占比`,
        children.map((x) => ({ name: x.name, value: countLeafItems(x) }))
      )
    );
  }
  return charts;
});

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true
});

const renderedSummary = computed(() => {
  const raw = report.value?.ai_summary?.trim();
  if (!raw) {
    return "<p>—</p>";
  }
  return md.render(raw);
});

async function loadReport() {
  loading.value = true;
  try {
    const { data } = await http.get(`/reports/reddit-req/${reportId}`);
    report.value = data.data as ReportData;
    pinnedNodeKeys.value = (data.state?.pinnedNodeKeys ?? []) as string[];
    const firstDimension = (report.value.analysis ?? [])[0]?.name ?? "";
    activeDimension.value = firstDimension;
  } finally {
    loading.value = false;
  }
}

function onExpand(keys: string[]) {
  expandedKeys.value = keys;
}

function expandAll() {
  expandedKeys.value = allExpandableKeys.value;
}

function collapseAll() {
  expandedKeys.value = treeData.value.map((x) => x.key);
}

function isPinned(key: string): boolean {
  return pinnedNodeKeys.value.includes(key);
}

async function togglePin(nodeKey: string) {
  const next = !isPinned(nodeKey);
  const { data } = await http.post(`/reports/reddit-req/${reportId}/node-pin`, {
    nodeKey,
    pinned: next
  });
  pinnedNodeKeys.value = (data.pinnedNodeKeys ?? []) as string[];
}

async function markNodeRead(nodeKey: string) {
  const { data } = await http.post(`/reports/reddit-req/${reportId}/mark-read`, { nodeKey });
  message.success(`已批量标记 ${data.updated ?? 0} 条`);
}

async function markItemRead(item: ReportItem) {
  await http.post("/data/read", { id: item.id, read: 1 });
  item.read = 1;
}

async function toggleFavorite(item: ReportItem) {
  const next = !item.favorite;
  await http.post("/data/favorite", { id: item.id, favorite: next });
  item.favorite = next;
}

async function toggleIgnore(item: ReportItem) {
  if (item.read === -1) {
    await http.post("/data/read", { id: item.id, read: 1 });
    item.read = 1;
    return;
  }
  await http.post("/data/read", { id: item.id, read: -1 });
  item.read = -1;
}

function goBack() {
  router.push({ name: "reddit_req_reports" });
}

function onCanvasWheel(evt: WheelEvent) {
  const delta = evt.deltaY < 0 ? 0.1 : -0.1;
  const next = Math.max(0.5, Math.min(2, scale.value + delta));
  scale.value = Number(next.toFixed(2));
}

function onCanvasDown(evt: MouseEvent) {
  dragging.value = true;
  lastX.value = evt.clientX;
  lastY.value = evt.clientY;
}

function onCanvasMove(evt: MouseEvent) {
  if (!dragging.value) return;
  offsetX.value += evt.clientX - lastX.value;
  offsetY.value += evt.clientY - lastY.value;
  lastX.value = evt.clientX;
  lastY.value = evt.clientY;
}

function onCanvasUp() {
  dragging.value = false;
}

const canvasStyle = computed(() => ({
  transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`,
  transformOrigin: "0 0"
}));

onMounted(() => {
  void loadReport();
});
</script>

<style scoped>
.page-header {
  margin-bottom: 12px;
}

.page-title {
  margin: 0;
}

.section {
  margin-top: 12px;
}

.analysis-toolbar {
  margin-bottom: 8px;
}

.canvas-shell {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  height: 520px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
}

.canvas-shell:active {
  cursor: grabbing;
}

.canvas-content {
  padding: 12px;
  width: max-content;
}

.tree-node {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 6px;
}

.tree-node--pinned {
  background: #fff1f0;
}

.tree-title {
  font-weight: 500;
}

.leaf-card {
  margin-top: 4px;
  max-width: 680px;
  padding: 8px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fff;
}

.leaf-title {
  font-weight: 500;
}

.leaf-summary {
  margin-top: 4px;
  color: rgba(0, 0, 0, 0.65);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.leaf-actions {
  margin-top: 6px;
  display: flex;
  gap: 8px;
}

.cloud-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

.pie-wrap {
  display: flex;
  gap: 10px;
  align-items: center;
}

.pie {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  border: 1px solid #f0f0f0;
  flex: 0 0 auto;
}

.pie-legend {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pie-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.markdown-text {
  line-height: 1.7;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin: 12px 0 8px;
}

.markdown-body :deep(p) {
  margin: 8px 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 20px;
}

.markdown-body :deep(code) {
  background: #f7f7f7;
  padding: 1px 5px;
  border-radius: 4px;
}

.muted {
  color: rgba(0, 0, 0, 0.45);
}
</style>
