export interface AuthUser {
  id: string
  username: string
}

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const checked = useState<boolean>('auth-checked', () => false)
  const isLoggedIn = computed(() => user.value !== null)

  const checkAuth = async () => {
    if (checked.value) return
    try {
      const me = await $fetch<AuthUser>('/api/auth/me')
      user.value = me
    } catch {
      user.value = null
    }
    checked.value = true
  }

  const login = async (username: string, password: string): Promise<AuthUser> => {
    const me = await $fetch<AuthUser>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    user.value = me
    checked.value = true
    return me
  }

  const register = async (username: string, password: string): Promise<AuthUser> => {
    const me = await $fetch<AuthUser>('/api/auth/register', {
      method: 'POST',
      body: { username, password },
    })
    user.value = me
    checked.value = true
    return me
  }

  const logout = async () => {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  return { user, isLoggedIn, checked, checkAuth, login, register, logout }
}
