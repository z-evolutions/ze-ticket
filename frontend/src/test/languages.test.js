import { describe, it, expect } from 'vitest'

// Direkt die JSON-Dateien testen
import de from '../i18n/locales/de.json'
import en from '../i18n/locales/en.json'

describe('i18n Locale-Dateien', () => {
  it('de.json hat meta-Block', () => {
    expect(de.meta).toBeDefined()
    expect(de.meta.flag).toBe('de')
    expect(de.meta.label).toBe('Deutsch')
  })

  it('en.json hat meta-Block', () => {
    expect(en.meta).toBeDefined()
    expect(en.meta.flag).toBe('gb')
    expect(en.meta.label).toBe('English')
  })

  it('de.json hat alle Pflicht-Keys', () => {
    expect(de.common).toBeDefined()
    expect(de.nav).toBeDefined()
    expect(de.auth).toBeDefined()
    expect(de.tickets).toBeDefined()
    expect(de.dashboard).toBeDefined()
  })

  it('en.json hat alle Pflicht-Keys', () => {
    expect(en.common).toBeDefined()
    expect(en.nav).toBeDefined()
    expect(en.auth).toBeDefined()
  })

  it('de.json hat common.logout', () => {
    expect(de.common.logout).toBeDefined()
  })
})
