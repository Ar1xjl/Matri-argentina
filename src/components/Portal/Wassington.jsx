import { useState } from 'react'
import PricingPanel from './PricingPanel'
import MatriSurePhotoModal from './MatriSurePhotoModal'
import FirmnessEvaluationModal from './FirmnessEvaluationModal'
import Organizations from './Organizations'
import Inventory from './Inventory'
import PouchCatalogPanel from './PouchCatalogPanel'
import TabletCatalogPanel from './TabletCatalogPanel'
import { pouchBreakdownDisplay } from '../../lib/dosing'
import { exportToExcel, filterRows } from '../../lib/tableTools'

function matriSureOf(t) {
  const m = t.matrisure_verifications
  return Array.isArray(m) ? (m[0] ?? null) : (m ?? null)
}

function firmnessOf(t) {
  const f = t.firmness_evaluations
  return Array.isArray(f) ? (f[0] ?? null) : (f ?? null)
}

const PENDING_COLUMNS = [
  { header: 'N° tratamiento', get: t => `#${t.id.slice(0,8)}` },
  { header: 'Cliente',        get: t => t.organizations?.name || '' },
  { header: 'Cámara',         get: t => t.cold_rooms?.name || '' },
  { header: 'Producto',       get: t => t.product === 'powder' ? 'MatriPowder' : 'MatriTablets' },
  { header: 'Sachets',        get: t => pouchBreakdownDisplay(t) },
  { header: 'Precio',         get: t => t.price_local != null ? `${t.price_currency || 'USD'} ${t.price_local}` : '' },
  { header: 'Modelo',         get: t => t.service_fee_local != null ? 'Servicio' : 'Propio' },
  { header: 'Fecha',          get: t => new Date(t.created_at).toLocaleDateString('es-AR') },
]

const PROCESSED_COLUMNS = [
  { header: 'N° tratamiento', get: t => `#${t.id.slice(0,8)}` },
  { header: 'Cliente',        get: t => t.organizations?.name || '' },
  { header: 'Cámara',         get: t => t.cold_rooms?.name || '' },
  { header: 'Precio final',   get: t => t.price_local != null ? `${t.price_currency || 'USD'} ${t.price_local}` : '' },
  { header: 'Estado',         get: t => ({ approved:'✓ Aprobado', applied:'🔧 Aplicado', completed:'📸 MatriSure OK', rejected:'✗ Rechazado' }[t.status] || t.status) },
  { header: 'Motivo',         get: t => t.rejection_reason || '' },
]

export default function Wassington({ treatments = [], onApprove, onReject, onGetPhotoUrl, onResolveMatriSure, profile, onSaveFirmnessEvaluation, onGetFirmnessPdfUrl }) {
  const [tab,       setTab]       = useState('treatments')
  const [modal,     setModal]     = useState(null)
  const [editPrice, setEditPrice] = useState('')
  const [reason,    setReason]    = useState('')
  const [viewingPhoto, setViewingPhoto] = useState(null)
  const [firmnessTreatment, setFirmnessTreatment] = useState(null) // treatment row currently being evaluated, or null
  const [resolving, setResolving] = useState(null) // treatment id currently being resolved
  const [resolveError, setResolveError] = useState('')
  const [showPendingFilters, setShowPendingFilters] = useState(false)
  const [pendingFilters, setPendingFilters] = useState({})
  const [showProcessedFilters, setShowProcessedFilters] = useState(false)
  const [processedFilters, setProcessedFilters] = useState({})

  const pending   = treatments.filter(t => t.status === 'submitted')
  const processed = treatments.filter(t => ['approved','applied','completed','rejected'].includes(t.status))
  const filteredPending   = filterRows(pending, PENDING_COLUMNS, pendingFilters)
  const filteredProcessed = filterRows(processed, PROCESSED_COLUMNS, processedFilters)
  // Customer picked "no estoy seguro" during their own MatriSure capture —
  // the photo is already uploaded, this is Wassington confirming the result.
  const needsAssistance = treatments.filter(t => {
    const m = matriSureOf(t)
    return t.status === 'applied' && m?.assistance_requested && m?.result === 'pending_review' && !m?.reviewed_at
  })

  const openApprove = (t) => { setEditPrice(t.price_local ?? ''); setModal({ treatment: t, action:'approve' }) }
  const openReject  = (t) => { setReason(''); setModal({ treatment: t, action:'reject' }) }
  const closeModal  = () => setModal(null)

  const confirmApprove = () => { onApprove(modal.treatment.id, editPrice); closeModal() }
  const confirmReject  = () => { onReject(modal.treatment.id, reason);     closeModal() }

  const resolveAssistance = async (treatmentId, result) => {
    setResolving(treatmentId)
    setResolveError('')
    const res = await onResolveMatriSure(treatmentId, result)
    setResolving(null)
    if (res?.error) setResolveError('No se pudo guardar la confirmación: ' + res.error)
  }

  const totalUSD = treatments
    .filter(t => t.status === 'approved' || t.status === 'applied' || t.status === 'completed')
    .reduce((s, t) => s + parseFloat(t.price_local || 0), 0)

  const STATS = [
    { icon:'⏳', label:'Tratamientos pendientes', value:String(pending.length), unit:'requieren aprobación', bg:'#fff3cd' },
    { icon:'✅', label:'Tratamientos aprobados',  value:String(treatments.filter(t => t.status==='approved'||t.status==='applied'||t.status==='completed').length), unit:'esta temporada', bg:'#eaf7ee' },
    { icon:'👥', label:'Clientes activos',   value:'5',   unit:'en el portal',    bg:'#e8f4fc' },
    { icon:'💰', label:'Facturación USD',    value:`$${totalUSD.toFixed(2)}`, unit:'esta temporada', bg:'#f0f7e0' },
  ]

  const TABS = [
    { id:'treatments', label:'📦 Tratamientos y aprobación' },
    { id:'crm',        label:'👥 CRM — Clientes' },
    { id:'inventory',  label:'📦 Inventario' },
    { id:'catalog',    label:'🏷️ Catálogo de SKU' },
    { id:'pricing',    label:'💲 Gestión de precios' },
  ]

  return (
    <div>
      {viewingPhoto && (
        <MatriSurePhotoModal path={viewingPhoto} onGetPhotoUrl={onGetPhotoUrl} onClose={() => setViewingPhoto(null)} />
      )}

      {firmnessTreatment && (
        <FirmnessEvaluationModal
          treatment={firmnessTreatment}
          evaluation={firmnessOf(firmnessTreatment)}
          canEdit={true}
          evaluatorName={profile?.full_name}
          onSave={onSaveFirmnessEvaluation}
          onGetPdfUrl={onGetFirmnessPdfUrl}
          onClose={() => setFirmnessTreatment(null)}
        />
      )}

      {/* Tab selector */}
      <div style={{display:'flex', marginBottom:'24px', borderRadius:'10px', overflow:'hidden', border:'0.5px solid #ddddd5', background:'#fff'}}>
        {TABS.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex:1, padding:'12px', border:'none',
              borderRight: i < TABS.length-1 ? '0.5px solid #ddddd5' : 'none',
              background: tab === t.id ? '#0b4358' : '#fff',
              color: tab === t.id ? '#fff' : '#0b4358',
              fontSize:'13px', fontWeight:600, cursor:'pointer', transition:'.15s'
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Pricing tab */}
      {tab === 'pricing' && <PricingPanel profile={profile} />}

      {/* Treatments tab */}
      {tab === 'treatments' && (
        <div>
          {/* Stats */}
          <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px'}}>
            {STATS.map((s,i) => (
              <div key={i} style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'18px', position:'relative', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
                <div style={{position:'absolute', top:0, left:0, right:0, height:'3px', background:'#b5cc2e'}}/>
                <div style={{position:'absolute', right:'14px', top:'16px', width:'36px', height:'36px', borderRadius:'8px', background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px'}}>{s.icon}</div>
                <div style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'6px'}}>{s.label}</div>
                <div style={{fontSize:'26px', fontWeight:800, color:'#0b4358', lineHeight:1}}>{s.value}</div>
                <div style={{fontSize:'11px', color:'#6b6b6b', marginTop:'4px'}}>{s.unit}</div>
              </div>
            ))}
          </div>

          {/* MatriSure assistance requests — Customer wasn't sure and asked for help */}
          {needsAssistance.length > 0 && (
            <div style={{background:'#fff', borderRadius:'12px', border:'1px solid #f5c97a', overflow:'hidden', marginBottom:'16px', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
              <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff8ea'}}>
                <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>🙋 MatriSure — el cliente pidió ayuda para confirmar</span>
                <span style={{background:'#fff3cd', color:'#b06a00', fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'100px'}}>{needsAssistance.length} esperando</span>
              </div>
              {resolveError && (
                <div style={{padding:'10px 20px', color:'#8b2020', fontSize:'12px', background:'#fdeaea'}}>⚠️ {resolveError}</div>
              )}
              <div className="table-scroll"><table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
                <thead>
                  <tr>
                    {['N° tratamiento','Cliente','Cámara','Foto',''].map(h => (
                      <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {needsAssistance.map((t, i) => (
                    <tr key={t.id} style={{borderBottom: i < needsAssistance.length-1 ? '0.5px solid #ddddd5' : 'none'}}>
                      <td style={{padding:'12px 16px', fontWeight:700}}># {t.id.slice(0,8)}</td>
                      <td style={{padding:'12px 16px'}}>{t.organizations?.name}</td>
                      <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{t.cold_rooms?.name}</td>
                      <td style={{padding:'12px 16px'}}>
                        <button className="btn-secondary btn-sm" onClick={() => setViewingPhoto(matriSureOf(t).photo_url)}>📷 Ver foto</button>
                      </td>
                      <td style={{padding:'12px 16px'}}>
                        <div style={{display:'flex', gap:'6px'}}>
                          <button disabled={resolving === t.id} onClick={() => resolveAssistance(t.id, 'confirmed')}
                            style={{background:'#eaf7ee', color:'#1a6b30', border:'0.5px solid #a3d9b0', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:700, cursor:'pointer'}}>
                            ✓ Dosis alcanzada
                          </button>
                          <button disabled={resolving === t.id} onClick={() => resolveAssistance(t.id, 'not_reached')}
                            style={{background:'#fdeaea', color:'#8b2020', border:'0.5px solid #f5c1c1', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:700, cursor:'pointer'}}>
                            ✗ No alcanzada
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}

          {/* Pending treatments */}
          <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', marginBottom:'16px', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
            <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Tratamientos pendientes de aprobación</span>
              <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                <span style={{background:'#fff3cd', color:'#b06a00', fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'100px'}}>{filteredPending.length} de {pending.length} pendientes</span>
                <button className="btn-secondary btn-sm" onClick={() => setShowPendingFilters(!showPendingFilters)}>{showPendingFilters ? '✕ Filtros' : 'Filtrar'}</button>
                <button className="btn-secondary btn-sm" onClick={() => exportToExcel('tratamientos_pendientes.xlsx', PENDING_COLUMNS, filteredPending)}>⬇ Exportar</button>
              </div>
            </div>
            {pending.length === 0 ? (
              <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
                ✓ No hay tratamientos pendientes — todos procesados.
              </div>
            ) : filteredPending.length === 0 ? (
              <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
                Ningún tratamiento coincide con los filtros aplicados.
              </div>
            ) : (
              <div className="table-scroll"><table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
                <thead>
                  <tr>
                    {['N° tratamiento','Cliente','Cámara','Producto','Sachets','Precio','Modelo','Fecha',''].map(h => (
                      <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
                    ))}
                  </tr>
                  {showPendingFilters && (
                    <tr>
                      {PENDING_COLUMNS.map(c => (
                        <th key={c.header} style={{padding:'4px 8px'}}>
                          <input
                            value={pendingFilters[c.header] || ''}
                            onChange={e => setPendingFilters(prev => ({ ...prev, [c.header]: e.target.value }))}
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
                  {filteredPending.map((t, i) => {
                    const model = t.service_fee_local != null ? 'Servicio' : 'Propio'
                    return (
                      <tr key={i} style={{borderBottom:'0.5px solid #ddddd5'}}>
                        <td style={{padding:'12px 16px', fontWeight:700}}># {t.id.slice(0,8)}</td>
                        <td style={{padding:'12px 16px'}}>{t.organizations?.name}</td>
                        <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{t.cold_rooms?.name}</td>
                        <td style={{padding:'12px 16px'}}><span style={{background:t.product==='powder'?'#f0f7e0':'#eaf7ee', color:t.product==='powder'?'#3b6d11':'#1a6b30', fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'100px'}}>{t.product==='powder' ? 'MatriPowder' : 'MatriTablets'}</span></td>
                        <td style={{padding:'12px 16px', fontFamily:'monospace', fontSize:'12px'}}>{pouchBreakdownDisplay(t)}</td>
                        <td style={{padding:'12px 16px', fontWeight:700}}>{t.price_local != null ? `${t.price_currency || 'USD'} ${t.price_local}` : '—'}</td>
                        <td style={{padding:'12px 16px'}}><span style={{background:'#f5f5ee', color:'#6b6b6b', fontSize:'11px', fontWeight:600, padding:'2px 8px', borderRadius:'100px'}}>{model}</span></td>
                        <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{new Date(t.created_at).toLocaleDateString('es-AR')}</td>
                        <td style={{padding:'12px 16px'}}>
                          <div style={{display:'flex', gap:'6px'}}>
                            <button onClick={() => openApprove(t)} style={{background:'#eaf7ee', color:'#1a6b30', border:'0.5px solid #a3d9b0', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:700, cursor:'pointer'}}>✓ Aprobar</button>
                            <button onClick={() => openReject(t)}  style={{background:'#fdeaea', color:'#8b2020', border:'0.5px solid #f5c1c1', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:700, cursor:'pointer'}}>✗ Rechazar</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table></div>
            )}
          </div>

          {/* Recently processed */}
          {processed.length > 0 && (
            <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', marginBottom:'16px', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
              <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Procesados recientemente</span>
                <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                  <span style={{fontSize:'11px', color:'#6b6b6b'}}>{filteredProcessed.length} de {processed.length}</span>
                  <button className="btn-secondary btn-sm" onClick={() => setShowProcessedFilters(!showProcessedFilters)}>{showProcessedFilters ? '✕ Filtros' : 'Filtrar'}</button>
                  <button className="btn-secondary btn-sm" onClick={() => exportToExcel('tratamientos_procesados.xlsx', PROCESSED_COLUMNS, filteredProcessed)}>⬇ Exportar</button>
                </div>
              </div>
              {filteredProcessed.length === 0 ? (
                <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
                  Ningún tratamiento coincide con los filtros aplicados.
                </div>
              ) : (
              <div className="table-scroll"><table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
                <thead>
                  <tr>
                    {['N° tratamiento','Cliente','Cámara','Precio final','Estado','Motivo',''].map(h => (
                      <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
                    ))}
                  </tr>
                  {showProcessedFilters && (
                    <tr>
                      {PROCESSED_COLUMNS.map(c => (
                        <th key={c.header} style={{padding:'4px 8px'}}>
                          <input
                            value={processedFilters[c.header] || ''}
                            onChange={e => setProcessedFilters(prev => ({ ...prev, [c.header]: e.target.value }))}
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
                  {filteredProcessed.map((t, i) => {
                    const matriSure = matriSureOf(t)
                    const statusText = {
                      approved: '✓ Aprobado', applied: '🔧 Aplicado', completed: '📸 MatriSure OK', rejected: '✗ Rechazado',
                    }[t.status] || t.status
                    return (
                    <tr key={i} style={{borderBottom: i < filteredProcessed.length-1 ? '0.5px solid #ddddd5' : 'none'}}>
                      <td style={{padding:'12px 16px', fontWeight:700}}># {t.id.slice(0,8)}</td>
                      <td style={{padding:'12px 16px'}}>{t.organizations?.name}</td>
                      <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{t.cold_rooms?.name}</td>
                      <td style={{padding:'12px 16px', fontWeight:700}}>{t.price_local != null ? `${t.price_currency || 'USD'} ${t.price_local}` : '—'}</td>
                      <td style={{padding:'12px 16px'}}><span className={`status ${t.status}`}>{statusText}</span></td>
                      <td style={{padding:'12px 16px', color:'#888', fontSize:'12px'}}>{t.rejection_reason || '—'}</td>
                      <td style={{padding:'12px 16px'}}>
                        <div style={{display:'flex', gap:'6px'}}>
                          {matriSure?.photo_url && (
                            <button className="btn-secondary btn-sm" onClick={() => setViewingPhoto(matriSure.photo_url)}>📷 Ver foto</button>
                          )}
                          {(t.status === 'applied' || t.status === 'completed') && (
                            <button className="btn-secondary btn-sm" onClick={() => setFirmnessTreatment(t)}>
                              {firmnessOf(t) ? '📊 Evaluación' : '📊 + Evaluación'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CRM tab */}
      {tab === 'crm' && <Organizations profile={profile} />}

      {/* Inventory tab */}
      {tab === 'inventory' && <Inventory profile={profile} />}

      {/* SKU Catalog tab */}
      {tab === 'catalog' && (
        <div>
          <PouchCatalogPanel profile={profile} />
          <TabletCatalogPanel profile={profile} />
        </div>
      )}

      {/* Approve/Reject Modal */}
      {modal && (
        <div onClick={(e) => e.target === e.currentTarget && closeModal()} style={{position:'fixed', inset:0, background:'rgba(7,46,61,.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{background:'#fff', borderRadius:'14px', padding:'28px', width:'100%', maxWidth:'420px', boxShadow:'0 8px 32px rgba(11,67,88,.2)'}}>
            {modal.action === 'approve' ? (
              <>
                <div style={{fontSize:'18px', fontWeight:800, color:'#0b4358', marginBottom:'4px'}}>Aprobar tratamiento</div>
                <div style={{fontSize:'13px', color:'#888', marginBottom:'20px'}}>#{modal.treatment.id.slice(0,8)} · {modal.treatment.organizations?.name} · {modal.treatment.cold_rooms?.name}</div>
                <div style={{marginBottom:'18px'}}>
                  <label style={{display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}}>Precio final ({modal.treatment.price_currency || 'USD'})</label>
                  <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8'}}/>
                  <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>Precio indicativo: {modal.treatment.price_local}. Podés confirmarlo o ajustarlo.</div>
                </div>
                <div style={{display:'flex', gap:'10px'}}>
                  <button onClick={confirmApprove} className="btn-primary" style={{flex:1, background:'#1a6b30'}}>✓ Confirmar aprobación</button>
                  <button onClick={closeModal} className="btn-secondary">Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <div style={{fontSize:'18px', fontWeight:800, color:'#0b4358', marginBottom:'4px'}}>Rechazar tratamiento</div>
                <div style={{fontSize:'13px', color:'#888', marginBottom:'20px'}}>#{modal.treatment.id.slice(0,8)} · {modal.treatment.organizations?.name} · {modal.treatment.cold_rooms?.name}</div>
                <div style={{marginBottom:'18px'}}>
                  <label style={{display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}}>Motivo del rechazo</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Ej: Stock insuficiente de MatriPowder 50g esta semana" style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8', fontFamily:'inherit', resize:'vertical'}}/>
                  <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>El cliente verá este motivo en su sección de Tratamientos.</div>
                </div>
                <div style={{display:'flex', gap:'10px'}}>
                  <button onClick={confirmReject} className="btn-primary" style={{flex:1, background:'#8b2020'}}>✗ Confirmar rechazo</button>
                  <button onClick={closeModal} className="btn-secondary">Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
