<script setup lang="ts">
interface WordScore {
  word: string
  score: number
}

const props = defineProps<{
  sessions: string[]
  keywords: string[]
  rawData: Record<string, WordScore[]>
  shortLabel: (key: string) => string
}>()

const emit = defineEmits<{
  'session-click': [session: string]
}>()

const CELL_WIDTH = 28

const heatmapRef = ref<HTMLElement>()
let heatmapChart: any = null
let EC: any = null

onMounted(async () => {
  EC = await import('echarts')
  render()
})

onUnmounted(() => {
  heatmapChart?.dispose()
})

watch([() => props.sessions, () => props.keywords], render)

function render() {
  if (!heatmapRef.value || !EC) return
  const { sessions, keywords, rawData, shortLabel } = props
  const rowHeight = 22
  const chartHeight = keywords.length * rowHeight + 54
  const chartWidth = sessions.length * CELL_WIDTH + 37

  const data: [number, number, number][] = []
  for (let si = 0; si < sessions.length; si++) {
    const wordMap = new Map(
      (rawData[sessions[si]] ?? []).map(w => [w.word, w.score])
    )
    for (let ki = 0; ki < keywords.length; ki++) {
      const s = wordMap.get(keywords[ki])
      data.push([si, ki, s !== undefined ? s : -1])
    }
  }

  heatmapChart?.dispose()
  heatmapRef.value.style.width = chartWidth + 'px'
  heatmapRef.value.style.height = chartHeight + 'px'
  heatmapChart = EC.init(heatmapRef.value, null, { renderer: 'canvas' })

  heatmapChart.setOption({
    animation: false,
    grid: { top: 40, right: 7, bottom: 4, left: 50 },
    xAxis: {
      type: 'category',
      data: sessions.map(shortLabel),
      position: 'top',
      axisLabel: { rotate: 60, fontSize: 9, align: 'left', margin: 35 },
      splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.08)' } },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: keywords,
      inverse: true,
      axisLabel: { fontSize: 11 },
      splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.08)' } },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    visualMap: {
      show: false,
      min: 0,
      max: 0.45,
      inRange: { color: ['#EEF0FF', '#7986CB', '#1A237E'] },
      outOfRange: { color: '#EEEEEE' },
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.value[2] < 0) return ''
        const label = sessions[params.value[0]].replace(/〜[\d-]+$/, '〜')
        return `<b>${label}</b><br/>${keywords[params.value[1]]}: <b>${params.value[2].toFixed(3)}</b>`
      },
    },
    series: [{
      type: 'heatmap',
      data,
      cursor: 'pointer',
      itemStyle: { borderWidth: 0.5, borderColor: '#FAFAFA' },
      emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.2)' } },
    }],
  })

  heatmapChart.on('click', (params: any) => {
    if (params.value[2] < 0) return
    emit('session-click', sessions[params.value[0]])
  })
}

defineExpose({ render })
</script>

<template>
  <div class="bg-white border border-[#dde2ef] rounded-[10px] shadow-[0_1px_4px_rgba(28,45,90,0.07),0_0_0_1px_rgba(28,45,90,0.06)] overflow-hidden">
    <div class="flex items-center gap-1 px-3.5 py-2.5 border-b border-[#dde2ef] bg-[#fafbff]">
      <span class="text-[11.5px] font-bold text-[#1c2d5a] tracking-[0.03em]">■ キーワード分布</span>
      <slot name="label" />
      <span class="hidden md:inline text-[10.5px] text-[#6878a8] ml-auto opacity-70">列をクリックでワードクラウドを表示</span>
    </div>
    <div class="overflow-auto max-h-[600px] p-0.5 md:p-1.5">
      <div ref="heatmapRef" class="inline-block" />
    </div>
  </div>
</template>
