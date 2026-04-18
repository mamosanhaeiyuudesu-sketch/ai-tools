import { getDevSeasonData } from '../../../utils/mlb-dev'
import { PLAYERS } from '~/utils/japanese-mlb-player/players'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: '選手IDが必要です。' })

  const player = PLAYERS.find(p => p.id === id)
  if (!player) throw createError({ statusCode: 404, statusMessage: '選手が見つかりません。' })

  const query = getQuery(event)
  const season = Number(query.season ?? 2026)

  const env = event.context.cloudflare?.env as Record<string, unknown> | undefined
  const db = env?.MLB_DB as D1Database | undefined

  if (!db) {
    return getDevSeasonData(id)
  }

  const [batterCurrent, pitcherCurrent, batterTrend, pitcherTrend] = await Promise.all([
    db.prepare(
      "SELECT * FROM mlb_batter_stats WHERE player_id = ? AND season = ? AND date = ''"
    ).bind(id, season).first<Record<string, unknown>>(),

    db.prepare(
      "SELECT * FROM mlb_pitcher_stats WHERE player_id = ? AND season = ? AND date = ''"
    ).bind(id, season).first<Record<string, unknown>>(),

    db.prepare(
      "SELECT * FROM mlb_batter_stats WHERE player_id = ? AND season = ? AND date != '' ORDER BY date"
    ).bind(id, season).all<Record<string, unknown>>(),

    db.prepare(
      "SELECT * FROM mlb_pitcher_stats WHERE player_id = ? AND season = ? AND date != '' ORDER BY date"
    ).bind(id, season).all<Record<string, unknown>>(),
  ])

  const mapBatter = (r: Record<string, unknown>) => ({
    playerId: r.player_id as string,
    season: r.season as number,
    date: r.date as string | null,
    avg: r.avg as number | null,
    obp: r.obp as number | null,
    ops: r.ops as number | null,
    wrcPlus: r.wrc_plus as number | null,
    bbPct: r.bb_pct as number | null,
    kPct: r.k_pct as number | null,
    war: r.war as number | null,
  })

  const mapPitcher = (r: Record<string, unknown>) => ({
    playerId: r.player_id as string,
    season: r.season as number,
    date: r.date as string | null,
    era: r.era as number | null,
    fip: r.fip as number | null,
    whip: r.whip as number | null,
    kPct: r.k_pct as number | null,
    bbPct: r.bb_pct as number | null,
    gbPct: r.gb_pct as number | null,
    war: r.war as number | null,
  })

  return {
    player,
    currentBatter: batterCurrent ? mapBatter(batterCurrent) : null,
    currentPitcher: pitcherCurrent ? mapPitcher(pitcherCurrent) : null,
    trendBatter: batterTrend.results.map(mapBatter),
    trendPitcher: pitcherTrend.results.map(mapPitcher),
  }
})
