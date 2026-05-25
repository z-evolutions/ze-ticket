/**
 * Einfaches HTML-Sanitizing für ES-Highlights.
 * Erlaubt nur <em> Tags (für Suchtreffern-Highlighting).
 * Alle anderen Tags werden entfernt.
 */
export function sanitizeHighlight(html) {
  if (!html) return ''
  // Nur <em> und </em> erlauben, alles andere entfernen
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;em&gt;/g, '<em>')
    .replace(/&lt;\/em&gt;/g, '</em>')
}
