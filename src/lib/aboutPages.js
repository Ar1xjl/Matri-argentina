// Metadata for "Acerca del Portal" — shared between Sidebar.jsx (submenu)
// and Portal.jsx (panel routing/titles). Content lives per language in
// Portal/about/{es,en,pt}.jsx keyed by `id`; the visible label of each page is
// the i18n key about.pages.<id>.
//
// Visible only to Global/Distribuidor/Sub-distribuidor — except
// `calculadora`, which is also shown to Cliente (see Sidebar.jsx).
export const ABOUT_PAGES = [
  { id: 'arquitectura',    icon: '🗺️',            customerVisible: false },
  { id: 'altas',           icon: '🏢', customerVisible: false },
  { id: 'plan',             icon: '🗓️',          customerVisible: true },
  { id: 'calculadora',      icon: '🧮', customerVisible: true },
  { id: 'tratamientos',     icon: '📦',            customerVisible: true },
  { id: 'precios',          icon: '💲',                  customerVisible: false },
  { id: 'matrisure',        icon: '📸',                          customerVisible: true },
  { id: 'firmeza',          icon: '📊',              customerVisible: true },
  { id: 'generadores',      icon: '⚡',                        customerVisible: true },
  { id: 'inventario',       icon: '🏷️',              customerVisible: false },
  { id: 'documentos',       icon: '📄',                         customerVisible: false },
  { id: 'notificaciones',   icon: '🔔',                     customerVisible: false },
  { id: 'roles',            icon: '🔐',                   customerVisible: false },
  { id: 'glosario',         icon: '📚',                          customerVisible: true },
]
