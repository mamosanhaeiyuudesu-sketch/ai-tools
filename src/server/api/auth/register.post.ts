import { hashPassword, getAppDb, setSessionCookie } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const db = getAppDb(event)
  if (!db) throw createError({ statusCode: 503, message: 'データベースが利用できません' })

  const { username, password } = await readBody<{ username: string; password: string }>(event)

  if (!username || !password) {
    throw createError({ statusCode: 400, message: 'ユーザー名とパスワードを入力してください' })
  }
  if (username.length < 3 || username.length > 30) {
    throw createError({ statusCode: 400, message: 'ユーザー名は3〜30文字で入力してください' })
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw createError({ statusCode: 400, message: 'ユーザー名は半角英数字とアンダースコアのみ使用できます' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, message: 'パスワードは6文字以上で入力してください' })
  }

  const existing = await db
    .prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first<{ id: string }>()
  if (existing) {
    throw createError({ statusCode: 409, message: 'このユーザー名はすでに使用されています' })
  }

  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword(password)
  await db
    .prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)')
    .bind(userId, username, passwordHash)
    .run()

  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().replace('T', ' ').replace('Z', '')
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, userId, expiresAt)
    .run()

  setSessionCookie(event, sessionId)
  return { id: userId, username }
})
