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

export default function AppLog({ treatments = [], operatorName, onStartApplication, onFinishApplication, onSubmitMatriSure, onGetPhotoUrl }) {
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

  const [view, setView] = useState('list') // 'list' | 'startform' | 'applystart' | 'endform' | 'applyend' | 'capture' | 'review' | 'history'
  const [selected, setSelected] = useState(null)
  const [historyRoom, setHistoryRoom] = useState(null)
  const [pendingPhoto, setPendingPhoto] = useState(null)
  const [pendingTime, setPendingTime] = useState(null) // { startTime } or { endTime } while walking to the photo step
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [viewingPhoto, setViewingPhoto] = useState(null)

  const relevant = treatments.filter(t => ['approved','applied','completed'].includes(t.status))

  const openStartForm = (t) => { setActionError(''); setSelected(t); setView('startform') }
  const openEndForm   = (t) => { setActionError(''); setSelected(t); setView('endform') }
  const openHistory   = (room) => { setHistoryRoom(room); setView('history') }
  const openCapture   = (t) => { setActionError(''); setSelected(t); setView('capture') }

  const handleStartTime = ({ startTime }) => { setPendingTime({ startTime }); setView('applystart') }
  const handleEndTime   = ({ endTime })   => { setPendingTime({ endTime });   setView('applyend') }

  const cancelFlow = () => { setPendingTime(null); setSelected(null); setView('list') }

  const handleStartPhoto = async (startBlob) => {
    setSubmitting(true)
    const res = await onStartApplication(selected.id, { ...pendingTime, startBlob })
    setSubmitting(false)
    if (res?.error) {
      // Stay on this step — MatriSureCapture keeps the captured blob in its
      // own local state, so the user can just retry without retaking it.
      setActionError(t('appLog.errors.saveStart', { error: res.error }))
      return
    }
    setPendingTime(null)
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
    setView('list')
  }

  const handleCapture = (blob) => {
    setPendingPhoto(blob)
    setView('review')
  }

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
    return (
      <div style={{maxWidth:'480px'}}>
        {errorBanner}
        <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'20px'}}>
          <img src={URL.createObjectURL(pendingPhoto)} alt="MatriSure" style={{width:'100%', borderRadius:'8px', marginBottom:'16px'}}/>
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
