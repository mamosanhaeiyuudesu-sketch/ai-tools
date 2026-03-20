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
  '議決', '議案', '請け負い', '一貫', '子供', '道路',
])

const TOP_KEYWORDS = 100
const MAX_DISPLAY = 20
const CELL_WIDTH = 28

const loading = ref(true)
const rawData = ref<FeaturesData>({})
const sessionTypeFilter = ref<'定例会' | '臨時会'>('定例会')
const selectedSession = ref<string | null>(null)
const sessionCount = MAX_DISPLAY
const windowEnd = ref(0)

const selectedWord = ref<string | null>(null)
const aiSummary = ref<string>('')
const aiLoading = ref(false)
const maxChars = ref(1000)
const MAX_CHARS_OPTIONS = [500, 1000, 2000]

const { marked } = await import('marked')
const renderedSummary = computed(() => {
  if (!aiSummary.value) return ''
  const html = marked(aiSummary.value) as string
  // ↓ のみの段落にクラスを付与してフロー矢印として強調
  return html.replace(/<p>↓<\/p>/g, '<p class="flow-arrow">↓</p>')
})

const WC_COLORS = [
  '#1A237E', '#283593', '#303F9F', '#3949AB',
  '#3F51B5', '#5C6BC0', '#7986CB', '#0D47A1',
  '#1565C0', '#1976D2', '#1E88E5',
]

const wordcloudWords = computed(() => {
  if (!selectedSession.value) return []
  const words = (rawData.value[selectedSession.value] ?? [])
    .filter(w => !STOPWORDS.has(w.word))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
  if (!words.length) return []
  const maxScore = words[0].score
  const minScore = words[words.length - 1].score
  const range = maxScore - minScore || 1
  return words.map((w, i) => {
    const t = (w.score - minScore) / range
    const size = Math.round(11 + Math.pow(t, 0.55) * 26)  // 11px〜37px（平方根に近いカーブ）
    return { name: w.word, score: w.score, size, color: WC_COLORS[i % WC_COLORS.length] }
  })
})

// ── ワードクラウド螺旋レイアウト ─────────────────
const wcContainerRef = ref<HTMLElement>()
const wcPositions = ref<Record<string, { x: number; y: number }>>({})
const wcReady = ref(false)

// selectedSession が変わったらリセット（pre: DOM更新前）
watch(selectedSession, () => {
  wcReady.value = false
  wcPositions.value = {}
})

// 単語リストが変わった後（post: DOM更新後）に配置計算
watch(wordcloudWords, (words) => {
  if (!words.length) return
  layoutWordcloud()
}, { flush: 'post' })

function layoutWordcloud() {
  const container = wcContainerRef.value
  if (!container) return
  const cw = container.offsetWidth
  const ch = container.offsetHeight
  if (!cw || !ch) return

  const cx = cw / 2
  const cy = ch / 2
  const spans = Array.from(container.querySelectorAll<HTMLElement>('.wc-word'))
  const words = wordcloudWords.value
  if (!spans.length || spans.length !== words.length) return

  const newPos: Record<string, { x: number; y: number }> = {}
  const boxes: { x: number; y: number; hw: number; hh: number }[] = []

  for (let i = 0; i < spans.length; i++) {
    const el = spans[i]
    const hw = el.offsetWidth / 2 + 1
    const hh = el.offsetHeight / 2 + 1
    const name = words[i].name

    if (i === 0) {
      newPos[name] = { x: cx, y: cy }
      boxes.push({ x: cx, y: cy, hw, hh })
      continue
    }

    let px = cx, py = cy
    for (let step = 0; step < 2000; step++) {
      const theta = step * 0.12
      const r = 1.5 * theta
      const x = cx + r * Math.cos(theta)
      const y = cy + r * Math.sin(theta) * 0.65
      if (x - hw < 2 || x + hw > cw - 2) continue
      if (y - hh < 2 || y + hh > ch - 2) continue
      if (!boxes.some(b =>
        Math.abs(x - b.x) < hw + b.hw &&
        Math.abs(y - b.y) < hh + b.hh
      )) {
        px = x; py = y
        break
      }
    }
    newPos[name] = { x: px, y: py }
    boxes.push({ x: px, y: py, hw, hh })
  }

  // 配置済み単語の実際の占有矩形を測定してコンテナいっぱいに拡大
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (let i = 0; i < spans.length; i++) {
    const p = newPos[words[i].name]
    const hw = spans[i].offsetWidth / 2
    const hh = spans[i].offsetHeight / 2
    left   = Math.min(left,   p.x - hw)
    right  = Math.max(right,  p.x + hw)
    top    = Math.min(top,    p.y - hh)
    bottom = Math.max(bottom, p.y + hh)
  }
  const contentCx = (left + right) / 2
  const contentCy = (top + bottom) / 2
  const scaleX = (cw - 8) / (right - left)
  const scaleY = (ch - 8) / (bottom - top)
  const scale  = Math.min(scaleX, scaleY, 2.0)  // 最大2倍まで拡大

  if (scale > 1.05) {
    for (const name in newPos) {
      newPos[name] = {
        x: cx + (newPos[name].x - contentCx) * scale,
        y: cy + (newPos[name].y - contentCy) * scale,
      }
    }
  }

  wcPositions.value = newPos
  wcReady.value = true
}

const heatmapRef = ref<HTMLElement>()
let heatmapChart: any = null
let EC: any = null

onMounted(async () => {
  EC = await import('echarts')

  rawData.value = await $fetch<FeaturesData>('/data/miyako-features.json')
  loading.value = false
  await nextTick()
  renderHeatmap()
})

onUnmounted(() => {
  heatmapChart?.dispose()
})

function parseDate(key: string): Date {
  const m = key.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? new Date(m[1]) : new Date(0)
}

function shortLabel(key: string): string {
  const m = key.match(/(令和|平成)(元|\d+)年\s+第(\d+)回\s+(定例会|臨時会)/)
  if (!m) return key
  const era = m[1] === '令和' ? '令' : '平'
  const year = m[2] === '元' ? '1' : m[2]
  return `${era}${year}-${m[3]}`
}

const filteredSessions = computed(() =>
  Object.keys(rawData.value)
    .filter(k => k.includes(sessionTypeFilter.value))
    .sort((a, b) => parseDate(a).getTime() - parseDate(b).getTime())
)

const windowEndMax = computed(() => filteredSessions.value.length)
const windowEndMin = computed(() => Math.min(sessionCount, filteredSessions.value.length))

const displayedSessions = computed(() => {
  const sessions = filteredSessions.value
  if (!sessions.length) return []
  const end = Math.min(windowEnd.value, sessions.length)
  const start = Math.max(0, end - sessionCount)
  return sessions.slice(start, end)
})

const topKeywords = computed(() => {
  const maxScore = new Map<string, number>()
  for (const key of displayedSessions.value) {
    for (const { word, score } of (rawData.value[key] ?? [])) {
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

const rangeLabel = computed(() => {
  const s = displayedSessions.value
  if (!s.length) return ''
  return `${shortLabel(s[0])} 〜 ${shortLabel(s[s.length - 1])}`
})

watch(filteredSessions, (sessions) => {
  windowEnd.value = sessions.length
}, { immediate: true })



function renderHeatmap() {
  if (!heatmapRef.value || !EC) return
  const sessions = displayedSessions.value
  const keywords = topKeywords.value
  const rowHeight = 22
  const chartHeight = keywords.length * rowHeight + 140
  const chartWidth = sessions.length * CELL_WIDTH + 280

  // null を -1 で表現して outOfRange カラーに割り当てる
  const data: [number, number, number][] = []
  for (let si = 0; si < sessions.length; si++) {
    const wordMap = new Map(
      (rawData.value[sessions[si]] ?? []).map(w => [w.word, w.score])
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
    grid: { top: 80, right: 20, bottom: 10, left: 130 },
    xAxis: {
      type: 'category',
      data: sessions.map(shortLabel),
      position: 'top',
      axisLabel: { rotate: 60, fontSize: 9, align: 'left', margin: 34 },
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
    selectedSession.value = sessions[params.value[0]]
  })
}

async function fetchSummary(word: string) {
  if (!selectedSession.value) return
  selectedWord.value = word
  aiSummary.value = ''

  const cacheKey = `miyako_summary:${selectedSession.value}:${word}:${maxChars.value}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    aiSummary.value = cached
    return
  }

  aiLoading.value = true
  try {
    const data = await $fetch<{ summary: string }>('/api/miyako/search', {
      method: 'POST',
      body: { session: selectedSession.value, word, maxChars: maxChars.value },
    })
    aiSummary.value = data.summary
    localStorage.setItem(cacheKey, data.summary)
  } catch {
    aiSummary.value = '取得に失敗しました。'
  } finally {
    aiLoading.value = false
  }
}

async function resetAndRender() {
  selectedSession.value = null
  selectedWord.value = null
  aiSummary.value = ''
  await nextTick()
  renderHeatmap()
}

watch(sessionTypeFilter, async () => {
  await nextTick()
  resetAndRender()
})

watch([sessionCount, windowEnd], resetAndRender)
</script>

<template>
  <div class="miyako-root">

    <!-- ページヘッダー -->
    <header class="page-header">
      <div class="page-header-inner">
        <div>
          <h1 class="page-title">宮古島市議会<span class="page-title-accent">議事録分析</span></h1>
          <p class="page-subtitle">会期ごとのキーワード出現傾向と議論内容をAIで可視化</p>
        </div>
      </div>
    </header>

    <!-- コントロールバー -->
    <div class="controls-bar">
      <div class="controls-inner">
        <div class="ctrl-item">
          <span class="ctrl-label">会期</span>
          <v-btn-toggle v-model="sessionTypeFilter" mandatory color="indigo-darken-3" variant="outlined" density="compact" rounded="lg">
            <v-btn value="定例会" size="small">定例会</v-btn>
            <v-btn value="臨時会" size="small">臨時会</v-btn>
          </v-btn-toggle>
        </div>

        <div class="ctrl-item ctrl-item--slider">
          <span class="ctrl-label">期間</span>
          <v-slider
            v-model="windowEnd"
            :min="windowEndMin"
            :max="windowEndMax"
            :step="1"
            density="compact"
            hide-details
            color="indigo-darken-3"
            thumb-size="13"
            class="ctrl-slider"
          />
          <span class="ctrl-range">{{ rangeLabel }}</span>
        </div>

        <div class="ctrl-item">
          <span class="ctrl-label">要約文字数</span>
          <v-btn-toggle v-model="maxChars" mandatory color="indigo-darken-3" variant="outlined" density="compact" rounded="lg">
            <v-btn v-for="n in MAX_CHARS_OPTIONS" :key="n" :value="n" size="small">{{ n }}</v-btn>
          </v-btn-toggle>
        </div>
      </div>
    </div>

    <!-- ローディング -->
    <div v-if="loading" class="loading-wrap">
      <v-progress-circular indeterminate color="indigo-darken-3" size="44" width="3" />
    </div>

    <!-- メインコンテンツ -->
    <div v-else class="main-layout">

      <!-- ヒートマップパネル -->
      <div class="panel heatmap-panel">
        <div class="panel-head">
          <v-icon size="13" color="indigo-darken-3" class="mr-1">mdi-view-grid-outline</v-icon>
          <span class="panel-head-title">キーワード分布</span>
          <span class="panel-head-sub">{{ rangeLabel }}</span>
          <span class="panel-head-hint">列をクリックでワードクラウドを表示</span>
        </div>
        <div class="heatmap-scroll">
          <div ref="heatmapRef" class="heatmap-container"></div>
        </div>
      </div>

      <!-- サイドパネル -->
      <div class="panel side-panel">
        <template v-if="selectedSession">

          <!-- 会期ヘッダー -->
          <div class="session-head">
            <v-icon size="13" class="mr-1" style="opacity:.7">mdi-calendar-text-outline</v-icon>
            <span class="session-head-name">{{ selectedSession?.replace(/〜[\d-]+$/, '〜') }}</span>
          </div>

          <!-- ワードクラウド -->
          <div class="wordcloud-wrap">
            <div ref="wcContainerRef" class="wordcloud-container">
              <span
                v-for="item in wordcloudWords"
                :key="item.name"
                class="wc-word"
                :style="{
                  fontSize: item.size + 'px',
                  color: item.color,
                  left: (wcPositions[item.name]?.x ?? 0) + 'px',
                  top: (wcPositions[item.name]?.y ?? 0) + 'px',
                  opacity: wcReady ? 1 : 0,
                }"
                :title="`特徴度: ${item.score.toFixed(3)}`"
                @click="fetchSummary(item.name)"
              >{{ item.name }}</span>
            </div>
          </div>

          <!-- AI解説カード -->
          <div class="ai-card">
            <div v-if="!selectedWord" class="ai-hint">
              <v-icon size="14" class="mr-1">mdi-cursor-default-click</v-icon>
              単語をクリックするとAI解説が表示されます
            </div>
            <template v-else>
              <div class="ai-head">
                <v-icon size="15" color="white" class="mr-2">mdi-robot-outline</v-icon>
                「{{ selectedWord }}」の議論
              </div>
              <div class="ai-scroll">
                <div v-if="aiLoading" class="ai-loading">
                  <v-progress-circular indeterminate size="22" width="2" color="indigo-darken-3" />
                </div>
                <div v-else class="ai-body" v-html="renderedSummary" />
              </div>
            </template>
          </div>

        </template>

        <!-- 未選択時 -->
        <div v-else class="side-empty">
          <v-icon size="32" style="opacity:.25">mdi-gesture-tap</v-icon>
          <p>左のヒートマップの列をクリックすると<br>ワードクラウドが表示されます</p>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ── Design tokens ─────────────────────────────── */
.miyako-root {
  --navy:       #1c2d5a;
  --navy-dark:  #121d3e;
  --navy-mid:   #2a3f7a;
  --blue:       #3d5fc4;
  --blue-soft:  #eef1fb;
  --surface:    #f0f2f8;
  --card:       #ffffff;
  --border:     #dde2ef;
  --text:       #1c2d5a;
  --text-sub:   #6878a8;
  --radius:     10px;
  --shadow:     0 1px 4px rgba(28,45,90,.07), 0 0 0 1px rgba(28,45,90,.06);

  background: var(--surface);
  min-height: 100vh;
}

/* ── Page Header ───────────────────────────────── */
.page-header {
  background: linear-gradient(140deg, var(--navy-dark) 0%, var(--navy-mid) 100%);
  padding: 20px 24px 18px;
}

.page-header-inner {
  max-width: 1400px;
  margin: 0 auto;
}

.page-title {
  font-size: clamp(17px, 2.5vw, 22px);
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 4px;
  letter-spacing: 0.03em;
}

.page-title-accent {
  color: #a5b4fc;
  margin-left: 6px;
}

.page-subtitle {
  font-size: 11.5px;
  color: rgba(255,255,255,.45);
  margin: 0;
  letter-spacing: 0.02em;
}

/* ── Controls Bar ──────────────────────────────── */
.controls-bar {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 9px 24px;
}

.controls-inner {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 20px;
}

.ctrl-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ctrl-item--slider {
  gap: 6px;
}

.ctrl-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-sub);
  white-space: nowrap;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ctrl-slider {
  min-width: 110px;
  max-width: 170px;
}

.ctrl-range {
  font-size: 11px;
  color: var(--text-sub);
  white-space: nowrap;
  min-width: 110px;
}

/* 未選択ボタンのテキストを見えやすく */
:deep(.v-btn-toggle .v-btn:not(.v-btn--active)) {
  color: var(--navy) !important;
  opacity: 1 !important;
}

/* ── Loading ───────────────────────────────────── */
.loading-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 72px 24px;
}

/* ── Main Layout ───────────────────────────────── */
.main-layout {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: stretch;
}

@media (min-width: 768px) {
  .main-layout {
    flex-direction: row;
    align-items: flex-start;
  }
}

/* ── Panel base ────────────────────────────────── */
.panel {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.heatmap-panel {
  flex: 1;
  min-width: 0;
}

.side-panel {
  width: 100%;
  flex-shrink: 0;
  align-self: flex-start;
}

@media (min-width: 768px) {
  .side-panel {
    width: 420px;
  }
}

/* ── Panel header ──────────────────────────────── */
.panel-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--border);
  background: #fafbff;
}

.panel-head-title {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--navy);
  letter-spacing: 0.03em;
}

.panel-head-sub {
  font-size: 11px;
  color: var(--text-sub);
  margin-left: 8px;
}

.panel-head-hint {
  font-size: 10.5px;
  color: var(--text-sub);
  margin-left: auto;
  opacity: .7;
}

/* ── Heatmap ───────────────────────────────────── */
.heatmap-scroll {
  overflow: auto;
  max-height: 600px;
  padding: 6px 4px 4px;
}

.heatmap-container {
  display: inline-block;
}

/* ── Session header (side panel) ───────────────── */
.session-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 9px 14px;
  background: var(--blue-soft);
  border-bottom: 1px solid var(--border);
}

.session-head-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--navy);
  letter-spacing: 0.02em;
}

/* ── Wordcloud ─────────────────────────────────── */
.wordcloud-wrap {
  padding: 0;
}

.wordcloud-container {
  position: relative;
  width: 100%;
  height: 220px;
  overflow: hidden;
}

.wc-word {
  position: absolute;
  transform: translate(-50%, -50%);
  cursor: pointer;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  transition: opacity 0.25s;
}

.wc-word:hover {
  opacity: 0.55 !important;
}

/* ── AI Card ───────────────────────────────────── */
.ai-card {
  margin: 12px 12px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 300px;
}

.ai-hint {
  display: flex;
  align-items: center;
  padding: 13px 14px;
  font-size: 12px;
  color: var(--text-sub);
}

.ai-head {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  background: var(--navy);
  color: #ffffff;
  font-size: 13.5px;
  font-weight: 600;
  padding: 10px 14px;
  letter-spacing: 0.02em;
}

.ai-scroll {
  overflow-y: auto;
  flex: 1;
}

.ai-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
}

.ai-body {
  font-size: 13px;
  color: var(--text);
  padding: 12px 14px;
  line-height: 1.75;
}

.ai-body :deep(h2) {
  font-size: 13.5px;
  font-weight: 700;
  margin: 14px 0 6px;
  color: var(--navy);
  border-left: 3px solid var(--blue);
  padding-left: 8px;
}

.ai-body :deep(h2:first-child) {
  margin-top: 0;
}

.ai-body :deep(ul) {
  margin: 0 0 8px 16px;
  padding: 0;
}

.ai-body :deep(li) {
  line-height: 1.75;
  margin-bottom: 4px;
}

.ai-body :deep(strong) {
  color: var(--navy);
}

.ai-body :deep(p) {
  margin: 0 0 6px;
  line-height: 1.75;
}

/* ↓ フロー矢印 */
.ai-body :deep(.flow-arrow) {
  text-align: center;
  color: var(--blue);
  font-size: 16px;
  margin: 1px 0;
  line-height: 1.3;
  opacity: .7;
}

/* ── Empty state ───────────────────────────────── */
.side-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  gap: 12px;
  padding: 32px;
  text-align: center;
  color: var(--text-sub);
  font-size: 12px;
  line-height: 1.8;
}
</style>
