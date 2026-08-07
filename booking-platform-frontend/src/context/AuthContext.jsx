import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { clearToken, getToken, setToken } from '@/lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Starts true only when there is a token worth verifying, so a signed-out
  // visitor never waits on a request that will not happen.
  const [loading, setLoading] = useState(() => Boolean(getToken()))

  useEffect(() => {
    if (!getToken()) return

    let cancelled = false

    api
      .get('/auth/me')
      .then(({ data }) => {
        if (!cancelled) setUser(data.data)
      })
      .catch(() => {
        clearToken()
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const { data } = await api.post('/auth/login', credentials)
    setToken(data.data.token)
    setUser(data.data.user)

    return data.data.user
  }, [])

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload)
    setToken(data.data.token)
    setUser(data.data.user)

    return data.data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // A failed logout call should still clear the session locally.
    }

    clearToken()
    setUser(null)
  }, [])

  /** Re-reads the signed-in user, e.g. after Stripe onboarding completes. */
  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data.data)
      return data.data
    } catch {
      return null
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      setUser,
      loading,
      login,
      register,
      logout,
      refresh,
      isAuthenticated: Boolean(user),
      isProvider: user?.role === 'provider',
      isClient: user?.role === 'client',
    }),
    [user, loading, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')

  return context
}
