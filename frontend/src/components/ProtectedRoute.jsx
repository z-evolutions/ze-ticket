import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { token, user, loading } = useAuth()
  const [setupRequired, setSetupRequired] = useState(null)

  useEffect(() => {
    axios.get('/api/setup/status').then(res => {
      setSetupRequired(res.data.setup_required)
    }).catch(() => setSetupRequired(false))
  }, [])

  if (setupRequired === null) return null
  if (setupRequired) return <Navigate to="/setup" replace />

  if (loading) return null

  if (!token) return <Navigate to="/login" replace />

  // Kunden landen immer im Portal
  if (user?.role === 'kunde' && !window.location.pathname.startsWith('/portal')) {
    return <Navigate to="/portal" replace />
  }

  return children
}
