<template>
  <div>
    <div class="page-header">
      <h2>系统设置</h2>
    </div>

    <a-card title="压力查看 / 自检">
      <a-descriptions bordered :column="1" size="small">
        <a-descriptions-item label="已注册插件数">
          {{ status.registeredPlugins }}
        </a-descriptions-item>
        <a-descriptions-item label="调度队列长度">
          {{ status.schedulerQueueLength }}
        </a-descriptions-item>
        <a-descriptions-item label="近期错误统计（24h）">
          {{ status.recentErrors }}
        </a-descriptions-item>
      </a-descriptions>
      <div style="margin-top: 12px">
        <a-button type="primary" @click="refresh">刷新</a-button>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { http } from "@/api/http";

const status = ref({
  registeredPlugins: 0,
  schedulerQueueLength: 0,
  recentErrors: 0
});

async function refresh() {
  const resp = await http.get("/status");
  status.value = {
    registeredPlugins: resp.data.registeredPlugins ?? 0,
    schedulerQueueLength: resp.data.queueLength ?? 0,
    recentErrors: resp.data.recentErrorCount24h ?? 0
  };
}
</script>

<style scoped>
.page-header {
  margin-bottom: 16px;
}
</style>

