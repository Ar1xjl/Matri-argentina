// "Acerca del Portal" — in-app user manual. Documents the app's real current
// behavior (not DOMAIN_MODEL.md's aspirational design) — every place they
// diverge gets an "Estado real" callout. See MEMORY.md / project_matri_user_manual
// for the design history. Content lives per language in about/{es,en,pt}.jsx
// (keep the three in sync section by section); shared building blocks in
// about/ui.jsx. Page metadata (nav list) lives in lib/aboutPages.js, labels in
// the i18n files under about.pages.
import { useTranslation } from 'react-i18next'
import { SECTIONS_ES } from './about/es'
import { SECTIONS_EN } from './about/en'
import { SECTIONS_PT } from './about/pt'

const BY_LANG = { es: SECTIONS_ES, en: SECTIONS_EN, pt: SECTIONS_PT }

export default function AboutPortal({ section, onNavigate, isCustomer = false }) {
  const { i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'es').slice(0, 2)
  const Content = (BY_LANG[lang] || SECTIONS_ES)[section]
  if (!Content) return null
  return <div style={{ maxWidth: '860px' }}><Content onNavigate={onNavigate} isCustomer={isCustomer} /></div>
}
