<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref } from 'vue'

const props = defineProps<{
  words: { word: string; score: number }[]
  height?: number
}>()

const emit = defineEmits<{
  'word-click': [word: string]
}>()

const container = ref<HTMLElement>()
let chart: any = null

async function render() {
  if (!container.value || !props.words.length) return

  const Highcharts = (await import('highcharts')).default
  const WordCloudModule = await import('highcharts/modules/wordcloud')
  ;(WordCloudModule.default ?? WordCloudModule)(Highcharts)

  if (chart) {
    chart.destroy()
    chart = null
  }

  chart = Highcharts.chart(container.value, {
    chart: {
      backgroundColor: 'transparent',
      margin: [0, 0, 0, 0],
      spacing: [0, 0, 0, 0],
    },
    title: { text: '' },
    tooltip: {
      formatter(this: any) {
        return `<b>${this.point.name}</b><br>特徴度: ${(this.point.weight / 10000).toFixed(4)}`
      },
    },
    series: [
      {
        type: 'wordcloud',
        name: '特徴度',
        data: props.words.map((w) => ({
          name: w.word,
          weight: Math.round(w.score * 10000),
        })),
        rotation: {
          from: -30,
          to: 30,
          orientations: 3,
        },
        style: {
          fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif',
          fontWeight: '600',
        },
        cursor: 'pointer',
        point: {
          events: {
            click: (e: any) => {
              emit('word-click', e.point.name)
            },
          },
        },
      },
    ],
    credits: { enabled: false },
  })
}

onMounted(render)
watch(() => props.words, render, { deep: true })
onBeforeUnmount(() => {
  if (chart) chart.destroy()
})
</script>

<template>
  <div ref="container" :style="`width:100%; height:${height ?? 420}px`" />
</template>
