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
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
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
      title="新增规则"
      :footer="null"
      width="720px"
    >
      <div v-if="step === 1">
        <a-form layout="vertical">
          <a-form-item label="规则名称">
            <a-input v-model:value="form.name" />
          </a-form-item>
          <a-form-item label="规则描述">
            <a-textarea
              v-model:value="form.description"
              :rows="6"
              placeholder="请尽可能详细地描述你关心的数据是什么样子的，越详细越好，例如包含哪些字段、使用场景、典型标题和正文示例等。"
            />
          </a-form-item>
        </a-form>
        <div class="modal-footer">
          <a-button @click="closeCreate">取消</a-button>
          <a-button type="primary" @click="nextStep">下一步</a-button>
        </div>
      </div>

      <div v-else>
        <p>根据你的描述，系统已为你生成以下关键字，你可以删除不需要的关键字。</p>
        <div class="keyword-list">
          <a-tag
            v-for="(keyword, index) in form.keywords"
            :key="keyword + index"
            closable
            @close="removeKeyword(index)"
          >
            {{ keyword }}
          </a-tag>
        </div>
        <div class="modal-footer">
          <a-button @click="resetStep">重新设定</a-button>
          <a-button @click="closeCreate">取消</a-button>
          <a-button type="primary" @click="submitRule">完成</a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { http } from "@/api/http";

interface RuleItem {
  id: string;
  name: string;
  keywords: string[];
  lastRunAt?: string;
  disabled: boolean;
}

const columns = [
  { title: "规则名称", dataIndex: "name", key: "name" },
  {
    title: "关键字",
    dataIndex: "keywords",
    key: "keywords",
    customRender: ({ value }: { value: string[] }) =>
      value?.join("，") ?? ""
  },
  { title: "上次调度时间", dataIndex: "lastRunAt", key: "lastRunAt" },
  {
    title: "操作",
    key: "action"
  }
];

const rules = ref<RuleItem[]>([]);

const createVisible = ref(false);
const step = ref<1 | 2>(1);
const form = ref({
  name: "",
  description: "",
  keywords: [] as string[]
});

async function loadRules() {
  const resp = await http.get("/rules");
  rules.value = resp.data.items ?? [];
}

onMounted(() => {
  void loadRules();
});

function openCreate() {
  createVisible.value = true;
  step.value = 1;
}

function closeCreate() {
  createVisible.value = false;
}

async function nextStep() {
  const resp = await http.post("/rules/generate-keywords", {
    name: form.value.name,
    description: form.value.description
  });
  form.value.keywords = resp.data.keywords ?? [];
  step.value = 2;
}

function resetStep() {
  step.value = 1;
}

function removeKeyword(index: number) {
  form.value.keywords.splice(index, 1);
}

async function submitRule() {
  await http.post("/rules", {
    name: form.value.name,
    description: form.value.description,
    keywords: form.value.keywords
  });
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

.modal-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.keyword-list {
  min-height: 80px;
}
</style>

