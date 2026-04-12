const SESSION_COOKIE = 'app-session'
const SESSION_EXPIRE_DAYS = 30

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const hashArr = Array.from(new Uint8Array(bits))
  const saltArr = Array.from(salt)
  return btoa(JSON.stringify({ salt: saltArr, hash: hashArr }))
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const { salt, hash } = JSON.parse(atob(stored)) as { salt: number[]; hash: number[] }
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      256
    )
    const newHash = Array.from(new Uint8Array(bits))
    return newHash.length === hash.length && newHash.every((b, i) => b === hash[i])
  } catch {
    return false
  }
}

export function getAppDb(event: any): any {
  return event.context.cloudflare?.env?.WHISPER_DB ?? null
}

export async function getSessionUser(event: any): Promise<{ id: string; username: string } | null> {
  const db = getAppDb(event)
  if (!db) return null

  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null

  const row = await db
    .prepare(
      "SELECT s.user_id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > datetime('now')"
    )
    .bind(token)
    .first<{ user_id: string; username: string }>()

  if (!row) return null
  return { id: row.user_id, username: row.username }
}

export function setSessionCookie(event: any, token: string): void {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: SESSION_EXPIRE_DAYS * 24 * 3600,
    path: '/',
  })
}

export function clearSessionCookie(event: any): void {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}
