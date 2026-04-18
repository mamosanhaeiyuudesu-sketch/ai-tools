<template>
  <header class="flex items-center justify-between px-5 py-3 flex-shrink-0" style="background: #0C447C;">
    <div class="flex items-center gap-3">
      <span class="text-xl">⚾</span>
      <div>
        <h1 class="text-white font-bold text-base leading-tight m-0">MLB日本人選手成績</h1>
        <p class="text-blue-200 text-xs m-0 hidden sm:block">2026シーズン</p>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <select
        :value="season"
        @change="$emit('update:season', Number(($event.target as HTMLSelectElement).value))"
        class="bg-blue-900 text-white text-sm border border-blue-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option v-for="y in seasons" :key="y" :value="y">{{ y }}年</option>
      </select>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ season: number }>()
defineEmits<{ 'update:season': [value: number] }>()

const seasons = [2026, 2025, 2024, 2023, 2022]
</script>
