import { useState } from 'react'
import { pouchBreakdownDisplay } from '../../lib/dosing'
import { exportToExcel, filterRows } from '../../lib/tableTools'
import MatriSurePhotoModal from './MatriSurePhotoModal'

// Supabase may embed a to-one relation as an object or a single-item array
// depending on FK inference — normalize to a plain object or null.
function matriSureOf(t) {
  const m = t.matrisure_verifications
  return Array.isArray(m) ? (m[0] ?? null) : (m ?? null)
}

const productTag = (product) => (
  <span style={{
    background: product === 'powder' ? '#eef4c0' : '#e1f5ee',
    color: product === 'powder' ? '#4a6010' : '#0d7a5f',
    fontSize:'11px', fontWeight:700, padding:'3px 10px',
    borderRadius:'100px'
  }}>{product === 'powder' ? 'MatriPowder' : 'MatriTablets'}</span>
)

const statusLabel = (status) => ({
  approved:  { cls:'approved',  label:'✓ Aprobado' },
  submitted: { cls:'pending',   label:'⏳ Pendiente' },
  applied:   { cls:'pending',   label:'🔧 Aplicado' },
  completed: { cls:'confirmed', label:'📸 MatriSure OK' },
  rejected:  { cls:'rejected',  label:'✗ Rechazado' },
  cancelled: { cls:'rejected',  label:'– Cancelado' },
}[status] || { cls:'pending', label:status })

const COLUMNS = [
  { header: 'N° tratamiento', get: t => `#${t.id.slice(0,8)}` },
  { header: 'Cámara',         get: t => t.cold_rooms?.name || '' },
  { header: 'Producto',       get: t => t.product === 'powder' ? 'MatriPowder' : 'MatriTablets' },
  { header: 'Sachets',        get: t => pouchBreakdownDisplay(t) },
  { header: 'Precio',         get: t => t.price_local != null ? `${t.price_currency || 'USD'} ${t.price_local}` : '' },
  { header: 'Modelo',         get: t => t.service_fee_local != null ? 'Servicio' : 'Propio' },
  { header: 'Estado',         get: t => statusLabel(t.status).label },
]

export default function Treatments({ onNavigate, treatments = [], onGetPhotoUrl, onRepeat }) {
  const [viewingPhoto, setViewingPhoto] = useState(null) // storage path, or null
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({})

  const filtered = filterRows(treatments, COLUMNS, filters)
  const setFilter = (header, value) => setFilters(prev => ({ ...prev, [header]: value }))

  return (
    <div>
      {viewingPhoto && (
        <MatriSurePhotoModal path={viewingPhoto} onGetPhotoUrl={onGetPhotoUrl} onClose={() => setViewingPhoto(null)} />
      )}
      <div style={{display:'flex', gap:'10px', marginBottom:'16px'}}>
        <button className="btn-primary" onClick={() => onNavigate('calculator')}>
          + Nuevo tratamiento
        </button>
        <button className="btn-secondary" onClick={() => setShowFilters(!showFilters)}>
          {showFilters ? '✕ Ocultar filtros' : 'Filtrar'}
        </button>
        <button className="btn-secondary" onClick={() => exportToExcel('tratamientos.xlsx', COLUMNS, filtered)}>
          ⬇ Exportar a Excel
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Todos los tratamientos</span>
          <span style={{fontSize:'12px', color:'var(--gray)'}}>{filtered.length} de {treatments.length} tratamientos esta temporada</span>
        </div>
        <div style={{padding:0}}>
          {treatments.length === 0 ? (
            <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
              No hay tratamientos todavía. Hacé click en "+ Nuevo tratamiento" para crear el primero.
            </div>
          ) : filtered.length === 0 ? (
            <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
              Ningún tratamiento coincide con los filtros aplicados.
            </div>
          ) : (
            <div className="table-scroll"><table className="data-table">
              <thead>
                <tr>
                  <th>N° tratamiento</th><th>Cámara</th><th>Producto</th>
                  <th>Sachets</th><th>Precio</th><th>Modelo</th>
                  <th>Estado</th><th></th>
                </tr>
                {showFilters && (
                  <tr>
                    {COLUMNS.map(c => (
                      <th key={c.header} style={{padding:'4px 8px'}}>
                        <input
                          value={filters[c.header] || ''}
                          onChange={e => setFilter(c.header, e.target.value)}
                          placeholder="Filtrar..."
                          style={{width:'100%', padding:'5px 7px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'12px', fontWeight:400}}
                        />
                      </th>
                    ))}
                    <th></th>
                  </tr>
                )}
              </thead>
              <tbody>
                {filtered.map(t => {
                  const s = statusLabel(t.status)
                  const model = t.service_fee_local != null ? 'Servicio' : 'Propio'
                  const matriSure = matriSureOf(t)
                  return (
                    <tr key={t.id}>
                      <td style={{fontWeight:700, color:'var(--navy)'}}># {t.id.slice(0,8)}</td>
                      <td>{t.cold_rooms?.name}</td>
                      <td>{productTag(t.product)}</td>
                      <td style={{fontFamily:'monospace', fontSize:'12px'}}>
                        {pouchBreakdownDisplay(t)}
                      </td>
                      <td style={{fontWeight:700}}>{t.price_local != null ? `${t.price_currency || 'USD'} ${t.price_local}` : '—'}</td>
                      <td>
                        <span style={{
                          background:'var(--cream-dark)', color:'var(--gray)',
                          fontSize:'11px', fontWeight:600, padding:'3px 10px',
                          borderRadius:'100px'
                        }}>{model}</span>
                      </td>
                      <td>
                        <span className={`status ${s.cls}`}>{s.label}</span>
                        {t.status === 'rejected' && t.rejection_reason && (
                          <div style={{fontSize:'11px', color:'#8b2020', marginTop:'4px', maxWidth:'180px'}}>
                            {t.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{display:'flex', gap:'6px'}}>
                          {matriSure?.photo_url && (
                            <button className="btn-secondary btn-sm" onClick={() => setViewingPhoto(matriSure.photo_url)}>
                              📷 Ver foto
                            </button>
                          )}
                          <button className="btn-secondary btn-sm" onClick={() => onRepeat(t)}>↺ Repetir</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </div>
  )
}
