<template>
  <div ref="containerRef" class="word-cloud-chart" :style="{ height: `${height}px` }" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as echarts from "echarts";
import "echarts-wordcloud";

interface WordItem {
  word: string;
  count: number;
}

const props = withDefaults(
  defineProps<{
    words: WordItem[];
    maxItems?: number;
    height?: number;
  }>(),
  {
    maxItems: 300,
    height: 320
  }
);
const height = props.height;

const containerRef = ref<HTMLElement | null>(null);
let chart: echarts.ECharts | null = null;

function toSeriesData(words: WordItem[]) {
  return words
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, props.maxItems)
    .map((x) => ({ name: x.word, value: x.count }));
}

function render() {
  if (!containerRef.value) return;
  if (!chart) {
    chart = echarts.init(containerRef.value);
  }
  chart.setOption({
    backgroundColor: "#fff",
    tooltip: {},
    series: [
      {
        type: "wordCloud",
        shape: "circle",
        left: "center",
        top: "center",
        width: "95%",
        height: "95%",
        sizeRange: [12, 50],
        rotationRange: [-60, 60],
        rotationStep: 15,
        gridSize: 8,
        drawOutOfBound: false,
        textStyle: {
          fontFamily: "sans-serif"
        },
        emphasis: {
          textStyle: {
            shadowBlur: 8,
            shadowColor: "#999"
          }
        },
        data: toSeriesData(props.words)
      }
    ]
  });
}

function onResize() {
  chart?.resize();
}

watch(
  () => props.words,
  () => render(),
  { deep: true }
);

onMounted(() => {
  render();
  window.addEventListener("resize", onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  chart?.dispose();
  chart = null;
});
</script>

<style scoped>
.word-cloud-chart {
  width: 100%;
  min-height: 220px;
}
</style>
