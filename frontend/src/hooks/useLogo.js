import { useState, useEffect } from 'react'
import axios from 'axios'

let cachedLogoUrl = undefined  // undefined = noch nicht geladen, null = kein Logo

export function useLogo() {
  const [logoUrl, setLogoUrl] = useState(cachedLogoUrl)

  useEffect(() => {
    if (cachedLogoUrl !== undefined) {
      setLogoUrl(cachedLogoUrl)
      return
    }
    axios.get('/api/admin/logo')
      .then(res => {
        cachedLogoUrl = res.data.logo_url || null
        setLogoUrl(cachedLogoUrl)
      })
      .catch(() => {
        cachedLogoUrl = null
        setLogoUrl(null)
      })
  }, [])

  return logoUrl
}

export function invalidateLogoCache() {
  cachedLogoUrl = undefined
}
