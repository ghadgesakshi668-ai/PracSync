import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { TOKEN_KEY, USER_KEY } from '../services/api'
import * as authApi from '../services/auth'

const AuthContext = createContext(null)

function readUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser)
  const [checking, setChecking] = useState(!!localStorage.getItem(TOKEN_KEY))

  // Verify the stored token once on load.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) { setChecking(false); return }
    authApi.me()
      .then((u) => { setUser(u); localStorage.setItem(USER_KEY, JSON.stringify(u)) })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); setUser(null) })
      .finally(() => setChecking(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await authApi.login(email, password)
    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, checking, login, logout }), [user, checking, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
