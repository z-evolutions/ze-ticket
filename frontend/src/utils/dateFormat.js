/**
 * Zentrale Datums-Formatierung für ZE-Ticket.
 * Nutzt die Browser-Zeitzone des Benutzers automatisch.
 */

export function formatDate(iso, locale = 'de-DE') {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(locale, {
      day:    '2-digit',
      month:  '2-digit',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  } catch {
    return '—'
  }
}

export function formatDateOnly(iso, locale = 'de-DE') {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day:   '2-digit',
      month: '2-digit',
      year:  'numeric',
    })
  } catch {
    return '—'
  }
}

export function formatRelative(iso, locale = 'de-DE') {
  if (!iso) return '—'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    const minutes = Math.round(diff / 60000)
    const hours   = Math.round(diff / 3600000)
    const days    = Math.round(diff / 86400000)
    if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute')
    if (Math.abs(hours)   < 24) return rtf.format(-hours,   'hour')
    return rtf.format(-days, 'day')
  } catch {
    return '—'
  }
}
