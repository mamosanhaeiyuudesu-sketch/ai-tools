<script setup lang="ts">
const props = defineProps<{
  words: { word: string; score: number }[]
  height?: number
}>()

const emit = defineEmits<{
  'word-click': [word: string]
}>()

const COLORS = [
  '#1A237E', '#283593', '#303F9F', '#3949AB',
  '#3F51B5', '#5C6BC0', '#7986CB', '#0D47A1',
  '#1565C0', '#1976D2', '#1E88E5',
]

const items = computed(() => {
  const sorted = [...props.words].sort((a, b) => b.score - a.score)
  if (!sorted.length) return []
  const maxScore = sorted[0].score
  const minScore = sorted[sorted.length - 1].score
  const range = maxScore - minScore || 1
  return sorted.map((w, i) => {
    const t = (w.score - minScore) / range
    const size = Math.round(10 + t * t * 46)
    return { name: w.word, score: w.score, size, color: COLORS[i % COLORS.length] }
  })
})
</script>

<template>
  <div
    class="wc-wrap"
    :style="height ? `max-height: ${height}px` : ''"
  >
    <span
      v-for="item in items"
      :key="item.name"
      class="wc-word"
      :style="{ fontSize: item.size + 'px', color: item.color }"
      :title="`特徴度: ${item.score.toFixed(3)}`"
      @click="emit('word-click', item.name)"
    >{{ item.name }}</span>
  </div>
</template>

<style scoped>
.wc-wrap {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  justify-content: center;
  gap: 4px 10px;
  padding: 8px;
  overflow: hidden;
}

.wc-word {
  cursor: pointer;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
  transition: opacity 0.15s;
}

.wc-word:hover {
  opacity: 0.6;
}
</style>
