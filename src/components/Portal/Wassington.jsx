import { useState } from 'react'
import PricingPanel from './PricingPanel'
import MatriSurePhotoModal from './MatriSurePhotoModal'
import Organizations from './Organizations'
import { pouchBreakdownLabel } from '../../lib/dosing'

function matriSureOf(t) {
  const m = t.matrisure_verifications
  return Array.isArray(m) ? (m[0] ?? null) : (m ?? null)
}

export default function Wassington({ treatments = [], onApprove, onReject, onGetPhotoUrl, profile }) {
  const [tab,       setTab]       = useState('treatments')
  const [modal,     setModal]     = useState(null)
  const [editPrice, setEditPrice] = useState('')
  const [reason,    setReason]    = useState('')
  const [viewingPhoto, setViewingPhoto] = useState(null)

  const pending   = treatments.filter(t => t.status === 'submitted')
  const processed = treatments.filter(t => ['approved','applied','completed','rejected'].includes(t.status))

  const openApprove = (t) => { setEditPrice(t.price_local ?? ''); setModal({ treatment: t, action:'approve' }) }
  const openReject  = (t) => { setReason(''); setModal({ treatment: t, action:'reject' }) }
  const closeModal  = () => setModal(null)

  const confirmApprove = () => { onApprove(modal.treatment.id, editPrice); closeModal() }
  const confirmReject  = () => { onReject(modal.treatment.id, reason);     closeModal() }

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
    { id:'pricing',    label:'💲 Gestión de precios' },
  ]

  return (
    <div>
      {viewingPhoto && (
        <MatriSurePhotoModal path={viewingPhoto} onGetPhotoUrl={onGetPhotoUrl} onClose={() => setViewingPhoto(null)} />
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
      {tab === 'pricing' && <PricingPanel />}

      {/* Treatments tab */}
      {tab === 'treatments' && (
        <div>
          {/* Stats */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px'}}>
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

          {/* Pending treatments */}
          <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', marginBottom:'16px', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
            <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Tratamientos pendientes de aprobación</span>
              <span style={{background:'#fff3cd', color:'#b06a00', fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'100px'}}>{pending.length} pendientes</span>
            </div>
            {pending.length === 0 ? (
              <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
                ✓ No hay tratamientos pendientes — todos procesados.
              </div>
            ) : (
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
                <thead>
                  <tr>
                    {['N° tratamiento','Cliente','Cámara','Producto','Sachets','Precio','Modelo','Fecha',''].map(h => (
                      <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pending.map((t, i) => {
                    const model = t.service_fee_local != null ? 'Servicio' : 'Propio'
                    return (
                      <tr key={i} style={{borderBottom:'0.5px solid #ddddd5'}}>
                        <td style={{padding:'12px 16px', fontWeight:700}}># {t.id.slice(0,8)}</td>
                        <td style={{padding:'12px 16px'}}>{t.organizations?.name}</td>
                        <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{t.cold_rooms?.name}</td>
                        <td style={{padding:'12px 16px'}}><span style={{background:t.product==='powder'?'#f0f7e0':'#eaf7ee', color:t.product==='powder'?'#3b6d11':'#1a6b30', fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'100px'}}>{t.product==='powder' ? 'MatriPowder' : 'MatriTablets'}</span></td>
                        <td style={{padding:'12px 16px', fontFamily:'monospace', fontSize:'12px'}}>{pouchBreakdownLabel(t.product, t.target_dose_ppb, t.cold_rooms?.volume_m3)}</td>
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
              </table>
            )}
          </div>

          {/* Recently processed */}
          {processed.length > 0 && (
            <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', marginBottom:'16px', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
              <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5'}}>
                <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Procesados recientemente</span>
              </div>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
                <thead>
                  <tr>
                    {['N° tratamiento','Cliente','Cámara','Precio final','Estado','Motivo',''].map(h => (
                      <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {processed.map((t, i) => {
                    const matriSure = matriSureOf(t)
                    const statusText = {
                      approved: '✓ Aprobado', applied: '🔧 Aplicado', completed: '📸 MatriSure OK', rejected: '✗ Rechazado',
                    }[t.status] || t.status
                    return (
                    <tr key={i} style={{borderBottom: i < processed.length-1 ? '0.5px solid #ddddd5' : 'none'}}>
                      <td style={{padding:'12px 16px', fontWeight:700}}># {t.id.slice(0,8)}</td>
                      <td style={{padding:'12px 16px'}}>{t.organizations?.name}</td>
                      <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{t.cold_rooms?.name}</td>
                      <td style={{padding:'12px 16px', fontWeight:700}}>{t.price_local != null ? `${t.price_currency || 'USD'} ${t.price_local}` : '—'}</td>
                      <td style={{padding:'12px 16px'}}><span className={`status ${t.status}`}>{statusText}</span></td>
                      <td style={{padding:'12px 16px', color:'#888', fontSize:'12px'}}>{t.rejection_reason || '—'}</td>
                      <td style={{padding:'12px 16px'}}>
                        {matriSure?.photo_url && (
                          <button className="btn-secondary btn-sm" onClick={() => setViewingPhoto(matriSure.photo_url)}>📷 Ver foto</button>
                        )}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CRM tab */}
      {tab === 'crm' && <Organizations profile={profile} />}

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
