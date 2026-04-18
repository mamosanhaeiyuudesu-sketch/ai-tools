<template>
  <div class="overflow-x-auto">
    <!-- 投手テーブル -->
    <div v-if="pitcherPlayers.length" class="mb-6">
      <h3 class="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
        <span>⚾ 投手</span>
      </h3>
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b-2 border-slate-200">
            <th class="text-left py-2 px-3 text-slate-500 font-medium text-xs w-28">指標</th>
            <th
              v-for="player in pitcherPlayers"
              :key="player.id"
              class="text-center py-2 px-3 text-xs font-medium whitespace-nowrap"
            >
              <span
                class="inline-flex items-center gap-1"
                :style="{ color: colors[player.id] }"
              >
                <span
                  class="w-2 h-2 rounded-full inline-block"
                  :style="{ background: colors[player.id] }"
                />
                {{ player.nameJa }}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="stat in PITCHER_STATS"
            :key="stat.key"
            class="border-b border-slate-100 hover:bg-slate-50 transition-colors"
          >
            <td class="py-2 px-3">
              <div class="flex items-center gap-1.5">
                <span class="font-mono font-semibold text-slate-700 text-xs">{{ stat.label }}</span>
                <div class="relative group">
                  <span class="text-slate-400 cursor-help text-[10px] border border-slate-300 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center leading-none">?</span>
                  <div class="absolute left-5 top-0 z-10 hidden group-hover:block w-52 bg-slate-800 text-white text-xs rounded-lg p-2.5 shadow-xl pointer-events-none">
                    {{ stat.description }}
                    <span
                      class="block mt-1 font-medium"
                      :class="stat.direction === 'high' ? 'text-green-400' : 'text-red-400'"
                    >
                      {{ stat.direction === 'high' ? '▲ 高いほど良い' : '▼ 低いほど良い' }}
                    </span>
                  </div>
                </div>
              </div>
            </td>
            <td
              v-for="player in pitcherPlayers"
              :key="player.id"
              class="py-2 px-3 text-center font-mono text-sm"
              :class="getCellClass(player.id, stat.key, stat.direction, 'pitcher')"
            >
              {{ formatStat(player.id, stat.key, stat.format, 'pitcher') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 野手テーブル -->
    <div v-if="batterPlayers.length">
      <h3 class="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
        <span>🏏 野手</span>
      </h3>
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b-2 border-slate-200">
            <th class="text-left py-2 px-3 text-slate-500 font-medium text-xs w-28">指標</th>
            <th
              v-for="player in batterPlayers"
              :key="player.id"
              class="text-center py-2 px-3 text-xs font-medium whitespace-nowrap"
            >
              <span
                class="inline-flex items-center gap-1"
                :style="{ color: colors[player.id] }"
              >
                <span
                  class="w-2 h-2 rounded-full inline-block"
                  :style="{ background: colors[player.id] }"
                />
                {{ player.nameJa }}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="stat in BATTER_STATS"
            :key="stat.key"
            class="border-b border-slate-100 hover:bg-slate-50 transition-colors"
          >
            <td class="py-2 px-3">
              <div class="flex items-center gap-1.5">
                <span class="font-mono font-semibold text-slate-700 text-xs">{{ stat.label }}</span>
                <div class="relative group">
                  <span class="text-slate-400 cursor-help text-[10px] border border-slate-300 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center leading-none">?</span>
                  <div class="absolute left-5 top-0 z-10 hidden group-hover:block w-52 bg-slate-800 text-white text-xs rounded-lg p-2.5 shadow-xl pointer-events-none">
                    {{ stat.description }}
                    <span
                      class="block mt-1 font-medium"
                      :class="stat.direction === 'high' ? 'text-green-400' : 'text-red-400'"
                    >
                      {{ stat.direction === 'high' ? '▲ 高いほど良い' : '▼ 低いほど良い' }}
                    </span>
                  </div>
                </div>
              </div>
            </td>
            <td
              v-for="player in batterPlayers"
              :key="player.id"
              class="py-2 px-3 text-center font-mono text-sm"
              :class="getCellClass(player.id, stat.key, stat.direction, 'batter')"
            >
              {{ formatStat(player.id, stat.key, stat.format, 'batter') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!pitcherPlayers.length && !batterPlayers.length" class="py-12 text-center text-slate-400">
      左のサイドバーで選手を選択してください
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SeasonData, StatMeta } from '~/types/mlb'
import { PITCHER_PLAYERS, BATTER_PLAYERS, PITCHER_STATS, BATTER_STATS, PLAYER_COLORS } from '~/utils/japanese-mlb-player/players'

const props = defineProps<{
  selectedIds: string[]
  seasonDataMap: Map<string, SeasonData>
}>()

const colors = PLAYER_COLORS

const pitcherPlayers = computed(() =>
  PITCHER_PLAYERS.filter(p => props.selectedIds.includes(p.id))
)

const batterPlayers = computed(() =>
  BATTER_PLAYERS.filter(p => props.selectedIds.includes(p.id))
)

function formatStat(playerId: string, key: string, fmt: StatMeta['format'], type: 'pitcher' | 'batter') {
  const data = props.seasonDataMap.get(playerId)
  if (!data) return '読込中'
  const stats = type === 'pitcher' ? data.currentPitcher : data.currentBatter
  if (!stats) return '—'
  const val = (stats as Record<string, unknown>)[key]
  return fmt(val === undefined ? null : val as number | null)
}

function getCellClass(playerId: string, key: string, direction: 'high' | 'low', type: 'pitcher' | 'batter') {
  const data = props.seasonDataMap.get(playerId)
  if (!data) return 'text-slate-300'
  const stats = type === 'pitcher' ? data.currentPitcher : data.currentBatter
  if (!stats) return 'text-slate-400'
  const val = (stats as Record<string, unknown>)[key]
  if (val === null || val === undefined) return 'text-slate-400'
  return 'text-slate-800'
}
</script>
