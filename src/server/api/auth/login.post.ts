import { verifyPassword, getAppDb, setSessionCookie } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const db = getAppDb(event)
  if (!db) throw createError({ statusCode: 503, message: 'データベースが利用できません' })

  const { username, password } = await readBody<{ username: string; password: string }>(event)

  if (!username || !password) {
    throw createError({ statusCode: 400, message: 'ユーザー名とパスワードを入力してください' })
  }

  const user = await db
    .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
    .bind(username)
    .first<{ id: string; username: string; password_hash: string }>()

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw createError({ statusCode: 401, message: 'ユーザー名またはパスワードが正しくありません' })
  }

  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().replace('T', ' ').replace('Z', '')
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, user.id, expiresAt)
    .run()

  setSessionCookie(event, sessionId)
  return { id: user.id, username: user.username }
})
