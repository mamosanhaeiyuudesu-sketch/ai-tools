import { getSessionUser } from '~/server/utils/auth'
import type { HistoryItem } from '~/types/history'

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: '未ログイン' })

  const db = event.context.cloudflare?.env?.WHISPER_DB
  if (!db) throw createError({ statusCode: 503, message: 'データベースが利用できません' })

  const app = getQuery(event).app as string
  if (!app) throw createError({ statusCode: 400, message: 'appパラメータが必要です' })

  const rows = await db
    .prepare('SELECT id, text, title, created_at FROM app_history WHERE user_id = ? AND app = ? ORDER BY created_at DESC')
    .bind(user.id, app)
    .all<{ id: string; text: string; title: string; created_at: string }>()

  const items: HistoryItem[] = (rows.results ?? []).map((r) => ({
    id: r.id,
    timestamp: r.created_at,
    text: r.text,
    title: r.title,
  }))

  return items
})
