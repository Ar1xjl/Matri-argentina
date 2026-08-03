import i18n from '../i18n'

const LOCALE_BY_LANGUAGE = { es: 'es-AR', pt: 'pt-BR', en: 'en-US' }

function activeLocale() {
  return LOCALE_BY_LANGUAGE[i18n.language] || LOCALE_BY_LANGUAGE.es
}

export function formatDate(date, options) {
  if (!date) return ''
  return new Date(date).toLocaleDateString(activeLocale(), options)
}

export function formatDateTime(date, options) {
  if (!date) return ''
  return new Date(date).toLocaleString(activeLocale(), options)
}
