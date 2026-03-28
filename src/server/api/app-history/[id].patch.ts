import { getSessionUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: '未ログイン' })

  const db = event.context.cloudflare?.env?.APP_DB
  if (!db) throw createError({ statusCode: 503, message: 'データベースが利用できません' })

  const id = getRouterParam(event, 'id')
  const { text } = await readBody<{ text: string }>(event)

  await db
    .prepare('UPDATE app_history SET text = ? WHERE id = ? AND user_id = ?')
    .bind(text, id, user.id)
    .run()

  return { ok: true }
})
