import { useTranslation } from 'react-i18next'
import { setLanguageManually } from '../../i18n'

// Each option always shows its own language's name (autonym), not translated
// by the currently active language — standard convention for language pickers.
const LANGUAGES = [
  { code: 'es', label: 'ES' },
  { code: 'pt', label: 'PT' },
  { code: 'en', label: 'EN' },
]

export default function LanguageSwitcher({ dark = false }) {
  const { i18n } = useTranslation()

  return (
    <div style={{display: 'flex', gap: '4px'}}>
      {LANGUAGES.map(lang => {
        const active = i18n.language === lang.code
        return (
          <button
            key={lang.code}
            onClick={() => setLanguageManually(lang.code)}
            style={{
              background: active ? '#b5cc2e' : 'transparent',
              color: active ? '#0b4358' : (dark ? '#90b8c8' : '#0b4358'),
              border: `1px solid ${active ? '#b5cc2e' : (dark ? 'rgba(255,255,255,.2)' : '#dde0d5')}`,
              borderRadius: '5px', padding: '3px 7px', fontSize: '11px',
              fontWeight: 700, cursor: 'pointer', lineHeight: 1
            }}
          >
            {lang.label}
          </button>
        )
      })}
    </div>
  )
}
