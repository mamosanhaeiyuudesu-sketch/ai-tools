<script setup lang="ts">
definePageMeta({ ssr: false })

import { STOPWORDS, CATEGORY_WORDS } from '~/utils/miyako/categories'

interface WordScore {
  word: string
  score: number
}

type FeaturesData = Record<string, WordScore[]>

interface AiTopic {
  title: string
  conclusion: string
  flow: string[]
}

const TOP_KEYWORDS = 100
const MAX_DISPLAY = 30
const WC_COLORS = [
  '#1A237E', '#283593', '#303F9F', '#3949AB',
  '#3F51B5', '#5C6BC0', '#7986CB', '#0D47A1',
  '#1565C0', '#1976D2', '#1E88E5',
]

const loading = ref(true)
const rawData = ref<FeaturesData>({})
const sessionTypeFilter = ref<'すべて' | '定例会' | '臨時会'>('すべて')
const selectedSession = ref<string | null>(null)
const isMobile = ref(false)
const sessionCount = computed(() => isMobile.value ? 10 : MAX_DISPLAY)
const windowEnd = ref(0)

const selectedWord = ref<string | null>(null)
const aiTopics = ref<AiTopic[]>([])
const aiLoading = ref(false)
const maxChars = ref(1000)
const MAX_CHARS_OPTIONS = [500, 1000, 2000]
const selectedCategory = ref<string>('すべて')
const CATEGORY_OPTIONS = ['すべて', ...Object.keys(CATEGORY_WORDS)]

// ── セッション計算 ─────────────────────────────

function parseDate(key: string): Date {
  const m = key.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? new Date(m[1]) : new Date(0)
}

function shortLabel(key: string): string {
  const m = key.match(/(令和|平成)(元|\d+)年\s+第(\d+)回\s+(定例会|臨時会)/)
  if (!m) return key
  const era = m[1] === '令和' ? '令' : '平'
  const year = m[2] === '元' ? '1' : m[2]
  const type = m[4] === '定例会' ? '定' : '臨'
  return `${era}${year}-${m[3]}${type}`
}

const filteredSessions = computed(() =>
  Object.keys(rawData.value)
    .filter(k => sessionTypeFilter.value === 'すべて' || k.includes(sessionTypeFilter.value))
    .sort((a, b) => parseDate(a).getTime() - parseDate(b).getTime())
)

const windowEndMax = computed(() => filteredSessions.value.length)
const windowEndMin = computed(() => Math.min(sessionCount.value, filteredSessions.value.length))

const displayedSessions = computed(() => {
  const sessions = filteredSessions.value
  if (!sessions.length) return []
  const end = Math.min(windowEnd.value, sessions.length)
  const start = Math.max(0, end - sessionCount.value)
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
  let entries = [...maxScore.entries()].sort((a, b) => b[1] - a[1])
  if (selectedCategory.value !== 'すべて') {
    const catWords = CATEGORY_WORDS[selectedCategory.value]
    entries = entries.filter(([w]) => catWords?.has(w))
  }
  return entries.slice(0, TOP_KEYWORDS).map(([w]) => w)
})

const rangeLabel = computed(() => {
  const s = displayedSessions.value
  if (!s.length) return ''
  return `${shortLabel(s[0])} 〜 ${shortLabel(s[s.length - 1])}`
})

watch(filteredSessions, (sessions) => {
  windowEnd.value = sessions.length
}, { immediate: true })

// ── ワードクラウド ─────────────────────────────

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
    const size = Math.round(11 + Math.pow(t, 0.55) * 26)
    return { name: w.word, score: w.score, size, color: WC_COLORS[i % WC_COLORS.length] }
  })
})

// ── AI要約 ─────────────────────────────────────

async function fetchSummary(word: string) {
  if (!selectedSession.value) return
  selectedWord.value = word
  aiTopics.value = []

  const cacheKey = `miyako_summary:${selectedSession.value}:${word}:${maxChars.value}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try {
      aiTopics.value = JSON.parse(cached)
      return
    } catch {
      localStorage.removeItem(cacheKey)
    }
  }

  aiLoading.value = true
  try {
    const data = await $fetch<{ topics: AiTopic[] }>('/api/miyako/search', {
      method: 'POST',
      body: { session: selectedSession.value, word, maxChars: maxChars.value },
    })
    aiTopics.value = data.topics
    localStorage.setItem(cacheKey, JSON.stringify(data.topics))
  } catch {
    aiTopics.value = [{ title: 'エラー', conclusion: '取得に失敗しました。', flow: [] }]
  } finally {
    aiLoading.value = false
  }
}

// ── データ取得・リセット ────────────────────────

const heatmapRef = ref<{ render: () => void } | null>(null)

async function resetAndRender() {
  selectedSession.value = null
  selectedWord.value = null
  aiTopics.value = []
  await nextTick()
  heatmapRef.value?.render()
}

function updateMobile() {
  isMobile.value = window.innerWidth < 768
}

onMounted(async () => {
  updateMobile()
  window.addEventListener('resize', updateMobile)
  rawData.value = await $fetch<FeaturesData>('/data/miyako-features.json')
  loading.value = false
  await nextTick()
  heatmapRef.value?.render()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateMobile)
})

watch(sessionTypeFilter, async () => {
  await nextTick()
  resetAndRender()
})
watch(windowEnd, resetAndRender)
watch(selectedCategory, resetAndRender)
watch(sessionCount, () => {
  windowEnd.value = filteredSessions.value.length
})
</script>

<template>
  <div class="min-h-screen bg-[#f0f2f8]">
    <MiyakoHeader active-page="session">
      <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 md:flex md:flex-wrap md:items-center md:gap-x-4 md:gap-y-1.5">
        <div class="flex items-center gap-1.5">
          <span class="text-[10.5px] font-semibold text-white/50 whitespace-nowrap uppercase tracking-[0.04em]">会期</span>
          <select v-model="sessionTypeFilter" class="ctrl-select">
            <option v-for="opt in ['すべて', '定例会', '臨時会']" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </div>

        <div class="flex items-center gap-1.5">
          <span class="text-[10.5px] font-semibold text-white/50 whitespace-nowrap uppercase tracking-[0.04em]">カテゴリ</span>
          <select v-model="selectedCategory" class="ctrl-select">
            <option v-for="opt in CATEGORY_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </div>

        <div class="flex items-center gap-1.5">
          <span class="text-[10.5px] font-semibold text-white/50 whitespace-nowrap uppercase tracking-[0.04em]">期間</span>
          <input
            v-model.number="windowEnd"
            type="range"
            :min="windowEndMin"
            :max="windowEndMax"
            :step="1"
            class="ctrl-slider"
          />
          <span class="hidden md:inline text-[10.5px] text-white/50 whitespace-nowrap min-w-[110px]">{{ rangeLabel }}</span>
        </div>

        <div class="flex items-center gap-1.5">
          <span class="text-[10.5px] font-semibold text-white/50 whitespace-nowrap uppercase tracking-[0.04em]">要約文字数</span>
          <select v-model.number="maxChars" class="ctrl-select">
            <option v-for="n in MAX_CHARS_OPTIONS" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
      </div>
    </MiyakoHeader>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center items-center py-[72px] px-6">
      <span class="w-11 h-11 rounded-full border-[3px] border-[#1A237E]/30 border-t-[#1A237E] animate-spin block" />
    </div>

    <!-- Main content -->
    <div v-else class="max-w-[1400px] mx-auto px-3 md:px-6 pt-[11px] pb-8 flex flex-col md:flex-row gap-3 items-start">

      <!-- Heatmap panel -->
      <div class="flex-1 min-w-0">
        <MiyakoSessionHeatmap
          ref="heatmapRef"
          :sessions="displayedSessions"
          :keywords="topKeywords"
          :raw-data="rawData"
          :short-label="shortLabel"
          @session-click="selectedSession = $event"
        />
      </div>

      <!-- Side panel -->
      <div class="w-full md:w-[420px] md:h-[638px] flex-shrink-0 flex flex-col gap-3">
        <MiyakoSessionWordCloud
          :session="selectedSession"
          :words="wordcloudWords"
          @word-click="fetchSummary($event)"
        />

        <MiyakoSessionAiPanel
          :selected-word="selectedWord"
          :ai-topics="aiTopics"
          :ai-loading="aiLoading"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ctrl-slider {
  min-width: 70px;
  max-width: 170px;
  width: 100%;
  accent-color: #a5b4fc;
}

@media (min-width: 768px) {
  .ctrl-slider {
    min-width: 110px;
  }
}

.ctrl-select {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 6px;
  color: rgba(255,255,255,0.85);
  font-size: 11.5px;
  font-weight: 500;
  padding: 2px 6px;
  cursor: pointer;
  outline: none;
}
.ctrl-select:focus { border-color: rgba(255,255,255,0.4); }
.ctrl-select option { background: #1c2d5a; color: white; }
</style>
