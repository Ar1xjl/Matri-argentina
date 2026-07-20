// Metadata for "Acerca del Portal" — shared between Sidebar.jsx (submenu)
// and Portal.jsx (panel routing/titles). Content itself lives in
// AboutPortal.jsx, keyed by `id`.
//
// Visible only to Global/Distribuidor/Sub-distribuidor — except
// `calculadora`, which is also shown to Cliente (see Sidebar.jsx).
export const ABOUT_PAGES = [
  { id: 'altas',           icon: '🏢', label: 'Alta de organizaciones y usuarios', group: 'Flujos críticos', customerVisible: false },
  { id: 'plan',             icon: '🗓️', label: 'Planificación de campaña',          group: 'Flujos críticos', customerVisible: false },
  { id: 'calculadora',      icon: '🧮', label: 'Calculadora, DoseRight y Knowledge Base', group: 'Flujos críticos', customerVisible: true },
  { id: 'tratamientos',     icon: '📦', label: 'Ciclo de un Tratamiento',            group: 'Flujos críticos', customerVisible: false },
  { id: 'precios',          icon: '💲', label: 'Manejo de precios',                  group: 'Flujos críticos', customerVisible: false },
  { id: 'matrisure',        icon: '📸', label: 'MatriSure',                          group: 'Operación y calidad', customerVisible: false },
  { id: 'firmeza',          icon: '📊', label: 'Evaluación de Firmeza',              group: 'Operación y calidad', customerVisible: false },
  { id: 'generadores',      icon: '⚡', label: 'Generadores',                        group: 'Operación y calidad', customerVisible: false },
  { id: 'inventario',       icon: '🏷️', label: 'Inventario y Catálogo',              group: 'Operación y calidad', customerVisible: false },
  { id: 'documentos',       icon: '📄', label: 'Documentos',                         group: 'Soporte', customerVisible: false },
  { id: 'notificaciones',   icon: '🔔', label: 'Notificaciones',                     group: 'Soporte', customerVisible: false },
  { id: 'roles',            icon: '🔐', label: 'Roles y permisos',                   group: 'Referencia', customerVisible: false },
  { id: 'glosario',         icon: '📚', label: 'Glosario',                          group: 'Referencia', customerVisible: false },
]
