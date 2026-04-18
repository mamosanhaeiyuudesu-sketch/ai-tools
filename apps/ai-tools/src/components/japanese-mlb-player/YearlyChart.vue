<template>
  <div>
    <!-- 指標ピル -->
    <div class="flex flex-wrap gap-2 mb-4">
      <button
        v-for="stat in activeMeta"
        :key="stat.key"
        @click="selectedMetric = stat.key"
        class="px-3 py-1 rounded-full text-xs font-medium transition-colors duration-150"
        :class="selectedMetric === stat.key
          ? 'bg-blue-600 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
      >{{ stat.label }}</button>
    </div>

    <!-- チャート -->
    <div ref="chartEl" class="w-full" style="height: 300px;" />

    <!-- 年度テーブル -->
    <div class="mt-6 overflow-x-auto">
      <table class="w-full text-xs border-collapse">
        <thead>
          <tr class="border-b border-slate-200">
            <th class="text-left py-2 px-3 text-slate-500 font-medium">年度</th>
            <th
              v-for="player in selectedPlayerList"
              :key="player.id"
              class="text-center py-2 px-3 font-medium whitespace-nowrap"
              :style="{ color: colors[player.id] }"
            >{{ player.nameJa }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="year in allYears"
            :key="year"
            class="border-b border-slate-100 hover:bg-slate-50"
          >
            <td class="py-2 px-3 font-medium text-slate-700">{{ year }}</td>
            <td
              v-for="player in selectedPlayerList"
              :key="player.id"
              class="py-2 px-3 text-center font-mono text-slate-700"
            >
              {{ getYearlyValue(player.id, year) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { YearlyData } from '~/types/mlb'
import { PITCHER_PLAYERS, BATTER_PLAYERS, PITCHER_STATS, BATTER_STATS, PLAYER_COLORS } from '~/utils/japanese-mlb-player/players'

const props = defineProps<{
  selectedIds: string[]
  yearlyDataMap: Map<string, YearlyData>
  mode: 'pitcher' | 'batter' | 'mixed'
}>()

const chartEl = ref<HTMLDivElement>()
const selectedMetric = ref('era')
let chart: import('echarts').ECharts | null = null
const colors = PLAYER_COLORS

const activeMeta = computed(() =>
  props.mode === 'batter' ? BATTER_STATS : PITCHER_STATS
)

watch(() => props.mode, (mode) => {
  selectedMetric.value = mode === 'batter' ? 'avg' : 'era'
}, { immediate: true })

const selectedPlayerList = computed(() => {
  const all = [...PITCHER_PLAYERS, ...BATTER_PLAYERS]
  return props.selectedIds.map(id => all.find(p => p.id === id)).filter(Boolean) as typeof PITCHER_PLAYERS
})

const allYears = computed(() => {
  const years = new Set<number>()
  for (const id of props.selectedIds) {
    const d = props.yearlyDataMap.get(id)
    if (!d) continue
    const rows = props.mode === 'batter' ? d.yearlyBatter : d.yearlyPitcher
    rows.forEach(r => years.add(r.season))
  }
  return [...years].sort()
})

function getRawValue(playerId: string, year: number): number | null {
  const d = props.yearlyDataMap.get(playerId)
  if (!d) return null
  const rows = props.mode === 'batter' ? d.yearlyBatter : d.yearlyPitcher
  const row = rows.find(r => r.season === year)
  if (!row) return null
  return (row as Record<string, unknown>)[selectedMetric.value] as number | null
}

function getYearlyValue(playerId: string, year: number): string {
  const meta = activeMeta.value.find(m => m.key === selectedMetric.value)
  const val = getRawValue(playerId, year)
  return meta ? meta.format(val) : (val === null ? '—' : String(val))
}

async function renderChart() {
  if (!chartEl.value) return
  const EC = await import('echarts')
  if (!chart) {
    chart = EC.init(chartEl.value, undefined, { renderer: 'svg' })
  }

  const meta = activeMeta.value.find(m => m.key === selectedMetric.value)
  const years = allYears.value
  if (!years.length) { chart.clear(); return }

  const series = props.selectedIds.map(id => {
    const player = [...PITCHER_PLAYERS, ...BATTER_PLAYERS].find(p => p.id === id)
    if (!player) return null
    return {
      name: player.nameJa,
      type: 'line',
      smooth: false,
      data: years.map(y => getRawValue(id, y)),
      lineStyle: { color: PLAYER_COLORS[id], width: 2 },
      itemStyle: { color: PLAYER_COLORS[id] },
      symbol: 'circle',
      symbolSize: 6,
      connectNulls: false,
    }
  }).filter(Boolean)

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown[]) => {
        const ps = params as Array<{ seriesName: string; value: number; color: string; axisValue: number }>
        const year = ps[0]?.axisValue ?? ''
        const lines = ps
          .filter(p => p.value !== null && p.value !== undefined)
          .map(p => `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>${meta?.format(p.value) ?? p.value}</b>`)
        return `<div class="text-xs">${year}年<br/>${lines.join('<br/>')}</div>`
      },
    },
    legend: {
      data: series.map(s => (s as { name: string }).name),
      textStyle: { fontSize: 11 },
      top: 0,
    },
    grid: { top: 40, right: 16, bottom: 40, left: 52 },
    xAxis: {
      type: 'category',
      data: years,
      axisLabel: { fontSize: 10, formatter: (v: number) => `${v}` },
    },
    yAxis: {
      type: 'value',
      inverse: meta?.direction === 'low',
      axisLabel: { fontSize: 10, formatter: (v: number) => meta?.format(v) ?? v },
    },
    series,
  }, true)
}

watch(
  [() => props.selectedIds, () => props.yearlyDataMap, selectedMetric],
  renderChart,
  { deep: true }
)

onMounted(renderChart)

onBeforeUnmount(() => {
  chart?.dispose()
  chart = null
})
</script>
