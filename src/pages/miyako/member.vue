<script setup lang="ts">
definePageMeta({ ssr: false })

import { parseCsv } from '~/utils/miyako/csv'
import { CATEGORIES } from '~/utils/miyako/categories'

interface SpeakerMeta {
  id: string
  name: string
  role: string
  gender: string
  party: string
  faction: string
  terms: number[]
  utterance_count: number
  total_words: number
  in_member_json: boolean
}

interface WordEntry {
  speaker_id: string
  word: string
  tfidf: number
  rank: number
}

interface CategoryEntry {
  speaker_id: string
  category: string
  score: number
  top_words: string
}

const route = useRoute()
const router = useRouter()

function qStr(key: string, fallback: string) {
  const v = route.query[key]
  return typeof v === 'string' ? v : fallback
}
function qInt(key: string, fallback: number) {
  const v = route.query[key]
  const n = parseInt(typeof v === 'string' ? v : '')
  return isNaN(n) ? fallback : n
}
function qBool(key: string, fallback: boolean) {
  const v = route.query[key]
  if (v === '1') return true
  if (v === '0') return false
  return fallback
}

const mode = ref<'word' | 'category'>(qStr('mode', 'word') === 'category' ? 'category' : 'word')
const rankLimit = ref(qInt('top', 20))
const filterGender = ref(qStr('gender', 'すべて'))
const filterGroup = ref(qStr('group', 'すべて'))
const memberOnly = ref(qBool('member', true))

watch([mode, rankLimit, filterGender, filterGroup, memberOnly], () => {
  router.replace({
    query: {
      mode: mode.value,
      top: String(rankLimit.value),
      gender: filterGender.value,
      group: filterGroup.value,
      member: memberOnly.value ? '1' : '0',
    },
  })
})

const speakersMeta = ref<SpeakerMeta[]>([])
const wordEntries = ref<WordEntry[]>([])
const categoryEntries = ref<CategoryEntry[]>([])
const loading = ref(true)

const groupOptions = computed(() => {
  const counts = new Map<string, number>()
  for (const s of speakersMeta.value) {
    if (memberOnly.value && !s.in_member_json) continue
    if (s.faction && s.faction !== '-') counts.set(s.faction, (counts.get(s.faction) ?? 0) + 1)
    if (s.party && s.party !== '-') counts.set(s.party, (counts.get(s.party) ?? 0) + 1)
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  return [{ label: 'すべて', value: 'すべて' }, ...sorted.map(([k, n]) => ({ label: `${k}（${n}）`, value: k }))]
})

const filteredSpeakers = computed(() =>
  speakersMeta.value.filter(s => {
    if (memberOnly.value && !s.in_member_json) return false
    if (filterGender.value !== 'すべて' && s.gender !== filterGender.value) return false
    if (filterGroup.value !== 'すべて' && s.faction !== filterGroup.value && s.party !== filterGroup.value) return false
    return true
  })
)

const filteredIds = computed(() => new Set(filteredSpeakers.value.map(s => s.id)))

const wordMap = computed(() => {
  const map: Record<string, Record<number, { word: string; tfidf: number }>> = {}
  for (const e of wordEntries.value) {
    if (!filteredIds.value.has(e.speaker_id) || e.rank > rankLimit.value) continue
    if (!map[e.speaker_id]) map[e.speaker_id] = {}
    map[e.speaker_id][e.rank] = { word: e.word, tfidf: e.tfidf }
  }
  return map
})

const wordRange = computed(() => {
  let min = Infinity, max = -Infinity
  for (const ranks of Object.values(wordMap.value)) {
    for (const { tfidf } of Object.values(ranks)) {
      if (tfidf < min) min = tfidf
      if (tfidf > max) max = tfidf
    }
  }
  return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 1 : max }
})

const catMap = computed(() => {
  const map: Record<string, Record<string, { score: number; top_words: string }>> = {}
  for (const e of categoryEntries.value) {
    if (!filteredIds.value.has(e.speaker_id)) continue
    if (!map[e.speaker_id]) map[e.speaker_id] = {}
    map[e.speaker_id][e.category] = { score: e.score, top_words: e.top_words }
  }
  return map
})

const catRange = computed(() => {
  let min = Infinity, max = -Infinity
  for (const cats of Object.values(catMap.value)) {
    for (const cat of CATEGORIES) {
      const score = cats[cat]?.score
      if (score == null) continue
      if (score < min) min = score
      if (score > max) max = score
    }
  }
  return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 1 : max }
})

onMounted(async () => {
  const [metaRaw, wordsRaw, catsRaw] = await Promise.all([
    $fetch<SpeakerMeta[]>('/data/speakers_meta.json'),
    $fetch('/data/tfidf_words.csv', { responseType: 'text' }) as Promise<string>,
    $fetch('/data/tfidf_categories.csv', { responseType: 'text' }) as Promise<string>,
  ])

  speakersMeta.value = metaRaw

  wordEntries.value = parseCsv(wordsRaw).map(r => ({
    speaker_id: r.speaker_id,
    word: r.word,
    tfidf: parseFloat(r.tfidf),
    rank: parseInt(r.rank),
  }))

  categoryEntries.value = parseCsv(catsRaw).map(r => ({
    speaker_id: r.speaker_id,
    category: r.category,
    score: parseFloat(r.score),
    top_words: r.top_words,
  }))

  loading.value = false
})
</script>

<template>
  <div class="min-h-screen bg-[#f0f2f8]">
    <MiyakoHeader active-page="member">
      <!-- モード -->
      <div class="flex items-center gap-1.5">
        <span class="text-[10.5px] font-semibold text-white/50 uppercase tracking-[0.04em]">モード</span>
        <div class="flex rounded overflow-hidden border border-white/20">
          <button
            :class="['px-3 py-0.5 text-[11.5px] font-medium transition-colors', mode === 'word' ? 'bg-[#a5b4fc] text-[#121d3e]' : 'bg-white/10 text-white/70 hover:bg-white/20']"
            @click="mode = 'word'">単語</button>
          <button
            :class="['px-3 py-0.5 text-[11.5px] font-medium transition-colors', mode === 'category' ? 'bg-[#a5b4fc] text-[#121d3e]' : 'bg-white/10 text-white/70 hover:bg-white/20']"
            @click="mode = 'category'">カテゴリ</button>
        </div>
      </div>

      <!-- 単語モード: 表示行数 -->
      <div v-if="mode === 'word'" class="flex items-center gap-1.5">
        <span class="text-[10.5px] font-semibold text-white/50 uppercase tracking-[0.04em]">表示数</span>
        <select v-model.number="rankLimit" class="ctrl-select">
          <option v-for="n in [5, 10, 15, 20]" :key="n" :value="n">top {{ n }}</option>
        </select>
      </div>

      <!-- フィルタ -->
      <label class="flex items-center gap-1 text-[11px] text-white/70 cursor-pointer select-none">
        <input type="checkbox" v-model="memberOnly" class="accent-[#a5b4fc]" />
        議員のみ
      </label>

      <div class="flex items-center gap-1.5">
        <span class="text-[10.5px] font-semibold text-white/50 uppercase tracking-[0.04em]">性別</span>
        <select v-model="filterGender" class="ctrl-select">
          <option v-for="g in ['すべて', '男', '女']" :key="g" :value="g">{{ g }}</option>
        </select>
      </div>

      <div class="flex items-center gap-1.5">
        <span class="text-[10.5px] font-semibold text-white/50 uppercase tracking-[0.04em]">会派・政党</span>
        <select v-model="filterGroup" class="ctrl-select">
          <option v-for="opt in groupOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
    </MiyakoHeader>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center items-center py-[72px]">
      <span class="w-11 h-11 rounded-full border-[3px] border-[#1A237E]/30 border-t-[#1A237E] animate-spin block" />
    </div>

    <!-- Table -->
    <div v-else class="max-w-[1600px] mx-auto px-6 pt-3 pb-8">
      <MiyakoMemberTable
        :filtered-speakers="filteredSpeakers"
        :mode="mode"
        :rank-limit="rankLimit"
        :categories="CATEGORIES"
        :word-map="wordMap"
        :cat-map="catMap"
        :word-range="wordRange"
        :cat-range="catRange"
      />
    </div>
  </div>
</template>

<style scoped>
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
