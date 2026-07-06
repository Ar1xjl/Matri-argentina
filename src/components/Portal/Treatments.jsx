import { useState } from 'react'
import { pouchBreakdownLabel } from '../../lib/dosing'
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

export default function Treatments({ onNavigate, treatments = [], onGetPhotoUrl }) {
  const [viewingPhoto, setViewingPhoto] = useState(null) // storage path, or null

  return (
    <div>
      {viewingPhoto && (
        <MatriSurePhotoModal path={viewingPhoto} onGetPhotoUrl={onGetPhotoUrl} onClose={() => setViewingPhoto(null)} />
      )}
      <div style={{display:'flex', gap:'10px', marginBottom:'16px'}}>
        <button className="btn-primary" onClick={() => onNavigate('calculator')}>
          + Nuevo tratamiento
        </button>
        <button className="btn-secondary">Filtrar</button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Todos los tratamientos</span>
          <span style={{fontSize:'12px', color:'var(--gray)'}}>{treatments.length} tratamientos esta temporada</span>
        </div>
        <div style={{padding:0}}>
          {treatments.length === 0 ? (
            <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
              No hay tratamientos todavía. Hacé click en "+ Nuevo tratamiento" para crear el primero.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>N° tratamiento</th><th>Cámara</th><th>Producto</th>
                  <th>Sachets</th><th>Precio</th><th>Modelo</th>
                  <th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {treatments.map(t => {
                  const s = statusLabel(t.status)
                  const model = t.service_fee_local != null ? 'Servicio' : 'Propio'
                  const matriSure = matriSureOf(t)
                  return (
                    <tr key={t.id}>
                      <td style={{fontWeight:700, color:'var(--navy)'}}># {t.id.slice(0,8)}</td>
                      <td>{t.cold_rooms?.name}</td>
                      <td>{productTag(t.product)}</td>
                      <td style={{fontFamily:'monospace', fontSize:'12px'}}>
                        {pouchBreakdownLabel(t.product, t.target_dose_ppb, t.cold_rooms?.volume_m3)}
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
                          <button className="btn-secondary btn-sm">↺ Repetir</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
