<template>
  <div>
    <div class="page-header">
      <h2>规则</h2>
      <a-button type="primary" @click="openCreate">新增规则</a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="rules"
      :pagination="{ pageSize: 20 }"
      row-key="id"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.key === 'name' || column.key === 'keywordDescription' || column.key === 'description' || column.key === 'promptFile'">
          <span class="table-cell-ellipsis" :title="text">{{ text ?? "" }}</span>
        </template>
        <template v-else-if="column.key === 'keywords'">
          <span class="table-cell-ellipsis" :title="(record.keywords ?? []).join('，')">
            {{ (record.keywords ?? []).join("，") }}
          </span>
        </template>
        <template v-else-if="column.key === 'plugins'">
          <span class="table-cell-ellipsis" :title="formatPluginsDisplay(record.plugins)">
            {{ formatPluginsDisplay(record.plugins) }}
          </span>
        </template>
        <template v-else-if="column.key === 'action'">
          <a @click.stop="openEdit(record)">编辑</a>
          <a-divider type="vertical" />
          <a @click.stop="toggleRule(record)">
            {{ record.disabled ? "启用" : "停用" }}
          </a>
          <a-divider type="vertical" />
          <a-popconfirm
            title="确定要删除该规则吗？"
            ok-text="删除"
            cancel-text="取消"
            @confirm="() => deleteRule(record)"
          >
            <a style="color: #ff4d4f">删除</a>
          </a-popconfirm>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="createVisible"
      :title="editId ? '编辑规则' : '新增规则'"
      :footer="null"
      width="720px"
    >
      <a-form layout="vertical">
        <a-form-item label="规则名称">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item label="关键字需求描述">
          <a-textarea
            v-model:value="form.keywordDescription"
            :rows="4"
            placeholder="请描述你希望用哪些关键词来检索数据，越详细越好，便于生成或补充关键词。"
          />
          <div class="action-buttons">
            <a-button
              :loading="generateLoading"
              @click="handleGenerateKeywords"
            >
              生成关键词
            </a-button>
            <a-button
              :loading="supplementLoading"
              :disabled="form.keywords.length === 0"
              @click="handleSupplementKeywords"
            >
              补充关键字
            </a-button>
          </div>
        </a-form-item>
        <a-form-item label="信息偏好">
          <a-textarea
            v-model:value="form.description"
            :rows="4"
            placeholder="描述你偏好的信息特征，用于 LLM 匹配与筛选内容。"
          />
        </a-form-item>

        <a-form-item label="关键字">
          <a-input-search
            v-model:value="keywordSearch"
            placeholder="输入以模糊匹配关键字"
            allow-clear
            class="keyword-search"
          />
          <div ref="keywordListRef" class="keyword-list-wrap">
            <div
              v-for="(item, index) in paginatedKeywords"
              :key="item.text + '-' + resolvedKeywordIndex(item)"
              :class="['keyword-row', { 'keyword-row-new': item.isNew }]"
            >
              <span class="keyword-text">{{ item.text }}</span>
              <a-button
                type="text"
                size="small"
                danger
                class="keyword-delete"
                @click="removeKeyword(resolvedKeywordIndex(item))"
              >
                删除
              </a-button>
            </div>
            <div v-if="filteredKeywords.length === 0" class="keyword-empty">
              暂无关键字，可点击「生成关键词」或「补充关键字」
            </div>
          </div>
          <a-pagination
            v-if="filteredKeywords.length > pageSize"
            v-model:current="keywordPage"
            v-model:page-size="pageSize"
            :total="filteredKeywords.length"
            size="small"
            show-size-changer
            :page-size-options="['10', '20', '50']"
            show-total
            class="keyword-pagination"
          />
          <div class="keyword-add-row">
            <a-input
              v-model:value="addKeywordInput"
              placeholder="输入关键字，多个用逗号分隔"
              allow-clear
              class="keyword-add-input"
              @press-enter="addKeywordsFromInput"
            />
            <a-button type="primary" @click="addKeywordsFromInput">Add</a-button>
          </div>
        </a-form-item>

        <a-form-item label="负面关键字（命中则忽略）">
          <a-input-search
            v-model:value="negativeKeywordSearch"
            placeholder="输入以模糊匹配负面关键字"
            allow-clear
            class="keyword-search"
          />
          <div class="keyword-list-wrap">
            <div
              v-for="item in paginatedNegativeKeywords"
              :key="item.text + '-' + resolvedNegativeKeywordIndex(item)"
              class="keyword-row"
            >
              <span class="keyword-text">{{ item.text }}</span>
              <a-button
                type="text"
                size="small"
                danger
                class="keyword-delete"
                @click="removeNegativeKeyword(resolvedNegativeKeywordIndex(item))"
              >
                删除
              </a-button>
            </div>
            <div v-if="filteredNegativeKeywords.length === 0" class="keyword-empty">
              暂无负面关键字（该项不自动生成，请手工添加）
            </div>
          </div>
          <a-pagination
            v-if="filteredNegativeKeywords.length > negativePageSize"
            v-model:current="negativeKeywordPage"
            v-model:page-size="negativePageSize"
            :total="filteredNegativeKeywords.length"
            size="small"
            show-size-changer
            :page-size-options="['10', '20', '50']"
            show-total
            class="keyword-pagination"
          />
          <div class="keyword-add-row">
            <a-input
              v-model:value="addNegativeKeywordInput"
              placeholder="输入负面关键字，多个用逗号分隔"
              allow-clear
              class="keyword-add-input"
              @press-enter="addNegativeKeywordsFromInput"
            />
            <a-button type="primary" @click="addNegativeKeywordsFromInput">Add</a-button>
          </div>
        </a-form-item>

        <a-form-item label="生效插件">
          <a-checkbox-group v-model:value="form.selectedPluginKeys" class="plugin-checkbox-group">
            <a-checkbox
              v-for="p in pluginList"
              :key="p.key"
              :value="p.key"
            >
              {{ p.name || p.key }}
            </a-checkbox>
          </a-checkbox-group>
          <div v-if="pluginList.length === 0" class="plugin-empty">暂无可用插件</div>
        </a-form-item>

        <a-form-item label="筛选 Prompt 文件">
          <a-input
            v-model:value="form.promptFile"
            placeholder="prompt 文件名（不含扩展名），如 validate_content_zh"
          />
        </a-form-item>
        <a-form-item label="内容最大长度（字符）">
          <a-input-number
            v-model:value="form.contentLength"
            placeholder="不填则不限制，超过则不做 LLM 匹配"
            :min="1"
            style="width: 100%"
          />
        </a-form-item>

        <a-form-item label="内容最小长度（字符）">
          <a-input-number
            v-model:value="form.contentMinLength"
            placeholder="不填则不限制，不足则不做 LLM 匹配"
            :min="1"
            style="width: 100%"
          />
        </a-form-item>

        <a-form-item label="Reddit 白名单（维护后仅抓取这些频道）">
          <a-input
            v-model:value="addWhitelistInput"
            placeholder="输入 subreddit，多个用逗号分隔"
            allow-clear
            @press-enter="addWhitelistFromInput"
          />
          <div class="tag-list">
            <a-tag
              v-for="name in form.subredditWhitelist"
              :key="'wl-' + name"
              closable
              @close.prevent="removeWhitelist(name)"
            >
              {{ name }}
            </a-tag>
            <div v-if="form.subredditWhitelist.length === 0" class="keyword-empty">
              未配置白名单（将使用黑名单进行排除）
            </div>
          </div>
        </a-form-item>

        <a-form-item label="Reddit 黑名单（白名单为空时生效）">
          <a-input
            v-model:value="addBlacklistInput"
            placeholder="输入 subreddit，多个用逗号分隔"
            allow-clear
            @press-enter="addBlacklistFromInput"
          />
          <div class="tag-list">
            <a-tag
              v-for="name in form.subredditBlacklist"
              :key="'bl-' + name"
              closable
              @close.prevent="removeBlacklist(name)"
            >
              {{ name }}
            </a-tag>
            <div v-if="form.subredditBlacklist.length === 0" class="keyword-empty">
              未配置黑名单
            </div>
          </div>
        </a-form-item>
      </a-form>
      <div class="modal-footer">
        <a-button @click="closeCreate">取消</a-button>
        <a-button type="primary" @click="submitRule">保存</a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { http } from "@/api/http";

interface RuleItem {
  id: string;
  name: string;
  keywordDescription?: string;
  description?: string;
  keywords: string[];
  negativeKeywords?: string[];
  plugins?: string;
  promptFile?: string;
  contentLength?: number;
  contentMinLength?: number;
  lastRunAt?: string;
  disabled: boolean;
}

interface PluginOption {
  key: string;
  name: string;
}

interface KeywordItem {
  text: string;
  isNew: boolean;
}

const columns = [
  {
    title: "规则名称",
    dataIndex: "name",
    key: "name",
    width: 120,
    ellipsis: true
  },
  {
    title: "关键字描述",
    dataIndex: "keywordDescription",
    key: "keywordDescription",
    width: 160,
    ellipsis: true
  },
  {
    title: "偏好描述",
    dataIndex: "description",
    key: "description",
    width: 160,
    ellipsis: true
  },
  {
    title: "关键字",
    dataIndex: "keywords",
    key: "keywords",
    width: 200,
    ellipsis: true
  },
  {
    title: "匹配组件",
    dataIndex: "plugins",
    key: "plugins",
    width: 120,
    ellipsis: true
  },
  {
    title: "筛选 Prompt",
    dataIndex: "promptFile",
    key: "promptFile",
    width: 120,
    ellipsis: true
  },
  {
    title: "上次调度时间",
    dataIndex: "lastRunAt",
    key: "lastRunAt",
    width: 100
  },
  {
    title: "操作",
    key: "action",
    width: 140
  }
];

const rules = ref<RuleItem[]>([]);
const createVisible = ref(false);
const editId = ref<string | null>(null);
const form = ref({
  name: "",
  keywordDescription: "",
  description: "",
  keywords: [] as KeywordItem[],
  negativeKeywords: [] as KeywordItem[],
  selectedPluginKeys: [] as string[],
  promptFile: "",
  contentLength: undefined as number | undefined,
  contentMinLength: undefined as number | undefined,
  subredditWhitelist: [] as string[],
  subredditBlacklist: [] as string[]
});

const pluginList = ref<PluginOption[]>([]);

const generateLoading = ref(false);
const supplementLoading = ref(false);
const keywordSearch = ref("");
const keywordPage = ref(1);
const pageSize = ref(10);
const addKeywordInput = ref("");
const keywordListRef = ref<HTMLElement | null>(null);

const negativeKeywordSearch = ref("");
const negativeKeywordPage = ref(1);
const negativePageSize = ref(10);
const addNegativeKeywordInput = ref("");

const originalWhitelist = ref<string[]>([]);
const originalBlacklist = ref<string[]>([]);
const addWhitelistInput = ref("");
const addBlacklistInput = ref("");

const filteredKeywords = computed(() => {
  const q = keywordSearch.value.trim().toLowerCase();
  if (!q) return form.value.keywords;
  return form.value.keywords.filter((k) =>
    k.text.toLowerCase().includes(q)
  );
});

const paginatedKeywords = computed(() => {
  const list = filteredKeywords.value;
  const start = (keywordPage.value - 1) * pageSize.value;
  return list.slice(start, start + pageSize.value);
});

function resolvedKeywordIndex(item: KeywordItem) {
  return form.value.keywords.findIndex((k) => k === item);
}

const filteredNegativeKeywords = computed(() => {
  const q = negativeKeywordSearch.value.trim().toLowerCase();
  if (!q) return form.value.negativeKeywords;
  return form.value.negativeKeywords.filter((k) =>
    k.text.toLowerCase().includes(q)
  );
});

const paginatedNegativeKeywords = computed(() => {
  const list = filteredNegativeKeywords.value;
  const start = (negativeKeywordPage.value - 1) * negativePageSize.value;
  return list.slice(start, start + negativePageSize.value);
});

function resolvedNegativeKeywordIndex(item: KeywordItem) {
  return form.value.negativeKeywords.findIndex((k) => k === item);
}

/** 解析存储格式 ,key1,key2, 为 key 数组 */
function parsePluginsString(s: string | undefined | null): string[] {
  if (!s || typeof s !== "string") return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

/** 将规则的 plugins 字符串格式化为展示文本（用 pluginList 的 name） */
function formatPluginsDisplay(plugins: string | undefined): string {
  const keys = parsePluginsString(plugins);
  if (keys.length === 0) return "";
  const nameMap = new Map(pluginList.value.map((p) => [p.key, p.name || p.key]));
  return keys.map((k) => nameMap.get(k) ?? k).join("，");
}

/** 将 key 数组序列化为 ,key1,key2, */
function serializePlugins(keys: string[]): string {
  return "," + keys.join(",") + ",";
}

async function loadPlugins() {
  try {
    const resp = await http.get("/plugins");
    pluginList.value = (resp.data.items ?? []).map((p: { key: string; name?: string }) => ({
      key: p.key,
      name: p.name ?? p.key
    }));
  } catch {
    pluginList.value = [];
  }
}

async function loadRules() {
  const resp = await http.get("/rules");
  rules.value = resp.data.items ?? [];
}

onMounted(() => {
  void loadRules();
  void loadPlugins();
});

function openCreate() {
  editId.value = null;
  form.value = {
    name: "",
    keywordDescription: "",
    description: "",
    keywords: [],
    negativeKeywords: [],
    selectedPluginKeys: [],
    promptFile: "",
    contentLength: undefined,
    contentMinLength: undefined,
    subredditWhitelist: [],
    subredditBlacklist: []
  };
  originalWhitelist.value = [];
  originalBlacklist.value = [];
  addWhitelistInput.value = "";
  addBlacklistInput.value = "";
  keywordSearch.value = "";
  keywordPage.value = 1;
  addKeywordInput.value = "";
  negativeKeywordSearch.value = "";
  negativeKeywordPage.value = 1;
  addNegativeKeywordInput.value = "";
  createVisible.value = true;
}

async function openEdit(rule: RuleItem) {
  editId.value = rule.id;
  try {
    const resp = await http.get(`/rules/${rule.id}`);
    const r = resp.data;
    form.value = {
      name: r.name ?? "",
      keywordDescription: r.keywordDescription ?? "",
      description: r.description ?? "",
      keywords: (r.keywords ?? []).map((t: string) => ({ text: t, isNew: false })),
      negativeKeywords: (r.negativeKeywords ?? []).map((t: string) => ({ text: t, isNew: false })),
      selectedPluginKeys: parsePluginsString(r.plugins),
      promptFile: r.promptFile ?? "",
      contentLength: r.contentLength ?? undefined,
      contentMinLength: r.contentMinLength ?? undefined,
      subredditWhitelist: [],
      subredditBlacklist: []
    };
  } catch {
    form.value = {
      name: "",
      keywordDescription: "",
      description: "",
      keywords: [],
      negativeKeywords: [],
      selectedPluginKeys: [],
      promptFile: "",
      contentLength: undefined,
      contentMinLength: undefined,
      subredditWhitelist: [],
      subredditBlacklist: []
    };
  }
  // req0310: 加载该规则的 subreddit 黑/白名单
  try {
    const f = await http.get(`/rules/${rule.id}/subreddit-filters`);
    const wl = Array.isArray(f.data?.whitelist) ? f.data.whitelist : [];
    const bl = Array.isArray(f.data?.blacklist) ? f.data.blacklist : [];
    form.value.subredditWhitelist = wl;
    form.value.subredditBlacklist = bl;
    originalWhitelist.value = [...wl];
    originalBlacklist.value = [...bl];
  } catch {
    form.value.subredditWhitelist = [];
    form.value.subredditBlacklist = [];
    originalWhitelist.value = [];
    originalBlacklist.value = [];
  }
  addWhitelistInput.value = "";
  addBlacklistInput.value = "";
  keywordSearch.value = "";
  keywordPage.value = 1;
  addKeywordInput.value = "";
  negativeKeywordSearch.value = "";
  negativeKeywordPage.value = 1;
  addNegativeKeywordInput.value = "";
  createVisible.value = true;
}

function closeCreate() {
  createVisible.value = false;
}

async function handleGenerateKeywords() {
  const desc = form.value.keywordDescription?.trim();
  if (!desc) return;
  generateLoading.value = true;
  try {
    const resp = await http.post("/rules/generate-keywords", {
      name: form.value.name,
      keywordDescription: desc
    });
    const list = (resp.data.keywords ?? []).map((t: string) => ({
      text: t,
      isNew: false
    }));
    form.value.keywords = list;
    keywordPage.value = 1;
  } finally {
    generateLoading.value = false;
  }
}

async function handleSupplementKeywords() {
  const desc = form.value.keywordDescription?.trim();
  if (!desc || form.value.keywords.length === 0) return;
  supplementLoading.value = true;
  const startLen = form.value.keywords.length;
  try {
    const resp = await http.post("/rules/supplement-keywords", {
      keywordDescription: desc,
      keywords: form.value.keywords.map((k) => k.text)
    });
    const appended = (resp.data.keywords ?? []).map((t: string) => ({
      text: t,
      isNew: true
    }));
    form.value.keywords = form.value.keywords.concat(appended);
    keywordPage.value = Math.ceil((startLen + appended.length) / pageSize.value);
    await nextTick();
    keywordListRef.value?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } finally {
    supplementLoading.value = false;
  }
}

function removeKeyword(index: number) {
  form.value.keywords.splice(index, 1);
}

function addKeywordsFromInput() {
  const raw = addKeywordInput.value.trim();
  if (!raw) return;
  const parts = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  const existing = new Set(form.value.keywords.map((k) => k.text));
  for (const p of parts) {
    if (!existing.has(p)) {
      form.value.keywords.push({ text: p, isNew: false });
      existing.add(p);
    }
  }
  addKeywordInput.value = "";
}

function removeNegativeKeyword(index: number) {
  form.value.negativeKeywords.splice(index, 1);
}

function addNegativeKeywordsFromInput() {
  const raw = addNegativeKeywordInput.value.trim();
  if (!raw) return;
  const parts = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  const existing = new Set(form.value.negativeKeywords.map((k) => k.text));
  for (const p of parts) {
    if (!existing.has(p)) {
      form.value.negativeKeywords.push({ text: p, isNew: false });
      existing.add(p);
    }
  }
  addNegativeKeywordInput.value = "";
}

function normalizeNames(input: string): string[] {
  return input
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function addWhitelistFromInput() {
  const parts = normalizeNames(addWhitelistInput.value);
  const existing = new Set(form.value.subredditWhitelist.map((s) => s.toLowerCase()));
  for (const p of parts) {
    if (!existing.has(p.toLowerCase())) {
      form.value.subredditWhitelist.push(p);
      existing.add(p.toLowerCase());
    }
  }
  addWhitelistInput.value = "";
}
function addBlacklistFromInput() {
  const parts = normalizeNames(addBlacklistInput.value);
  const existing = new Set(form.value.subredditBlacklist.map((s) => s.toLowerCase()));
  for (const p of parts) {
    if (!existing.has(p.toLowerCase())) {
      form.value.subredditBlacklist.push(p);
      existing.add(p.toLowerCase());
    }
  }
  addBlacklistInput.value = "";
}
function removeWhitelist(name: string) {
  form.value.subredditWhitelist = form.value.subredditWhitelist.filter(
    (s) => s.toLowerCase() !== name.toLowerCase()
  );
}
function removeBlacklist(name: string) {
  form.value.subredditBlacklist = form.value.subredditBlacklist.filter(
    (s) => s.toLowerCase() !== name.toLowerCase()
  );
}

async function submitRule() {
  const payload = {
    name: form.value.name,
    keywordDescription: form.value.keywordDescription,
    description: form.value.description,
    keywords: form.value.keywords.map((k) => k.text),
    negativeKeywords: form.value.negativeKeywords.map((k) => k.text),
    plugins: serializePlugins(form.value.selectedPluginKeys),
    promptFile: form.value.promptFile?.trim() || undefined,
    contentLength: form.value.contentLength ?? undefined,
    contentMinLength: form.value.contentMinLength ?? undefined
  };
  let ruleId = editId.value ?? null;
  if (editId.value) {
    await http.post("/rules", { ...payload, id: editId.value });
  } else {
    const created = await http.post("/rules", payload);
    ruleId = created.data?.id ?? null;
  }

  // req0310: 同步该规则的 subreddit 黑/白名单（差量更新）
  if (ruleId) {
    const wlNow = form.value.subredditWhitelist;
    const blNow = form.value.subredditBlacklist;
    const wlOld = originalWhitelist.value;
    const blOld = originalBlacklist.value;

    const toSet = (arr: string[]) => new Set(arr.map((s) => s.toLowerCase()));
    const wlNowSet = toSet(wlNow);
    const wlOldSet = toSet(wlOld);
    const blNowSet = toSet(blNow);
    const blOldSet = toSet(blOld);

    const wlAdd = wlNow.filter((s) => !wlOldSet.has(s.toLowerCase()));
    const wlDel = wlOld.filter((s) => !wlNowSet.has(s.toLowerCase()));
    const blAdd = blNow.filter((s) => !blOldSet.has(s.toLowerCase()));
    const blDel = blOld.filter((s) => !blNowSet.has(s.toLowerCase()));

    await Promise.all([
      ...wlAdd.map((name) =>
        http.post(`/rules/${ruleId}/subreddit-whitelist`, { name })
      ),
      ...wlDel.map((name) =>
        http.delete(`/rules/${ruleId}/subreddit-whitelist`, { data: { name } })
      ),
      ...blAdd.map((name) =>
        http.post(`/rules/${ruleId}/subreddit-blacklist`, { name })
      ),
      ...blDel.map((name) =>
        http.delete(`/rules/${ruleId}/subreddit-blacklist`, { data: { name } })
      )
    ]);
  }

  createVisible.value = false;
  await loadRules();
}

async function toggleRule(rule: RuleItem) {
  await http.post(`/rules/${rule.id}/state`, {
    disabled: !rule.disabled
  });
  await loadRules();
}

async function deleteRule(rule: RuleItem) {
  await http.delete(`/rules/${rule.id}`);
  await loadRules();
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.table-cell-ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.keyword-search {
  margin-bottom: 8px;
  max-width: 320px;
}

.keyword-list-wrap {
  min-height: 120px;
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 8px;
  background: #fafafa;
}

.keyword-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 4px;
}

.keyword-row-new {
  background: rgba(255, 77, 79, 0.08);
}

.keyword-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.keyword-delete {
  flex-shrink: 0;
}

.keyword-empty {
  color: #999;
  padding: 16px;
  text-align: center;
}

.tag-list {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.keyword-pagination {
  margin-top: 8px;
}

.keyword-add-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  align-items: center;
}

.keyword-add-input {
  flex: 1;
}

.plugin-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.plugin-empty {
  color: #999;
  font-size: 12px;
}

.modal-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
