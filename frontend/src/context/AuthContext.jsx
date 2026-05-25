import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('ze-token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      fetchMe()
    } else {
      delete axios.defaults.headers.common['Authorization']
      setLoading(false)
    }
  }, [token])

  async function fetchMe() {
    try {
      const res = await axios.get('/api/auth/me')
      setUser(res.data)
    } catch {
      logout()
    } finally {
      setLoading(false)
    }
  }

  function login(accessToken) {
    localStorage.setItem('ze-token', accessToken)
    setToken(accessToken)
  }

  function logout() {
    localStorage.removeItem('ze-token')
    localStorage.removeItem('ze-refresh')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
