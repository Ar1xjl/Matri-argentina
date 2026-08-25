import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import sureLogo from '../../assets/logos/MatriSure_Logo.png'
import sureImg  from '../../assets/images/MatriSure_Kit.png'
import ApplicationForm from './ApplicationForm'
import MatriSureCapture from './MatriSureCapture'
import MatriSurePhotoModal from './MatriSurePhotoModal'
import RoomHistory from './RoomHistory'
import { pouchBreakdownDisplay } from '../../lib/dosing'
import { exportToExcel } from '../../lib/tableTools'
import { formatDate } from '../../lib/formatters'

export default function AppLog({ treatments = [], operatorName, onStartApplication, onFinishApplication, onSubmitMatriSure, onGetPhotoUrl, myKitUnits = [], onUseKit, onDiscardKit }) {
  const { t } = useTranslation()

  // "En curso" isn't a stored status (see Portal.jsx's startApplication/
  // finishApplication) — a real application can run 12-30h between Inicio and
  // Fin, so the Treatment stays 'approved' the whole time and this is derived
  // purely from which photos already exist (Juan, 2026-07-31).
  const statusLabel = (tr) => {
    if (tr.status === 'approved' && tr.start_photo_url && !tr.end_photo_url) {
      return { cls:'pending', label:t('appLog.status.inProgress') }
    }
    return ({
      approved:  { cls:'pending',   label:t('appLog.status.readyToApply') },
      applied:   { cls:'pending',   label:t('appLog.status.appliedMissingMatriSure') },
      completed: { cls:'confirmed', label:t('appLog.status.confirmed') },
    })[tr.status] || null
  }

  const APPLOG_COLUMNS = [
    { header: t('appLog.columns.room'),        get: tr => tr.cold_rooms?.name || '' },
    { header: t('appLog.columns.product'),     get: tr => tr.product === 'powder' ? 'MatriPowder' : 'MatriTablets' },
    { header: t('appLog.columns.doseSachets'), get: tr => pouchBreakdownDisplay(tr) },
    { header: t('appLog.columns.appliedDate'), get: tr => tr.applied_at ? formatDate(tr.applied_at) : '' },
    { header: t('appLog.columns.matriSure'),   get: tr => statusLabel(tr)?.label || '' },
  ]

  const [view, setView] = useState('list') // 'list' | 'startform' | 'choosekit' | 'applystart' | 'endform' | 'applyend' | 'capture' | 'review' | 'history'
  const [selected, setSelected] = useState(null)
  const [historyRoom, setHistoryRoom] = useState(null)
  const [pendingPhoto, setPendingPhoto] = useState(null)
  const [pendingTime, setPendingTime] = useState(null) // { startTime } or { endTime } while walking to the photo step
  // Fase K-2d (2026-08-11), moved to the Inicio step 2026-08-25 (backport
  // from DECCO-MatriSure's own Fase 7) — which kit_units row this
  // application will use, only relevant to a Distributor-dispatched
  // Aplicador (myKitUnits stays empty for a self-applying Customer, so the
  // whole 'choosekit' step just doesn't appear for them). Chosen at Start,
  // locked in via onUseKit the moment the Start photo actually saves — see
  // handleStartPhoto — so a cancelled camera step never leaves a kit
  // wrongly marked used.
  const [selectedKitId, setSelectedKitId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [viewingPhoto, setViewingPhoto] = useState(null)

  // Discard-a-damaged-kit, backport from DECCO-MatriSure's own Fase 7
  // (2026-08-25) — reachable both from the 'choosekit' step (mid-flow, about
  // to start an application) and from the "Disponibles" stat card at any
  // time (showKitBrowser, below).
  const [discardingId, setDiscardingId] = useState(null)
  const [discardReason, setDiscardReason] = useState('')
  const [discardSaving, setDiscardSaving] = useState(false)
  const [discardError, setDiscardError] = useState('')
  const [showKitBrowser, setShowKitBrowser] = useState(false)

  const relevant = treatments.filter(t => ['approved','applied','completed'].includes(t.status))

  const openStartForm = (t) => { setActionError(''); setSelected(t); setView('startform') }
  const openEndForm   = (t) => { setActionError(''); setSelected(t); setView('endform') }
  const openHistory   = (room) => { setHistoryRoom(room); setView('history') }
  const openCapture   = (t) => { setActionError(''); setSelected(t); setView('capture') }

  // Fase K backport (2026-08-25) — a kit-using Aplicador (myKitUnits ever
  // non-empty) picks/commits their kit right here, before the Start photo;
  // a self-applying Customer (myKitUnits always empty) skips straight to
  // the camera exactly as before.
  const handleStartTime = ({ startTime }) => {
    setPendingTime({ startTime })
    setSelectedKitId('')
    setView(myKitUnits.length > 0 ? 'choosekit' : 'applystart')
  }
  const handleEndTime   = ({ endTime })   => { setPendingTime({ endTime });   setView('applyend') }

  const cancelFlow = () => { setPendingTime(null); setSelected(null); setView('list') }

  const openDiscard = (kitId) => { setDiscardingId(kitId); setDiscardReason(''); setDiscardError('') }
  const confirmDiscard = async () => {
    if (!discardReason.trim()) { setDiscardError(t('appLog.chooseKit.discardReasonRequired')); return }
    setDiscardSaving(true)
    setDiscardError('')
    const res = await onDiscardKit?.(discardingId, discardReason.trim())
    setDiscardSaving(false)
    if (res?.error) { setDiscardError(res.error); return }
    if (selectedKitId === discardingId) setSelectedKitId('')
    setDiscardingId(null)
  }

  // Shared between the 'choosekit' step (selectable — picking which kit to
  // commit to) and the "Disponibles" stat-card browser (selectable: false —
  // just a place to discard a damaged one outside any specific Treatment).
  const renderKitRow = (k, { selectable }) => (
    <div key={k.id}>
      <div style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'8px', border: selectable && selectedKitId === k.id ? '1.5px solid #b5cc2e' : '0.5px solid #ddddd5'}}>
        {selectable && (
          <input type="radio" name="chooseKit" checked={selectedKitId === k.id} onChange={() => setSelectedKitId(k.id)}/>
        )}
        <span
          style={{fontFamily:'monospace', fontWeight:700, flex:1, cursor: selectable ? 'pointer' : 'default'}}
          onClick={() => selectable && setSelectedKitId(k.id)}
        >
          {k.tracking_number}
        </span>
        <button type="button" className="btn-secondary btn-sm" onClick={() => openDiscard(k.id)} title={t('appLog.chooseKit.discard')}>
          🗑️ {t('appLog.chooseKit.discard')}
        </button>
      </div>
      {discardingId === k.id && (
        <div style={{marginTop:'6px', marginBottom:'6px', padding:'10px 12px', background:'#fdeaea', borderRadius:'8px', display:'flex', flexWrap:'wrap', gap:'8px', alignItems:'center'}}>
          <span style={{fontSize:'12px', fontWeight:700, color:'#8b2020'}}>{t('appLog.chooseKit.discardWhy', { tracking: k.tracking_number })}</span>
          <input value={discardReason} onChange={e => setDiscardReason(e.target.value)} placeholder={t('appLog.chooseKit.discardPlaceholder')}
            style={{flex:1, minWidth:'160px', padding:'7px 10px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'13px'}}/>
          <button className="btn-primary btn-sm" style={{background:'#8b2020'}} disabled={discardSaving} onClick={confirmDiscard}>
            {discardSaving ? t('common.saving') : t('appLog.chooseKit.confirmDiscard')}
          </button>
          <button className="btn-secondary btn-sm" onClick={() => setDiscardingId(null)}>{t('common.cancel')}</button>
          {discardError && <span style={{fontSize:'11px', color:'#8b2020'}}>⚠️ {discardError}</span>}
        </div>
      )}
    </div>
  )

  const handleStartPhoto = async (startBlob) => {
    setSubmitting(true)
    const res = await onStartApplication(selected.id, { ...pendingTime, startBlob })
    if (res?.error) {
      // Stay on this step — MatriSureCapture keeps the captured blob in its
      // own local state, so the user can just retry without retaking it.
      setSubmitting(false)
      setActionError(t('appLog.errors.saveStart', { error: res.error }))
      return
    }
    // Lock the kit in only after the Start photo itself actually saved —
    // never before, so a cancelled/failed camera step never leaves a kit
    // wrongly marked used with nothing to back it up.
    if (selectedKitId) {
      const kitRes = await onUseKit?.(selectedKitId, selected.id)
      if (kitRes?.error) {
        setSubmitting(false)
        setActionError(t('appLog.errors.saveStart', { error: kitRes.error }))
        return
      }
    }
    setSubmitting(false)
    setPendingTime(null)
    setSelectedKitId('')
    setView('list')
  }

  const handleEndPhoto = async (endBlob) => {
    setSubmitting(true)
    const res = await onFinishApplication(selected.id, { ...pendingTime, endBlob })
    setSubmitting(false)
    if (res?.error) {
      setActionError(t('appLog.errors.saveEnd', { error: res.error }))
      return
    }
    setPendingTime(null)
    setActionError('')
    // Juan, 2026-08-11: go straight into the MatriSure photo instead of back
    // to the list — in practice whoever just finished the application is
    // right there checking the strip a moment later anyway. `selected` is
    // still the same Treatment, now 'applied', so onFinishApplication's own
    // status update is what actually unlocks this next step.
    setView('capture')
  }

  const handleCapture = (blob) => {
    setPendingPhoto(blob)
    setView('review')
  }

  // Kit choice/lock already happened at Inicio (handleStartPhoto) — this
  // step only submits the MatriSure result, same as before that backport.
  const handleReview = async (result, assistanceRequested = false) => {
    setSubmitting(true)
    const res = await onSubmitMatriSure(selected.id, pendingPhoto, { result, assistanceRequested })
    setSubmitting(false)
    if (res?.error) {
      setActionError(t('appLog.errors.saveMatriSure', { error: res.error }))
      return
    }
    setPendingPhoto(null)
    setView('list')
  }

  const errorBanner = actionError && (
    <div className="alert" style={{background:'#fdeaea', color:'#8b2020', border:'1px solid #f5c1c1', marginBottom:'16px'}}>
      ⚠️ {actionError}
    </div>
  )

  if (view === 'startform') {
    return (
      <div>
        {errorBanner}
        <ApplicationForm
          treatment={selected}
          operatorName={operatorName}
          mode="start"
          onSave={handleStartTime}
          onCancel={() => setView('list')}
        />
      </div>
    )
  }

  if (view === 'choosekit') {
    const availableKits = myKitUnits.filter(k => k.status === 'assigned')
    return (
      <div style={{maxWidth:'480px'}}>
        {errorBanner}
        <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'20px'}}>
          <div style={{fontSize:'14px', fontWeight:700, color:'#0b4358', marginBottom:'12px'}}>
            {t('appLog.chooseKit.title')}
          </div>
          {availableKits.length === 0 ? (
            <div style={{fontSize:'12px', color:'#8b2020', background:'#fdeaea', borderRadius:'8px', padding:'10px 12px', marginBottom:'16px'}}>
              {t('appLog.review.noKitsAvailable')}
            </div>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px'}}>
              {availableKits.map(k => renderKitRow(k, { selectable: true }))}
            </div>
          )}
          <div style={{display:'flex', gap:'8px'}}>
            <button className="btn-primary" disabled={availableKits.length === 0 || !selectedKitId} onClick={() => setView('applystart')}>
              {t('appLog.chooseKit.continue')}
            </button>
            <button className="btn-secondary" onClick={cancelFlow}>{t('common.cancel')}</button>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'applystart') {
    return (
      <div>
        {errorBanner}
        <div className="alert info" style={{marginBottom:'16px'}}>
          {t('appLog.startPhotoHint')}
        </div>
        <MatriSureCapture
          onCapture={handleStartPhoto}
          onCancel={cancelFlow}
          bannerText={t('appLog.startPhotoBanner')}
          confirmLabel={submitting ? t('common.saving') : t('appLog.useAsStartPhoto')}
          previewAlt={t('appLog.startPhotoAlt')}
        />
      </div>
    )
  }

  if (view === 'endform') {
    return (
      <div>
        {errorBanner}
        <ApplicationForm
          treatment={selected}
          operatorName={operatorName}
          mode="end"
          onSave={handleEndTime}
          onCancel={() => setView('list')}
        />
      </div>
    )
  }

  if (view === 'applyend') {
    return (
      <div>
        {errorBanner}
        <div className="alert info" style={{marginBottom:'16px'}}>
          {t('appLog.endPhotoHint')}
        </div>
        <MatriSureCapture
          onCapture={handleEndPhoto}
          onCancel={cancelFlow}
          bannerText={t('appLog.endPhotoBanner')}
          confirmLabel={submitting ? t('common.saving') : t('appLog.useAsEndPhoto')}
          previewAlt={t('appLog.endPhotoAlt')}
        />
      </div>
    )
  }

  if (view === 'capture') {
    return (
      <MatriSureCapture
        onCapture={handleCapture}
        onCancel={() => setView('list')}
      />
    )
  }

  if (view === 'review') {
    // Kit choice/lock now happens at Inicio (Fase K backport, 2026-08-25) —
    // this just shows which one was used, read-only, looked up by
    // used_treatment_id (DB-backed, not local state) since Inicio and this
    // MatriSure step can be hours or days apart and this component may well
    // have remounted in between. Stays undefined for a self-applying
    // Customer, exactly as before.
    const usedKit = myKitUnits.find(k => k.used_treatment_id === selected.id)
    return (
      <div style={{maxWidth:'480px'}}>
        {errorBanner}
        <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'20px'}}>
          <img src={URL.createObjectURL(pendingPhoto)} alt="MatriSure" style={{width:'100%', borderRadius:'8px', marginBottom:'16px'}}/>

          {usedKit && (
            <div style={{marginBottom:'16px', fontSize:'13px', color:'#0b4358', background:'#f0f7e0', borderRadius:'8px', padding:'9px 12px', fontFamily:'monospace', fontWeight:700}}>
              {t('appLog.review.kitUsedReadonly', { tracking: usedKit.tracking_number })}
            </div>
          )}

          <div style={{fontSize:'14px', fontWeight:700, color:'#0b4358', marginBottom:'12px'}}>{t('appLog.review.question')}</div>
          <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
            <button className="btn-primary" style={{background:'#1a6b30'}} disabled={submitting} onClick={() => handleReview('confirmed')}>
              {t('appLog.review.confirmed')}
            </button>
            <button className="btn-primary" style={{background:'#b06a00'}} disabled={submitting} onClick={() => handleReview('not_reached')}>
              {t('appLog.review.notReached')}
            </button>
            <button className="btn-secondary" disabled={submitting} onClick={() => handleReview('pending_review', true)}>
              {t('appLog.review.askHelp')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'history') {
    return (
      <RoomHistory
        roomName={historyRoom}
        onClose={() => setView('list')}
      />
    )
  }

  return (
    <div>
      {viewingPhoto && (
        <MatriSurePhotoModal path={viewingPhoto} onGetPhotoUrl={onGetPhotoUrl} onClose={() => setViewingPhoto(null)} />
      )}

      {/* Fase K backport (2026-08-25) — browse/discard your own assigned
          kits any time, not only mid-flow at Inicio. Opened from the
          "Disponibles" stat card below. */}
      {showKitBrowser && (
        <div
          onClick={(e) => e.target === e.currentTarget && setShowKitBrowser(false)}
          style={{position:'fixed', inset:0, background:'rgba(7,46,61,.7)', backdropFilter:'blur(4px)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center'}}
        >
          <div style={{background:'#fff', borderRadius:'14px', padding:'20px', maxWidth:'480px', width:'100%', maxHeight:'80vh', overflowY:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px'}}>
              <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>{t('appLog.chooseKit.browseTitle')}</span>
              <button onClick={() => setShowKitBrowser(false)} style={{background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#6b7280'}}>✕</button>
            </div>
            {myKitUnits.filter(k => k.status === 'assigned').length === 0 ? (
              <div style={{fontSize:'13px', color:'#888', textAlign:'center', padding:'20px'}}>{t('appLog.review.noKitsAvailable')}</div>
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                {myKitUnits.filter(k => k.status === 'assigned').map(k => renderKitRow(k, { selectable: false }))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fase K-2d/e (2026-08-11) — only ever shows for a Distributor-dispatched
          Aplicador (myKitUnits stays empty for a self-applying Customer).
          Same stat-card style as the rest of the portal's dashboards, per
          Juan's feedback that the earlier alert-banner version read like a
          warning instead of a status summary. */}
      {myKitUnits.length > 0 && (
        <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'16px'}}>
          {[
            { icon:'🧪', label:t('appLog.kitStats.assigned'),  value: myKitUnits.length, bg:'#e8f4fc' },
            { icon:'✅', label:t('appLog.kitStats.available'), value: myKitUnits.filter(k => k.status === 'assigned').length,  bg:'#eaf7ee', onClick: () => setShowKitBrowser(true) },
            { icon:'📸', label:t('appLog.kitStats.used'),      value: myKitUnits.filter(k => k.status === 'used').length,      bg:'#f0f7e0' },
            { icon:'🗑️', label:t('appLog.kitStats.discarded'), value: myKitUnits.filter(k => k.status === 'destroyed').length, bg:'#fdeaea' },
          ].map((s,i) => (
            <div key={i} onClick={s.onClick} style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'18px', position:'relative', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)', cursor: s.onClick ? 'pointer' : 'default'}}>
              <div style={{position:'absolute', top:0, left:0, right:0, height:'3px', background:'#b5cc2e'}}/>
              <div style={{position:'absolute', right:'14px', top:'16px', width:'36px', height:'36px', borderRadius:'8px', background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px'}}>{s.icon}</div>
              <div style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'6px'}}>{s.label}</div>
              <div style={{fontSize:'26px', fontWeight:800, color:'#0b4358', lineHeight:1}}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="alert success">
        {t('appLog.livePhotoNotice')}
      </div>

      <div className="card">
        <div className="card-body" style={{display:'flex', alignItems:'center', gap:'20px'}}>
          <img src={sureImg} alt="MatriSure Kit" style={{height:'80px', objectFit:'contain', flexShrink:0}}/>
          <div>
            <img src={sureLogo} alt="MatriSure" style={{height:'28px', objectFit:'contain', marginBottom:'8px', display:'block'}}/>
            <p style={{fontSize:'13px', color:'var(--gray)', lineHeight:1.6}}>
              {t('appLog.matriSureDesc')}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('sidebar.nav.applog')}</span>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <span style={{fontSize:'12px', color:'var(--gray)'}}>{t('appLog.season2026')}</span>
            <button className="btn-secondary btn-sm" onClick={() => exportToExcel('registro_de_aplicaciones.xlsx', APPLOG_COLUMNS, relevant)}>{t('common.exportExcel')}</button>
          </div>
        </div>
        <div style={{padding:0}}>
          {relevant.length === 0 ? (
            <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
              {t('appLog.empty')}
            </div>
          ) : (
            <div className="table-scroll"><table className="data-table">
              <thead>
                <tr>
                  <th>{t('appLog.columns.room')}</th><th>{t('appLog.columns.product')}</th><th>{t('appLog.columns.doseSachets')}</th>
                  <th>{t('appLog.columns.appliedDate')}</th><th>{t('appLog.columns.matriSure')}</th><th></th>
                </tr>
              </thead>
              <tbody>
                {relevant.map(tr => {
                  const s = statusLabel(tr)
                  const inProgress = tr.status === 'approved' && tr.start_photo_url && !tr.end_photo_url
                  return (
                    <tr key={tr.id}>
                      <td style={{fontWeight:600}}>{tr.cold_rooms?.name}</td>
                      <td>
                        <span style={{
                          background: tr.product === 'powder' ? '#eef4c0' : '#e1f5ee',
                          color: tr.product === 'powder' ? '#4a6010' : '#0d7a5f',
                          fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'100px'
                        }}>{tr.product === 'powder' ? 'MatriPowder' : 'MatriTablets'}</span>
                      </td>
                      <td style={{fontFamily:'monospace', fontSize:'12px'}}>
                        {pouchBreakdownDisplay(tr)}
                      </td>
                      <td style={{color:'var(--gray)'}}>{tr.applied_at ? formatDate(tr.applied_at) : '—'}</td>
                      <td>{s ? <span className={`status ${s.cls}`}>{s.label}</span> : '—'}</td>
                      <td>
                        <div style={{display:'flex', gap:'6px'}}>
                          {tr.status === 'approved' && !tr.start_photo_url && (
                            <button className="btn-lime btn-sm" onClick={() => openStartForm(tr)}>
                              {t('appLog.startApplication')}
                            </button>
                          )}
                          {inProgress && (
                            <button className="btn-lime btn-sm" onClick={() => openEndForm(tr)}>
                              {t('appLog.finishApplication')}
                            </button>
                          )}
                          {tr.status === 'applied' && (
                            <button className="btn-lime btn-sm" onClick={() => openCapture(tr)}>
                              {t('appLog.uploadMatriSure')}
                            </button>
                          )}
                          {tr.start_photo_url && (
                            <button className="btn-secondary btn-sm" onClick={() => setViewingPhoto(tr.start_photo_url)}>{t('appLog.photoStart')}</button>
                          )}
                          {tr.end_photo_url && (
                            <button className="btn-secondary btn-sm" onClick={() => setViewingPhoto(tr.end_photo_url)}>{t('appLog.photoEnd')}</button>
                          )}
                          <button className="btn-secondary btn-sm" onClick={() => openHistory(tr.cold_rooms?.name)}>
                            {t('rooms.history')}
                          </button>
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
