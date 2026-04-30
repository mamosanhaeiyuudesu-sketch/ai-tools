<template>
  <div class="flex flex-col" :class="role === 'user' ? 'items-end' : 'items-start'">
    <div
      class="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words"
      :class="role === 'user'
        ? 'bg-gradient-to-br from-rose-500/80 to-indigo-500/80 text-white rounded-br-sm'
        : 'bg-white/[0.06] border border-white/[0.08] text-slate-100 rounded-bl-sm'"
      :style="fontSizePx ? { fontSize: fontSizePx } : {}"
    >
      <span v-if="content">{{ content }}</span>
      <span v-else class="inline-flex items-center gap-1 text-slate-400">
        <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style="animation-delay: 0ms" />
        <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style="animation-delay: 150ms" />
        <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style="animation-delay: 300ms" />
      </span>
    </div>
    <div v-if="role === 'user' && formattedTime" class="text-[10px] text-slate-500 mt-0.5 px-1">
      {{ formattedTime }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  role: 'user' | 'assistant'
  content: string
  fontSizePx?: string
  createdAt?: string
}>()

const formattedTime = computed(() => {
  if (!props.createdAt) return ''
  const d = new Date(props.createdAt)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
})
</script>
