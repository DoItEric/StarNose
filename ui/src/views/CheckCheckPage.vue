<template>
  <div class="checkcheck-page">
    <div class="checkcheck-header">
      <div class="checkcheck-header__title">checkcheck</div>
      <div class="checkcheck-header__meta" v-if="pagination.total > 0">
        第 {{ currentGlobalIndex + 1 }} / {{ pagination.total }} 条
      </div>
    </div>

    <div v-if="!currentItem && !loading" class="checkcheck-empty">
      暂无待查看数据
    </div>

    <a-spin v-else :spinning="loading">
      <div v-if="currentItem" class="checkcheck-card">
        <div class="checkcheck-card__header">
          <div class="checkcheck-card__title">
            <a
              v-if="currentItem.url"
              :href="currentItem.url"
              target="_blank"
              rel="noopener noreferrer"
              @click.stop="onOpenOnly(currentItem)"
            >
              {{ currentItem.title }}
            </a>
            <template v-else>{{ currentItem.title }}</template>
          </div>
          <span
            class="favorite-star"
            :class="{ 'favorite-star--active': currentItem.favorite }"
            @click.stop="openFavoriteModalOrToggle(currentItem)"
          >
            ★
          </span>
          <span
            class="connected-icon"
            :class="{ 'connected-icon--active': currentItem.connected }"
            @click.stop="toggleConnected(currentItem)"
            title="联络状态"
          >
            ☎
          </span>
        </div>

        <div class="checkcheck-card__meta">
          <a-tag :color="readStatusColor(currentItem.read)">
            {{ readStatusText(currentItem.read) }}
          </a-tag>
          <span class="muted">{{ currentItem.source }}</span>
          <span class="muted">
            规则：{{ ruleNameMap[currentItem.ruleId] ?? currentItem.ruleId }}
          </span>
          <span v-if="currentItem.channel" class="muted">
            频道：{{ currentItem.channel }}
          </span>
          <span class="muted">
            抓取：{{ formatUtcToBeijing(currentItem.crawlTime) }}
          </span>
          <span v-if="currentItem.publishTime" class="muted">
            发布：{{ formatUtcToBeijing(currentItem.publishTime) }}
          </span>
        </div>

        <div v-if="currentItem.summary" class="checkcheck-card__section">
          <div class="section-label">摘要</div>
          <div class="section-content">
            {{ currentItem.summary }}
          </div>
        </div>

        <div v-if="currentItem.content" class="checkcheck-card__section checkcheck-card__section--content">
          <div class="section-label">
            内容（翻译）
            <a-button
              v-if="!contentVisible"
              type="link"
              size="small"
              @click="showContent"
            >
              显示
            </a-button>
          </div>
          <div v-if="contentVisible" class="section-content section-content--translated">
            <a-spin v-if="contentTranslateLoading" size="small" />
            <template v-else-if="contentTranslateError">
              <span class="content-fallback">{{ contentTranslateError }}</span>
              <details class="content-original">
                <summary>原文</summary>
                <div class="content-original__text">{{ currentItem.content }}</div>
              </details>
            </template>
            <div v-else-if="contentTranslated" class="content-translated__text">{{ contentTranslated }}</div>
            <span v-else class="muted">—</span>
          </div>
        </div>

        <div v-if="hasAttributes(currentItem)" class="checkcheck-card__section">
          <div class="section-label">属性</div>
          <div class="section-content checkcheck-attributes">
            <template v-if="currentItem.source === 'reddit'">
              <div v-if="getAttr(currentItem, 'industry')" class="attr-item">
                <span class="attr-label">行业：</span>{{ getAttr(currentItem, 'industry') }}
              </div>
              <div v-if="getAttr(currentItem, 'persona')" class="attr-item">
                <span class="attr-label">角色：</span>{{ getAttr(currentItem, 'persona') }}
              </div>
              <div v-if="getAttr(currentItem, 'issue')" class="attr-item">
                <span class="attr-label">问题：</span>{{ getAttr(currentItem, 'issue') }}
              </div>
              <div v-if="getAttr(currentItem, 'phase')" class="attr-item">
                <span class="attr-label">环节：</span>{{ getAttr(currentItem, 'phase') }}
              </div>
              <div v-if="getAttr(currentItem, 'scene')" class="attr-item">
                <span class="attr-label">场景：</span>{{ getAttr(currentItem, 'scene') }}
              </div>
            </template>
            <template v-else>
              <div v-for="(val, key) in currentItem.attributes" :key="key" class="attr-item">
                <span class="attr-label">{{ key }}：</span>{{ val }}
              </div>
            </template>
          </div>
        </div>

        <div v-if="currentItem.keywords?.length" class="checkcheck-card__section">
          <div class="section-label">关键字</div>
          <div class="section-content">
            {{ currentItem.keywords.join(", ") }}
          </div>
        </div>

        <div
          v-if="formatTrackData(currentItem) !== '—'"
          class="checkcheck-card__section"
        >
          <div class="section-label">跟踪数据</div>
          <div class="section-content">
            {{ formatTrackData(currentItem) }}
          </div>
        </div>

        <div class="checkcheck-actions">
          <a-button
            type="default"
            block
            @click="onMarkReadAndNext(currentItem)"
            :disabled="currentItem.read === 1 || currentItem.read === -1"
          >
            已读
          </a-button>
          <a-button
            type="default"
            danger
            block
            @click="onIgnoreAndNext(currentItem)"
            :disabled="currentItem.read === 1 || currentItem.read === -1"
          >
            忽略
          </a-button>
          <a-button
            type="default"
            block
            @click="toggleTracking(currentItem)"
          >
            {{ currentItem.tracking ? "取消跟踪" : "跟踪" }}
          </a-button>
          <a-button
            v-if="currentItem.source === 'reddit' && currentItem.channel"
            type="default"
            danger
            block
            @click="onBlacklistAndNext(currentItem)"
          >
            黑名单
          </a-button>
        </div>
      </div>
    </a-spin>

    <div class="checkcheck-footer">
      <a-button
        class="checkcheck-footer__btn"
        :disabled="!hasPrev"
        @click="goPrev"
      >
        上一个
      </a-button>
      <a-button
        class="checkcheck-footer__btn"
        :loading="loading"
        @click="refreshData"
      >
        刷新
      </a-button>
      <a-button
        class="checkcheck-footer__btn"
        type="primary"
        :disabled="!hasNext"
        @click="goNext"
      >
        下一个
      </a-button>
    </div>
  </div>

  <a-modal
    v-model:open="favoriteModalVisible"
    title="选择收藏列表"
    @ok="handleFavoriteModalOk"
    @cancel="handleFavoriteModalCancel"
  >
    <div v-if="!favoriteLists.length" class="favorite-modal-section">
      当前还没有收藏列表，将根据下方名称自动创建。
    </div>
    <div v-else class="favorite-modal-section">
      <div class="favorite-modal-label">选择已有列表：</div>
      <a-radio-group v-model:value="favoriteModalSelectedListId">
        <a-radio
          v-for="list in favoriteLists"
          :key="list.id"
          :value="list.id"
        >
          {{ list.name }}
        </a-radio>
      </a-radio-group>
    </div>
    <div class="favorite-modal-section">
      <div class="favorite-modal-label">或新建列表：</div>
      <a-input
        v-model:value="favoriteModalNewListName"
        placeholder="输入新的收藏列表名称"
      />
      <div class="favorite-modal-tip">
        如填写新名称，则会创建新列表并将当前数据加入其中。
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { http } from "@/api/http";
import { formatUtcToBeijing } from "@/utils/time";

interface DataItem {
  id: string;
  ruleId: string;
  source: string;
  channel?: string;
  title: string;
  content: string;
  url?: string;
  keywords: string[];
  tracking: boolean;
  crawlTime: string;
  publishTime?: string;
  summary?: string;
  attributes?: Record<string, unknown>;
  read: number;
  trackData?: Record<string, unknown>;
  favorite?: boolean;
  connected?: boolean;
}

const loading = ref(false);
const items = ref<DataItem[]>([]);
const pagination = ref<{ page: number; pageSize: number; total: number }>({
  page: 1,
  pageSize: 50,
  total: 0
});
const currentIndex = ref(0);
const ruleNameMap = ref<Record<string, string>>({});

const contentVisible = ref(false);
const contentTranslated = ref<string | null>(null);
const contentTranslateLoading = ref(false);
const contentTranslateError = ref<string | null>(null);
const contentTranslateCache = ref<Record<string, string>>({});

const currentItem = computed(() => items.value[currentIndex.value] ?? null);

const currentGlobalIndex = computed(
  () => (pagination.value.page - 1) * pagination.value.pageSize + currentIndex.value
);

const hasPrev = computed(() => currentGlobalIndex.value > 0);
const hasNext = computed(
  () => currentGlobalIndex.value + 1 < pagination.value.total
);

const favoriteModalVisible = ref(false);
const favoriteModalNewListName = ref("");
const favoriteModalSelectedListId = ref<string | null>(null);
const favoriteLists = ref<{ id: string; name: string }[]>([]);

async function translateContent(text: string, targetLang = "zh-CN"): Promise<string> {
  const { data } = await http.post<{ translated: string }>("/translate", {
    text,
    targetLang
  });
  return data?.translated ?? text;
}

function applyContentTranslation(item: DataItem | null) {
  contentTranslated.value = null;
  contentTranslateError.value = null;
  if (!item?.content) return;
  const cached = contentTranslateCache.value[item.id];
  if (cached) {
    contentTranslated.value = cached;
    return;
  }
  contentTranslateLoading.value = true;
  translateContent(item.content, "zh-CN")
    .then((translated) => {
      contentTranslateCache.value[item.id] = translated;
      contentTranslated.value = translated;
    })
    .catch(() => {
      contentTranslateError.value = "翻译失败，请查看原文";
    })
    .finally(() => {
      contentTranslateLoading.value = false;
    });
}

function showContent() {
  contentVisible.value = true;
  applyContentTranslation(currentItem.value);
}

watch(currentItem, () => {
  contentVisible.value = false;
  contentTranslated.value = null;
  contentTranslateError.value = null;
});

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
function hasAttributes(item: DataItem): boolean {
  return !!item.attributes && typeof item.attributes === "object" && Object.keys(item.attributes).length > 0;
}
function getAttr(item: DataItem, key: string): string {
  const v = item.attributes?.[key];
  return typeof v === "string" ? v : v != null ? String(v) : "";
}
function formatTrackData(record: DataItem): string {
  const d = record.trackData;
  if (!d || typeof d !== "object") return "—";
  if (record.source === "reddit") {
    const ups = (d as any).ups;
    const num = (d as any).num_comments;
    if (ups != null || num != null) {
      return `↑ ${ups ?? "—"} · 💬 ${num ?? "—"}`;
    }
  }
  return Object.keys(d).length ? JSON.stringify(d) : "—";
}

async function markRead(id: string, read: boolean | number) {
  await http.post("/data/read", { id, read });
}

async function toggleFavorite(record: DataItem) {
  const next = !record.favorite;
  await http.post("/data/favorite", { id: record.id, favorite: next });
  record.favorite = next;
}

async function setTracking(id: string, tracking: boolean) {
  await http.post("/data/track", { id, tracking });
}

async function toggleTracking(record: DataItem) {
  const next = !record.tracking;
  await setTracking(record.id, next);
  record.tracking = next;
}

async function loadFavoriteListsForModal() {
  if (favoriteLists.value.length > 0) return;
  try {
    const resp = await http.get("/favorite-lists");
    const items = (resp.data.items ?? []) as { id: string; name: string }[];
    favoriteLists.value = items;
  } catch {
    favoriteLists.value = [];
  }
}

async function openFavoriteModalOrToggle(record: DataItem | null) {
  if (!record) return;
  if (record.favorite) {
    await toggleFavorite(record);
    return;
  }
  await loadFavoriteListsForModal();
  const def =
    favoriteLists.value.find((l) => l.name === "默认") ?? favoriteLists.value[0] ?? null;
  favoriteModalSelectedListId.value = def ? def.id : null;
  favoriteModalNewListName.value = "";
  favoriteModalVisible.value = true;
}

async function handleFavoriteModalOk() {
  const target = currentItem.value;
  if (!target) {
    favoriteModalVisible.value = false;
    return;
  }
  const listName = favoriteModalNewListName.value.trim();
  const payload: Record<string, unknown> = {
    id: target.id,
    favorite: true
  };
  if (listName) {
    payload.listName = listName;
  } else if (favoriteModalSelectedListId.value) {
    payload.listId = favoriteModalSelectedListId.value;
  }
  await http.post("/data/favorite", payload);
  target.favorite = true;
  favoriteModalVisible.value = false;
}

function handleFavoriteModalCancel() {
  favoriteModalVisible.value = false;
}

async function setConnected(id: string, connected: boolean) {
  await http.post("/data/connected", { id, connected });
}

async function toggleConnected(record: DataItem) {
  const next = !record.connected;
  await setConnected(record.id, next);
  record.connected = next;
}

async function fetchPage(page: number) {
  loading.value = true;
  try {
    const params: Record<string, unknown> = {
      page,
      pageSize: pagination.value.pageSize,
      readStatus: "unread"
    };
    const resp = await http.get("/data", { params });
    const rows = (resp.data.items ?? []) as any[];
    items.value = rows.map((r) => ({
      id: r.id,
      ruleId: r.ruleId,
      source: r.source,
      channel: r.channel,
      title: r.title,
      content: r.content,
      url: r.url,
      keywords: r.keywords,
      tracking: !!r.tracking,
      crawlTime: r.crawlTime,
      publishTime: r.publishTime,
      summary: r.summary,
      attributes: r.attributes,
      read: typeof r.read === "number" ? r.read : r.read ? 1 : 0,
      trackData: r.trackData,
      favorite: !!r.favorite,
      connected: !!(r.params && (r.params.connected === true || r.params.connected === "true"))
    }));
    pagination.value.page = page;
    pagination.value.total = Number(resp.data.total ?? 0);
    currentIndex.value = 0;
  } finally {
    loading.value = false;
  }
}

async function ensureRules() {
  try {
    const resp = await http.get("/rules");
    const items = (resp.data.items ?? []) as { id: string; name?: string }[];
    const map: Record<string, string> = {};
    for (const r of items) {
      map[r.id] = r.name ?? r.id;
    }
    ruleNameMap.value = map;
  } catch {
    ruleNameMap.value = {};
  }
}

async function goNext() {
  if (!hasNext.value) return;
  const nextGlobal = currentGlobalIndex.value + 1;
  const nextPage =
    Math.floor(nextGlobal / pagination.value.pageSize) + 1;
  const indexInPage = nextGlobal % pagination.value.pageSize;
  if (nextPage !== pagination.value.page) {
    await fetchPage(nextPage);
  }
  currentIndex.value = indexInPage;
}

async function goPrev() {
  if (!hasPrev.value) return;
  const prevGlobal = currentGlobalIndex.value - 1;
  const prevPage =
    Math.floor(prevGlobal / pagination.value.pageSize) + 1;
  const indexInPage = prevGlobal % pagination.value.pageSize;
  if (prevPage !== pagination.value.page) {
    await fetchPage(prevPage);
  }
  currentIndex.value = indexInPage;
}

async function refreshData() {
  const targetGlobal = currentGlobalIndex.value;
  if (pagination.value.total <= 0) {
    await fetchPage(1);
    return;
  }
  const targetPage =
    Math.floor(targetGlobal / pagination.value.pageSize) + 1;
  const indexInPage = targetGlobal % pagination.value.pageSize;
  await fetchPage(targetPage);
  if (items.value.length > 0) {
    currentIndex.value = Math.min(indexInPage, items.value.length - 1);
  }
}

async function onIgnoreAndNext(record: DataItem) {
  if (record.read === 1 || record.read === -1) {
    await goNext();
    return;
  }
  await markRead(record.id, -1);
  record.read = -1;
  await goNext();
}

async function onMarkReadAndNext(record: DataItem) {
  if (record.read === 1 || record.read === -1) {
    await goNext();
    return;
  }
  await markRead(record.id, 1);
  record.read = 1;
  await goNext();
}

async function onBlacklistAndNext(record: DataItem) {
  if (!record.channel) {
    await goNext();
    return;
  }
  await http.post("/data/channel/blacklist", {
    source: record.source,
    channel: record.channel,
    ruleId: record.ruleId
  });
  record.read = -1;
  await goNext();
}

async function onOpenOnly(record: DataItem) {
  if (!record.url) return;
  window.open(record.url, "_blank", "noopener,noreferrer");
  if (record.read !== 1) {
    await markRead(record.id, 1);
    record.read = 1;
  }
}

onMounted(() => {
  void (async () => {
    await ensureRules();
    await fetchPage(1);
  })();
});
</script>

<style scoped>
.checkcheck-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 8px 8px 72px;
}

.checkcheck-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}

.checkcheck-header__title {
  font-size: 18px;
  font-weight: 600;
}

.checkcheck-header__meta {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.checkcheck-empty {
  margin-top: 32px;
  text-align: center;
  color: rgba(0, 0, 0, 0.45);
}

.checkcheck-card {
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  padding: 12px;
  background-color: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.checkcheck-card__header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.checkcheck-card__title {
  font-size: 16px;
  font-weight: 500;
  flex: 1;
}

.checkcheck-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.muted {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
}

.checkcheck-card__section {
  margin-top: 8px;
}

.section-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  margin-bottom: 4px;
}

.section-content {
  font-size: 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.checkcheck-card__section--content .section-content--translated {
  height: 150px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  word-break: break-word;
  overflow-wrap: break-word;
  padding-bottom: 2px;
}

.content-translated__text,
.content-original__text {
  word-break: break-word;
  overflow-wrap: break-word;
  line-height: 1.5;
}

.content-fallback {
  color: rgba(0, 0, 0, 0.65);
  font-size: 13px;
}

.content-original {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.5);
}

.content-original summary {
  cursor: pointer;
  user-select: none;
}

.content-original__text {
  margin-top: 6px;
  max-height: 30vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  white-space: pre-wrap;
}

.checkcheck-actions {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkcheck-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 8px 12px;
  display: flex;
  gap: 12px;
  background-color: #fff;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
}

.checkcheck-footer__btn {
  flex: 1;
}

.favorite-star {
  margin-left: auto;
  cursor: pointer;
  color: rgba(0, 0, 0, 0.25);
}

.favorite-star--active {
  color: #fadb14;
}

.favorite-modal-section {
  margin-bottom: 12px;
}

.favorite-modal-label {
  margin-bottom: 4px;
  font-weight: 500;
}

.favorite-modal-tip {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.connected-icon {
  margin-left: 6px;
  cursor: pointer;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.25);
}

.connected-icon--active {
  color: #52c41a;
}

.checkcheck-attributes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
}

.attr-item {
  line-height: 1.6;
}

.attr-label {
  color: rgba(0, 0, 0, 0.45);
}

@media (max-width: 480px) {
  .checkcheck-attributes {
    flex-direction: column;
    gap: 2px;
  }
}
</style>

