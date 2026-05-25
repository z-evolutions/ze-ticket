import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Alle Locale-Dateien automatisch einlesen — keine manuelle Pflege nötig
const locales = import.meta.glob('./locales/*.json', { eager: true })

const resources = {}
export const LANGUAGES = []

for (const [path, module] of Object.entries(locales)) {
  const data = module.default ?? module
  const code = path.replace('./locales/', '').replace('.json', '')
  resources[code] = { translation: data }
  if (data.meta) {
    LANGUAGES.push({ code, flag: data.meta.flag, label: data.meta.label })
  }
}

// Alphabetisch sortieren
LANGUAGES.sort((a, b) => a.label.localeCompare(b.label))

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('ze-language') || 'de',
    fallbackLng: 'de',
    interpolation: { escapeValue: false },
  })

export default i18n
