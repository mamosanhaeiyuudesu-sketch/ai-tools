import { getAppDb, clearSessionCookie } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const db = getAppDb(event)
  const token = getCookie(event, 'app-session')
  if (db && token) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(token).run()
  }
  clearSessionCookie(event)
  return { ok: true }
})
