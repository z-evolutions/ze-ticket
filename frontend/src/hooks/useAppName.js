import { useState, useEffect } from 'react'
import axios from 'axios'

let cachedAppName = null

export function useAppName() {
  const [appName, setAppName] = useState(cachedAppName || 'ZE-Ticket')

  useEffect(() => {
    if (cachedAppName) return
    axios.get('/api/admin/settings').then(r => {
      const name = r.data.app_name || 'ZE-Ticket'
      cachedAppName = name
      setAppName(name)
      document.title = name
    }).catch(() => {})
  }, [])

  return appName
}
