import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, getStoredUser, storeSession, clearSession } from '../api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser())
  const [booting, setBooting] = useState(!!getToken())

  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener('hms:unauthorized', onUnauthorized)
    return () => window.removeEventListener('hms:unauthorized', onUnauthorized)
  }, [])

  useEffect(() => {
    if (!getToken()) { setBooting(false); return }
    api.get('/api/auth/me')
      .then((res) => {
        storeSession(getToken(), res.user)
        setUser(res.user)
      })
      .catch(() => {})
      .finally(() => setBooting(false))
  }, [])

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password })
    storeSession(res.token, res.user)
    setUser(res.user)
    return res.user
  }

  const logout = () => {
    clearSession()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, booting, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
