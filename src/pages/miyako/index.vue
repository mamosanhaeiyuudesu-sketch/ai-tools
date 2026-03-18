<script setup lang="ts">
definePageMeta({ ssr: false })

interface WordScore {
  word: string
  score: number
}

type FeaturesData = Record<string, WordScore[]>

const STOPWORDS = new Set([
  '言う', 'つく', '此れ', '其れ', '其の', '此の', '成る', '有る', '居る', '致す',
  '掛かる', '受ける', '関する', '行う', '行なう', '元年', '因る', '出る', '入る',
  '見る', '置く', '来る', '対する', '付く', '取る', '当たる', '係る', '伴う',
  '図る', '向ける', '与える', '設ける', '基づく', '求める', '休憩', '質疑',
  '議決', '議案', '請け負い', '一貫',
])

const TOP_KEYWORDS = 35

const loading = ref(true)
const rawData = ref<FeaturesData>({})
const sessionTypeFilter = ref<'all' | '定例会' | '臨時会'>('all')
const selectedSession = ref<string | null>(null)

const heatmapRef = ref<HTMLElement>()
const wordcloudRef = ref<HTMLElement>()
let heatmapChart: any = null
let wordcloudChart: any = null
let HC: any = null

onMounted(async () => {
  const Highcharts = (await import('highcharts')).default
  await import('highcharts/modules/heatmap')
  await import('highcharts/modules/wordcloud')
  await import('highcharts/modules/accessibility')
  HC = Highcharts

  rawData.value = await $fetch<FeaturesData>('/data/miyako-features.json')
  loading.value = false
  await nextTick()
  renderHeatmap()
})

onUnmounted(() => {
  heatmapChart?.destroy()
  wordcloudChart?.destroy()
})

function parseDate(key: string): Date {
  const m = key.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? new Date(m[1]) : new Date(0)
}

function shortLabel(key: string): string {
  const m = key.match(/(令和|平成)(元|\d+)年\s+第(\d+)回\s+(定例会|臨時会)/)
  if (!m) return key
  const era = m[1] === '令和' ? 'R' : 'H'
  const year = m[2] === '元' ? '1' : m[2]
  const type = m[4] === '定例会' ? '定' : '臨'
  return `${era}${year}-${m[3]}${type}`
}

const filteredSessions = computed(() =>
  Object.keys(rawData.value)
    .filter(k => sessionTypeFilter.value === 'all' || k.includes(sessionTypeFilter.value))
    .sort((a, b) => parseDate(a).getTime() - parseDate(b).getTime())
)

const topKeywords = computed(() => {
  const maxScore = new Map<string, number>()
  for (const words of Object.values(rawData.value)) {
    for (const { word, score } of words) {
      if (!STOPWORDS.has(word) && (maxScore.get(word) ?? 0) < score) {
        maxScore.set(word, score)
      }
    }
  }
  return [...maxScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_KEYWORDS)
    .map(([w]) => w)
})

function renderHeatmap() {
  if (!heatmapRef.value || !HC) return
  const sessions = filteredSessions.value
  const keywords = topKeywords.value

  const data: [number, number, number | null][] = []
  for (let si = 0; si < sessions.length; si++) {
    const wordMap = new Map(
      (rawData.value[sessions[si]] ?? []).map(w => [w.word, w.score])
    )
    for (let ki = 0; ki < keywords.length; ki++) {
      const s = wordMap.get(keywords[ki])
      data.push([si, ki, s !== undefined ? s : null])
    }
  }

  heatmapChart?.destroy()
  heatmapChart = HC.chart(heatmapRef.value, {
    chart: {
      type: 'heatmap',
      scrollablePlotArea: {
        minWidth: sessions.length * 24,
        scrollPositionX: 1,
      },
      style: { fontFamily: 'inherit' },
      marginRight: 160,
      animation: false,
    },
    title: { text: undefined },
    xAxis: {
      categories: sessions.map(shortLabel),
      labels: { rotation: -60, style: { fontSize: '9px' } },
    },
    yAxis: {
      categories: keywords,
      title: { text: undefined },
      labels: { style: { fontSize: '11px' } },
      reversed: false,
    },
    colorAxis: {
      min: 0,
      max: 0.45,
      stops: [
        [0, '#EEF0FF'],
        [0.5, '#7986CB'],
        [1, '#1A237E'],
      ],
      nullColor: '#EEEEEE',
      labels: { format: '{value:.2f}' },
    },
    legend: {
      align: 'right',
      layout: 'vertical',
      verticalAlign: 'middle',
    },
    tooltip: {
      formatter: function (this: any) {
        if (this.point.value === null || this.point.value === undefined) return false
        return `<b>${sessions[this.point.x]}</b><br/>${keywords[this.point.y]}: <b>${this.point.value.toFixed(3)}</b>`
      },
    },
    series: [{
      type: 'heatmap',
      name: '特徴度',
      data,
      cursor: 'pointer',
      borderWidth: 0.3,
      borderColor: '#FAFAFA',
      point: {
        events: {
          click: function (this: any) {
            const sessionKey = sessions[this.x]
            selectedSession.value = sessionKey
            nextTick(() => renderWordcloud())
          },
        },
      },
    }],
    credits: { enabled: false },
  })
}

function renderWordcloud() {
  if (!wordcloudRef.value || !HC || !selectedSession.value) return
  const words = (rawData.value[selectedSession.value] ?? [])
    .filter(w => !STOPWORDS.has(w.word))
    .map(w => ({ name: w.word, weight: Math.ceil(w.score * 100) }))

  wordcloudChart?.destroy()
  wordcloudChart = HC.chart(wordcloudRef.value, {
    series: [{
      type: 'wordcloud',
      data: words,
      name: '特徴度',
      colors: [
        '#1A237E', '#283593', '#303F9F', '#3949AB',
        '#3F51B5', '#5C6BC0', '#7986CB', '#9FA8DA',
        '#C5CAE9', '#0D47A1', '#1565C0', '#1976D2',
      ],
    }],
    title: { text: undefined },
    tooltip: {
      formatter: function (this: any) {
        return `<b>${this.point.name}</b><br/>特徴度: ${(this.point.weight / 100).toFixed(3)}`
      },
    },
    credits: { enabled: false },
  })
}

watch(sessionTypeFilter, async () => {
  selectedSession.value = null
  wordcloudChart?.destroy()
  wordcloudChart = null
  await nextTick()
  renderHeatmap()
})
</script>

<template>
  <v-container max-width="1400" class="miyako-container">
    <div class="miyako-header">
      <h1 class="miyako-title">宮古島市議会 議事録分析</h1>
      <p class="miyako-subtitle">2019〜2025年 会期別キーワード特徴度ヒートマップ</p>
    </div>

    <v-card class="mb-4" elevation="1">
      <v-card-text class="d-flex align-center gap-4 flex-wrap py-3">
        <v-btn-toggle v-model="sessionTypeFilter" mandatory color="indigo" variant="outlined" density="compact">
          <v-btn value="all">すべて</v-btn>
          <v-btn value="定例会">定例会</v-btn>
          <v-btn value="臨時会">臨時会</v-btn>
        </v-btn-toggle>
        <span class="text-caption text-medium-emphasis">
          {{ filteredSessions.length }} 会期 / 上位 {{ TOP_KEYWORDS }} キーワード
        </span>
      </v-card-text>
    </v-card>

    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="indigo" size="48" />
    </div>

    <template v-else>
      <v-card class="mb-4" elevation="1">
        <v-card-text class="pa-3">
          <p class="text-caption text-medium-emphasis mb-3">
            <v-icon size="13" class="mr-1">mdi-gesture-tap</v-icon>
            列をクリックすると会期のワードクラウドを表示 —
            <v-icon size="13" class="mx-1">mdi-gesture-swipe-horizontal</v-icon>
            横スクロールで全会期を確認（右端が最新）
          </p>
          <div ref="heatmapRef" class="heatmap-container"></div>
        </v-card-text>
      </v-card>

      <v-card v-if="selectedSession" elevation="1">
        <v-card-title class="text-subtitle-1 px-4 pt-3 pb-1">
          <v-icon class="mr-2" color="indigo" size="18">mdi-cloud</v-icon>
          {{ selectedSession }}
        </v-card-title>
        <v-card-text class="pa-3">
          <div ref="wordcloudRef" class="wordcloud-container"></div>
        </v-card-text>
      </v-card>

      <div v-else class="text-center py-8 text-medium-emphasis text-body-2">
        <v-icon size="24" class="d-block mb-2">mdi-gesture-tap</v-icon>
        ヒートマップの列をクリックすると、その会期のワードクラウドが表示されます
      </div>
    </template>
  </v-container>
</template>

<style scoped>
.miyako-container {
  padding-top: 24px;
  padding-bottom: 48px;
}

.miyako-header {
  text-align: center;
  margin-bottom: 24px;
}

.miyako-title {
  font-size: clamp(20px, 4vw, 28px);
  font-weight: 700;
  margin: 0 0 4px;
}

.miyako-subtitle {
  color: rgba(0, 0, 0, 0.54);
  margin: 0;
}

.heatmap-container {
  width: 100%;
  height: 540px;
  overflow: hidden;
}

.wordcloud-container {
  width: 100%;
  height: 360px;
}
</style>
