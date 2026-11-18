import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '../services/api'
import { clearSession, getAccessToken, getSession, setSession, type CareerSession } from '../lib/auth-session'

type AuthState = {
  session: CareerSession | null
  me: any | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => void
  establish: (token: string, session: CareerSession) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<CareerSession | null>(getSession())
  const [me, setMe] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setSessionState(null)
      setMe(null)
      setLoading(false)
      return
    }
    try {
      const data = await authApi.me()
      setMe(data)
      setSessionState({
        user: {
          membershipNumber: data.user.membershipNumber,
          email: data.user.email,
          role: data.user.role,
        },
      })
    } catch {
      clearSession()
      setSessionState(null)
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const logout = useCallback(() => {
    clearSession()
    setSessionState(null)
    setMe(null)
  }, [])

  const establish = useCallback(
    async (token: string, nextSession: CareerSession) => {
      setSession(token, nextSession)
      setSessionState(nextSession)
      await refresh()
    },
    [refresh],
  )

  const value = useMemo<AuthState>(
    () => ({
      session,
      me,
      loading,
      refresh,
      logout,
      establish,
    }),
    [session, me, loading, refresh, logout, establish],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
