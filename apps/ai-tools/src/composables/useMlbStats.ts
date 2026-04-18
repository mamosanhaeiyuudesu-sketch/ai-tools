import type { SeasonData, YearlyData } from '~/types/mlb'
import { PLAYERS } from '~/utils/japanese-mlb-player/players'

const DEFAULT_SELECTED = ['660271', '808967', '694297', '676440', '673548']

export function useMlbStats() {
  const selectedIds = useState<string[]>('mlb-selected', () => [...DEFAULT_SELECTED])
  const activeTab = useState<'season' | 'yearly'>('mlb-tab', () => 'season')
  const selectedSeason = useState<number>('mlb-season', () => 2026)

  const seasonCache = useState<Map<string, SeasonData>>('mlb-season-cache', () => new Map())
  const yearlyCache = useState<Map<string, YearlyData>>('mlb-yearly-cache', () => new Map())
  const loadingIds = useState<Set<string>>('mlb-loading', () => new Set())

  const selectedPlayers = computed(() =>
    selectedIds.value.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean) as typeof PLAYERS
  )

  function togglePlayer(id: string) {
    const idx = selectedIds.value.indexOf(id)
    if (idx >= 0) {
      selectedIds.value = selectedIds.value.filter(i => i !== id)
    } else {
      selectedIds.value = [...selectedIds.value, id]
    }
  }

  async function fetchSeason(playerId: string) {
    if (seasonCache.value.has(playerId) || loadingIds.value.has(playerId)) return
    loadingIds.value = new Set([...loadingIds.value, playerId])
    try {
      const data = await $fetch<SeasonData>(
        `/api/japanese-mlb-player/season/${playerId}`,
        { query: { season: selectedSeason.value } }
      )
      const next = new Map(seasonCache.value)
      next.set(playerId, data)
      seasonCache.value = next
    } finally {
      const next = new Set(loadingIds.value)
      next.delete(playerId)
      loadingIds.value = next
    }
  }

  async function fetchYearly(playerId: string) {
    if (yearlyCache.value.has(playerId) || loadingIds.value.has(playerId)) return
    loadingIds.value = new Set([...loadingIds.value, playerId])
    try {
      const data = await $fetch<YearlyData>(`/api/japanese-mlb-player/yearly/${playerId}`)
      const next = new Map(yearlyCache.value)
      next.set(playerId, data)
      yearlyCache.value = next
    } finally {
      const next = new Set(loadingIds.value)
      next.delete(playerId)
      loadingIds.value = next
    }
  }

  async function ensureSeasonData() {
    await Promise.all(selectedIds.value.map(id => fetchSeason(id)))
  }

  async function ensureYearlyData() {
    await Promise.all(selectedIds.value.map(id => fetchYearly(id)))
  }

  function isLoading(id: string) {
    return loadingIds.value.has(id)
  }

  function getSeasonData(id: string) {
    return seasonCache.value.get(id) ?? null
  }

  function getYearlyData(id: string) {
    return yearlyCache.value.get(id) ?? null
  }

  return {
    selectedIds,
    selectedPlayers,
    activeTab,
    selectedSeason,
    togglePlayer,
    fetchSeason,
    fetchYearly,
    ensureSeasonData,
    ensureYearlyData,
    isLoading,
    getSeasonData,
    getYearlyData,
  }
}
