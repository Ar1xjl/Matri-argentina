import { useState, useEffect, Fragment } from 'react'
import { supabase } from '../../lib/supabaseClient'
import PricingPanel from './PricingPanel'
import MatriSurePhotoModal from './MatriSurePhotoModal'
import FirmnessEvaluationModal from './FirmnessEvaluationModal'
import Organizations from './Organizations'
import Inventory from './Inventory'
import PouchCatalogPanel from './PouchCatalogPanel'
import TabletCatalogPanel from './TabletCatalogPanel'
import KitsGlobal from './KitsGlobal'
import KitsDistributor from './KitsDistributor'
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

// Pre-shipment QA checklist, requested by Juan 2026-07-31 — Wassington's
// side of DOMAIN_MODEL.md's Treatment Dispatch Checklist, gating Approve the
// same way GeneratorTransferModal.jsx gates a generator dispatch, but here
// the actual per-item state the user ticks is what gets persisted (see
// approveTreatment in Portal.jsx).
const CHECKLIST_ITEMS = [
  { key: 'training_completed',         label: 'Protocolo y capacitación en manejo de calidad de MatriSure realizada.' },
  { key: 'kept_vacuum_sealed',         label: 'El kit se mantuvo en su envoltorio plástico sellado al vacío hasta el momento de uso.' },
  { key: 'refrigerated_2_6c',          label: 'Almacenamiento refrigerado in situ a 2–6°C.' },
  { key: 'lot_age_verified',           label: 'Verifiqué que el lote no supera los 30 días de antigüedad.' },
  { key: 'followed_card_instructions', label: 'Se siguieron las instrucciones de la tarjeta MatriSure.' },
]
const EMPTY_CHECKLIST = Object.fromEntries(CHECKLIST_ITEMS.map(i => [i.key, false]))

export default function Wassington({ treatments = [], onApprove, onReject, onGetPhotoUrl, onResolveMatriSure, profile, myRoles = [], onSaveFirmnessEvaluation, onGetFirmnessPdfUrl, onFetchExpiredLots, onAssignApplicator }) {
  // Fase G: CRM/Inventario/Catálogo/Precios and the commercial decisions
  // (approve/reject, MatriSure assistance review) are Owner/Aprobador
  // territory — Planificador/Operador/Viewer only ever see Tratamientos.
  // Read/write nuance per org_type on top of that (DOMAIN_MODEL.md, matrix
  // agreed 2026-07-15): Global is read-only on Inventario/Precios but full
  // on Catálogo (network-wide SKU governance); Sub-distribuidor is the
  // mirror image — full on its own Inventario/Precios, read-only Catálogo.
  const orgType = profile?.organizations?.org_type
  const canManage = myRoles.includes('owner') || myRoles.includes('approver')
  const isOperatorOnly = !canManage && myRoles.includes('operator')
  // Fase K-1 (2026-08-11): MatriSure Kit stewardship. At Global, the
  // "Encargado de Kits" (Operador) does the routine registration/release
  // work alongside Manager (Owner/Aprobador) — DOMAIN_MODEL.md Rule 49. At
  // Distribuidor it's deliberately Manager-only — assigning a kit to an
  // Aplicador is a supervisory call, not the Aplicador's own routine work
  // (Sub-distribuidor/Cliente come in a later step of this same Fase).
  const canManageKits = orgType === 'global'
    ? (canManage || myRoles.includes('operator'))
    : (orgType === 'distributor' && canManage)
  const inventoryReadOnly = orgType === 'global'
  const catalogReadOnly = orgType === 'subdistributor'
  const pricingReadOnly = orgType === 'global'

  const [tab,       setTab]       = useState('treatments')
  const [modal,     setModal]     = useState(null)
  const [editPrice, setEditPrice] = useState('')
  const [reason,    setReason]    = useState('')
  const [checklist, setChecklist] = useState(EMPTY_CHECKLIST)
  const [expiredLots, setExpiredLots] = useState([])
  const [approveError, setApproveError] = useState('')
  const [approving, setApproving] = useState(false)
  const [viewingPhoto, setViewingPhoto] = useState(null)
  const [firmnessTreatment, setFirmnessTreatment] = useState(null) // treatment row currently being evaluated, or null
  const [resolving, setResolving] = useState(null) // treatment id currently being resolved
  const [resolveError, setResolveError] = useState('')
  const [showPendingFilters, setShowPendingFilters] = useState(false)
  const [pendingFilters, setPendingFilters] = useState({})
  const [showProcessedFilters, setShowProcessedFilters] = useState(false)
  const [processedFilters, setProcessedFilters] = useState({})

  // Fase K-2b (2026-08-11) — Manager dispatches an approved, managed-service
  // Treatment to one of their own org's Aplicadores. Distribuidor-only for
  // now, same staged scope as the rest of Fase K.
  const [applicators, setApplicators] = useState([])
  const [assigningId, setAssigningId] = useState(null) // treatment id whose inline assign form is open, or null
  const [assignApplicatorId, setAssignApplicatorId] = useState('')
  const [assignError, setAssignError] = useState('')
  const [assignSaving, setAssignSaving] = useState(false)

  useEffect(() => {
    if (orgType !== 'distributor' || !profile?.org_id) return
    supabase.from('profiles').select('*, user_roles(role)').eq('org_id', profile.org_id).then(({ data }) => {
      setApplicators((data || []).filter(m => (m.user_roles || []).some(r => r.role === 'operator')))
    })
  }, [orgType, profile?.org_id])

  const openAssign = (treatmentId) => { setAssigningId(treatmentId); setAssignApplicatorId(''); setAssignError('') }
  const confirmAssign = async (treatmentId) => {
    if (!assignApplicatorId) return
    setAssignSaving(true)
    setAssignError('')
    const res = await onAssignApplicator?.(treatmentId, assignApplicatorId)
    setAssignSaving(false)
    if (res?.error) { setAssignError(res.error); return }
    setAssigningId(null)
  }

  const pending   = treatments.filter(t => t.status === 'submitted')
  const processed = treatments.filter(t => ['approved','applied','completed','rejected'].includes(t.status))
  // An Operador-only viewer is here for Firmness Evaluation, not pricing —
  // strip the price column from what they see/export.
  const processedColumns = isOperatorOnly ? PROCESSED_COLUMNS.filter(c => c.header !== 'Precio final') : PROCESSED_COLUMNS
  const filteredPending   = filterRows(pending, PENDING_COLUMNS, pendingFilters)
  const filteredProcessed = filterRows(processed, processedColumns, processedFilters)
  // Customer picked "no estoy seguro" during their own MatriSure capture —
  // the photo is already uploaded, this is Wassington confirming the result.
  const needsAssistance = treatments.filter(t => {
    const m = matriSureOf(t)
    return t.status === 'applied' && m?.assistance_requested && m?.result === 'pending_review' && !m?.reviewed_at
  })

  const openApprove = (t) => {
    setEditPrice(t.price_local ?? '')
    setChecklist(EMPTY_CHECKLIST)
    setApproveError('')
    setExpiredLots([])
    setModal({ treatment: t, action:'approve' })
    const sku = t.product === 'powder' ? 'MatriPowder' : 'MatriTablets'
    onFetchExpiredLots?.(profile?.org_id, sku).then(setExpiredLots)
  }
  const openReject  = (t) => { setReason(''); setModal({ treatment: t, action:'reject' }) }
  const closeModal  = () => setModal(null)

  const checklistComplete = CHECKLIST_ITEMS.every(i => checklist[i.key])
  const toggleChecklistItem = (key) => setChecklist(prev => ({ ...prev, [key]: !prev[key] }))

  const confirmApprove = async () => {
    setApproving(true)
    setApproveError('')
    const res = await onApprove(modal.treatment.id, editPrice, checklist)
    setApproving(false)
    if (res?.error) { setApproveError('No se pudo aprobar: ' + res.error); return }
    closeModal()
  }
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
    // Revenue/CRM-flavored stats — not relevant to an Operador here only for
    // Firmness Evaluation.
    ...(isOperatorOnly ? [] : [
      { icon:'👥', label:'Clientes activos',   value:'5',   unit:'en el portal',    bg:'#e8f4fc' },
      { icon:'💰', label:'Facturación USD',    value:`$${totalUSD.toFixed(2)}`, unit:'esta temporada', bg:'#f0f7e0' },
    ]),
  ]

  const TABS = [
    { id:'treatments', label:'📦 Tratamientos y aprobación' },
    ...(canManage ? [
      { id:'crm',       label:'👥 CRM — Clientes' },
      { id:'inventory', label:'📦 Inventario' },
      { id:'catalog',   label:'🏷️ Catálogo de SKU' },
      { id:'pricing',   label:'💲 Gestión de precios' },
    ] : []),
    ...(canManageKits ? [{ id:'kits', label:'🧪 Kits MatriSure' }] : []),
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
      {tab === 'pricing' && <PricingPanel profile={profile} readOnly={pricingReadOnly} />}

      {/* Kits tab (Fase K-1 — Global + Distribuidor so far) */}
      {tab === 'kits' && orgType === 'global' && <KitsGlobal profile={profile} />}
      {tab === 'kits' && orgType === 'distributor' && <KitsDistributor profile={profile} />}

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
          {canManage && needsAssistance.length > 0 && (
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

          {/* Pending treatments — Owner/Aprobador only, it's an approval queue */}
          {canManage && (
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
          )}

          {/* Recently processed */}
          {processed.length > 0 && (
            <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', marginBottom:'16px', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
              <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Procesados recientemente</span>
                <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                  <span style={{fontSize:'11px', color:'#6b6b6b'}}>{filteredProcessed.length} de {processed.length}</span>
                  <button className="btn-secondary btn-sm" onClick={() => setShowProcessedFilters(!showProcessedFilters)}>{showProcessedFilters ? '✕ Filtros' : 'Filtrar'}</button>
                  <button className="btn-secondary btn-sm" onClick={() => exportToExcel('tratamientos_procesados.xlsx', processedColumns, filteredProcessed)}>⬇ Exportar</button>
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
                    {(isOperatorOnly ? ['N° tratamiento','Cliente','Cámara','Estado','Motivo',''] : ['N° tratamiento','Cliente','Cámara','Precio final','Estado','Motivo','']).map(h => (
                      <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
                    ))}
                  </tr>
                  {showProcessedFilters && (
                    <tr>
                      {processedColumns.map(c => (
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
                    <Fragment key={i}>
                    <tr style={{borderBottom: i < filteredProcessed.length-1 ? '0.5px solid #ddddd5' : 'none'}}>
                      <td style={{padding:'12px 16px', fontWeight:700}}># {t.id.slice(0,8)}</td>
                      <td style={{padding:'12px 16px'}}>{t.organizations?.name}</td>
                      <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{t.cold_rooms?.name}</td>
                      {!isOperatorOnly && (
                        <td style={{padding:'12px 16px', fontWeight:700}}>{t.price_local != null ? `${t.price_currency || 'USD'} ${t.price_local}` : '—'}</td>
                      )}
                      <td style={{padding:'12px 16px'}}><span className={`status ${t.status}`}>{statusText}</span></td>
                      <td style={{padding:'12px 16px', color:'#888', fontSize:'12px'}}>{t.rejection_reason || '—'}</td>
                      <td style={{padding:'12px 16px'}}>
                        <div style={{display:'flex', gap:'6px'}}>
                          {canManage && matriSure?.photo_url && (
                            <button className="btn-secondary btn-sm" onClick={() => setViewingPhoto(matriSure.photo_url)}>📷 Ver foto</button>
                          )}
                          {canManage && t.start_photo_url && (
                            <button className="btn-secondary btn-sm" onClick={() => setViewingPhoto(t.start_photo_url)}>📷 Inicio</button>
                          )}
                          {canManage && t.end_photo_url && (
                            <button className="btn-secondary btn-sm" onClick={() => setViewingPhoto(t.end_photo_url)}>📷 Fin</button>
                          )}
                          {(canManage || myRoles.includes('operator')) && (t.status === 'applied' || t.status === 'completed') && (
                            <button className="btn-secondary btn-sm" onClick={() => setFirmnessTreatment(t)}>
                              {firmnessOf(t) ? '📊 Evaluación' : '📊 + Evaluación'}
                            </button>
                          )}
                          {/* Fase K-2b: dispatch a managed-service Treatment to one of this org's own Aplicadores */}
                          {canManage && orgType === 'distributor' && t.status === 'approved' && t.service_fee_local != null && (
                            t.assigned_applicator_id ? (
                              <span style={{background:'#f5f5ee', color:'#6b6b6b', fontSize:'11px', fontWeight:600, padding:'3px 10px', borderRadius:'100px'}}>
                                👷 {applicators.find(a => a.id === t.assigned_applicator_id)?.full_name || 'Aplicador asignado'}
                              </span>
                            ) : (
                              <button className="btn-secondary btn-sm" onClick={() => openAssign(t.id)}>👷 Asignar aplicador</button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Inline assign form — right below the row that opened it, never below the whole table */}
                    {assigningId === t.id && (
                      <tr style={{background:'#f0f7ff', borderBottom:'0.5px solid #ddddd5'}}>
                        <td colSpan={isOperatorOnly ? 6 : 7} style={{padding:'12px 16px'}}>
                          <div style={{display:'flex', flexWrap:'wrap', gap:'8px', alignItems:'center'}}>
                            <span style={{fontSize:'12px', fontWeight:700, color:'#0b4358'}}>Asignar a:</span>
                            <select value={assignApplicatorId} onChange={e => setAssignApplicatorId(e.target.value)}
                              style={{padding:'6px 8px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'13px'}}>
                              <option value="">Elegir Aplicador…</option>
                              {applicators.map(a => <option key={a.id} value={a.id}>{a.full_name || a.id}</option>)}
                            </select>
                            <button className="btn-primary btn-sm" disabled={assignSaving || !assignApplicatorId} onClick={() => confirmAssign(t.id)}>
                              {assignSaving ? 'Asignando…' : 'Confirmar'}
                            </button>
                            <button className="btn-secondary btn-sm" onClick={() => setAssigningId(null)}>Cancelar</button>
                            {applicators.length === 0 && <span style={{fontSize:'11px', color:'#b06a00'}}>No tenés ningún Aplicador dado de alta todavía.</span>}
                            {assignError && <span style={{fontSize:'11px', color:'#8b2020'}}>⚠️ {assignError}</span>}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
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
      {tab === 'inventory' && <Inventory profile={profile} readOnly={inventoryReadOnly} />}

      {/* SKU Catalog tab */}
      {tab === 'catalog' && (
        <div>
          <PouchCatalogPanel profile={profile} readOnly={catalogReadOnly} />
          <TabletCatalogPanel profile={profile} readOnly={catalogReadOnly} />
        </div>
      )}

      {/* Approve/Reject Modal */}
      {modal && (
        <div onClick={(e) => e.target === e.currentTarget && closeModal()} style={{position:'fixed', inset:0, background:'rgba(7,46,61,.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{background:'#fff', borderRadius:'14px', padding:'28px', width:'100%', maxWidth: modal.action === 'approve' ? '480px' : '420px', boxShadow:'0 8px 32px rgba(11,67,88,.2)'}}>
            {modal.action === 'approve' ? (
              <>
                <div style={{fontSize:'18px', fontWeight:800, color:'#0b4358', marginBottom:'4px'}}>Aprobar tratamiento</div>
                <div style={{fontSize:'13px', color:'#888', marginBottom:'20px'}}>#{modal.treatment.id.slice(0,8)} · {modal.treatment.organizations?.name} · {modal.treatment.cold_rooms?.name}</div>
                <div style={{marginBottom:'18px'}}>
                  <label style={{display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}}>Precio final ({modal.treatment.price_currency || 'USD'})</label>
                  <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8'}}/>
                  <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>Precio indicativo: {modal.treatment.price_local}. Podés confirmarlo o ajustarlo.</div>
                </div>

                <div style={{marginBottom:'14px', paddingTop:'14px', borderTop:'0.5px solid #ddddd5'}}>
                  <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358', marginBottom:'8px'}}>Checklist de pre-envío — manejo del kit MatriSure</div>
                  <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                    {CHECKLIST_ITEMS.map(item => (
                      <label key={item.key} style={{display:'flex', alignItems:'flex-start', gap:'8px', fontSize:'12px', color:'#0b4358', cursor:'pointer'}}>
                        <input type="checkbox" checked={checklist[item.key]} onChange={() => toggleChecklistItem(item.key)} style={{marginTop:'2px'}}/>
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                  {expiredLots.length > 0 && (
                    <div style={{marginTop:'10px', padding:'8px 10px', background:'#fdeaea', color:'#8b2020', borderRadius:'6px', fontSize:'11px'}}>
                      ⚠️ {expiredLots.length} {expiredLots.length === 1 ? 'lote' : 'lotes'} de {modal.treatment.product === 'powder' ? 'MatriPowder' : 'MatriTablets'} con más de 30 días de antigüedad en tu inventario — revisalo en Inventario → Lotes antes de confirmar.
                    </div>
                  )}
                </div>

                {approveError && (
                  <div style={{marginBottom:'14px', padding:'8px 10px', background:'#fdeaea', color:'#8b2020', borderRadius:'6px', fontSize:'12px'}}>⚠️ {approveError}</div>
                )}

                <div style={{display:'flex', gap:'10px'}}>
                  <button onClick={confirmApprove} className="btn-primary" style={{flex:1, background:'#1a6b30', opacity: (!checklistComplete || approving) ? .5 : 1}} disabled={!checklistComplete || approving}>
                    {approving ? 'Aprobando…' : '✓ Confirmar aprobación'}
                  </button>
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
