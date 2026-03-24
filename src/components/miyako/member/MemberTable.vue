<script setup lang="ts">
import { heatColor } from '~/utils/miyako/heatColor'

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

defineProps<{
  filteredSpeakers: SpeakerMeta[]
  mode: 'word' | 'category'
  rankLimit: number
  categories: readonly string[]
  wordMap: Record<string, Record<number, { word: string; tfidf: number }>>
  catMap: Record<string, Record<string, { score: number; top_words: string }>>
  wordRange: { min: number; max: number }
  catRange: { min: number; max: number }
}>()
</script>

<template>
  <div class="bg-white border border-[#dde2ef] rounded-[10px] shadow-[0_1px_4px_rgba(28,45,90,0.07),0_0_0_1px_rgba(28,45,90,0.06)] overflow-hidden">
    <div class="flex items-center gap-2 px-4 py-2.5 border-b border-[#dde2ef] bg-[#fafbff]">
      <span class="text-[11.5px] font-bold text-[#1c2d5a] tracking-[0.03em]">
        ■ {{ mode === 'word' ? '特徴語ヒートマップ' : 'カテゴリ傾注度' }}
      </span>
      <span class="text-[11px] text-[#6878a8]">{{ filteredSpeakers.length }}人</span>
      <span v-if="mode === 'word'" class="text-[10.5px] text-[#6878a8] ml-auto opacity-70">各議員の特徴語を上から特徴度順に表示</span>
      <span v-else class="text-[10.5px] text-[#6878a8] ml-auto opacity-70">数値にカーソルで上位語を表示</span>
    </div>

    <div class="overflow-auto">
      <!-- 単語モード -->
      <table v-if="mode === 'word'" class="tbl">
        <thead>
          <tr>
            <th class="tbl-rank-head">#</th>
            <th v-for="s in filteredSpeakers" :key="s.id" class="tbl-col-head">
              <div class="tbl-name">{{ s.name }}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rank in rankLimit" :key="rank">
            <td class="tbl-rank-cell">{{ rank }}</td>
            <td
              v-for="s in filteredSpeakers" :key="s.id"
              class="tbl-cell"
              :title="wordMap[s.id]?.[rank] ? `${wordMap[s.id][rank].word}　TF-IDF: ${wordMap[s.id][rank].tfidf.toFixed(4)}` : ''"
              :style="wordMap[s.id]?.[rank]
                ? { backgroundColor: heatColor(wordMap[s.id][rank].tfidf, wordRange.min, wordRange.max).bg }
                : { backgroundColor: '#f8f9fe' }"
            >
              <span
                v-if="wordMap[s.id]?.[rank]"
                :style="{ color: heatColor(wordMap[s.id][rank].tfidf, wordRange.min, wordRange.max).light ? '#1c2d5a' : '#fff' }"
              >{{ wordMap[s.id][rank].word }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- カテゴリモード -->
      <table v-else class="tbl">
        <thead>
          <tr>
            <th class="tbl-cat-head">カテゴリ</th>
            <th v-for="s in filteredSpeakers" :key="s.id" class="tbl-col-head">
              <div class="tbl-name">{{ s.name }}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cat in categories" :key="cat">
            <td class="tbl-cat-cell">{{ cat }}</td>
            <td
              v-for="s in filteredSpeakers" :key="s.id"
              class="tbl-cell tbl-cell--cat"
              :title="catMap[s.id]?.[cat] ? `上位語: ${catMap[s.id][cat].top_words}` : ''"
              :style="catMap[s.id]?.[cat]
                ? { backgroundColor: heatColor(catMap[s.id][cat].score, catRange.min, catRange.max).bg }
                : { backgroundColor: '#f8f9fe' }"
            >
              <span
                v-if="catMap[s.id]?.[cat]"
                class="text-[10px]"
                :style="{ color: heatColor(catMap[s.id][cat].score, catRange.min, catRange.max).light ? '#6878a8' : '#fff' }"
              >{{ catMap[s.id][cat].score.toFixed(2) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.tbl {
  border-collapse: collapse;
  white-space: nowrap;
  font-size: 12px;
}

.tbl-rank-head {
  position: sticky;
  left: 0;
  z-index: 2;
  background: #fafbff;
  border-right: 2px solid #dde2ef;
  border-bottom: 2px solid #dde2ef;
  padding: 6px 10px;
  text-align: center;
  font-size: 10px;
  color: #9aaac8;
  font-weight: 600;
  min-width: 28px;
}

.tbl-cat-head {
  position: sticky;
  left: 0;
  z-index: 2;
  background: #fafbff;
  border-right: 2px solid #dde2ef;
  border-bottom: 2px solid #dde2ef;
  padding: 6px 14px;
  text-align: left;
  font-size: 10px;
  color: #9aaac8;
  font-weight: 600;
  min-width: 140px;
}

.tbl-col-head {
  border-bottom: 2px solid #dde2ef;
  border-right: 1px solid #eef0f8;
  padding: 5px 4px 4px;
  text-align: center;
  min-width: 66px;
  max-width: 74px;
  background: #fafbff;
  vertical-align: bottom;
}

.tbl-name {
  font-size: 11px;
  font-weight: 600;
  color: #1c2d5a;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 66px;
}

.tbl-rank-cell {
  position: sticky;
  left: 0;
  z-index: 1;
  background: #fafbff;
  border-right: 2px solid #dde2ef;
  border-bottom: 1px solid #eef0f8;
  padding: 0 8px;
  text-align: center;
  font-size: 10px;
  color: #c8d0e0;
  font-weight: 600;
}

.tbl-cat-cell {
  position: sticky;
  left: 0;
  z-index: 1;
  background: #fafbff;
  border-right: 2px solid #dde2ef;
  border-bottom: 1px solid #eef0f8;
  padding: 5px 14px;
  font-size: 11px;
  color: #3a4a72;
  font-weight: 500;
}

.tbl-cell {
  border-right: 1px solid rgba(180,195,225,0.25);
  border-bottom: 1px solid rgba(180,195,225,0.25);
  padding: 0 3px;
  text-align: center;
  height: 26px;
  min-width: 66px;
  max-width: 74px;
  overflow: hidden;
}
.tbl-cell span {
  font-size: 11px;
  font-weight: 500;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 26px;
}

.tbl-cell--cat {
  height: 30px;
}
.tbl-cell--cat span { line-height: 30px; }
</style>
