import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import es from './locales/es.json'
import pt from './locales/pt.json'
import en from './locales/en.json'

export const SUPPORTED_LANGUAGES = ['es', 'pt', 'en']

// Distinguishes "the detector fell back to a default" from "the user
// explicitly picked a language via LanguageSwitcher" — see
// applyOrganizationLanguage below.
const MANUAL_OVERRIDE_KEY = 'matri_lang_manual'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      pt: { translation: pt },
      en: { translation: en },
    },
    fallbackLng: 'es',
    supportedLngs: SUPPORTED_LANGUAGES,
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  })

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

// Applies an Organization's default language once the user's profile loads
// (Portal.jsx), unless the user already chose a language manually in this
// browser — a manual choice always wins over the org default.
export function applyOrganizationLanguage(orgLanguage) {
  if (!orgLanguage || !SUPPORTED_LANGUAGES.includes(orgLanguage)) return
  if (localStorage.getItem(MANUAL_OVERRIDE_KEY) === 'true') return
  i18n.changeLanguage(orgLanguage)
}

// Used by LanguageSwitcher — marks the choice as manual so it sticks across
// logins regardless of the organization's own default.
export function setLanguageManually(lang) {
  localStorage.setItem(MANUAL_OVERRIDE_KEY, 'true')
  i18n.changeLanguage(lang)
}

export default i18n
