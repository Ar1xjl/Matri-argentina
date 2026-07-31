import { useState } from 'react'
import sureLogo from '../../assets/logos/MatriSure_Logo.png'
import sureImg  from '../../assets/images/MatriSure_Kit.png'
import ApplicationForm from './ApplicationForm'
import MatriSureCapture from './MatriSureCapture'
import MatriSurePhotoModal from './MatriSurePhotoModal'
import RoomHistory from './RoomHistory'
import { pouchBreakdownDisplay } from '../../lib/dosing'
import { exportToExcel } from '../../lib/tableTools'

const statusLabel = (status) => ({
  approved:  { cls:'pending',   label:'⏳ Listo para aplicar' },
  applied:   { cls:'pending',   label:'🔧 Aplicado — falta MatriSure' },
  completed: { cls:'confirmed', label:'📸 Confirmado' },
}[status] || null)

const APPLOG_COLUMNS = [
  { header: 'Cámara',            get: t => t.cold_rooms?.name || '' },
  { header: 'Producto',          get: t => t.product === 'powder' ? 'MatriPowder' : 'MatriTablets' },
  { header: 'Dosis / sachets',   get: t => pouchBreakdownDisplay(t) },
  { header: 'Fecha aplicación',  get: t => t.applied_at ? new Date(t.applied_at).toLocaleDateString('es-AR') : '' },
  { header: 'MatriSure',         get: t => statusLabel(t.status)?.label || '' },
]

export default function AppLog({ treatments = [], operatorName, onApply, onSubmitMatriSure, onGetPhotoUrl }) {
  const [view, setView] = useState('list') // 'list' | 'form' | 'applystart' | 'applyend' | 'capture' | 'review' | 'history'
  const [selected, setSelected] = useState(null)
  const [historyRoom, setHistoryRoom] = useState(null)
  const [pendingPhoto, setPendingPhoto] = useState(null)
  const [pendingApply, setPendingApply] = useState(null) // { startTime, endTime, startBlob } while walking the applystart/applyend steps
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [viewingPhoto, setViewingPhoto] = useState(null)

  const relevant = treatments.filter(t => ['approved','applied','completed'].includes(t.status))

  const openForm = (t) => { setActionError(''); setSelected(t); setView('form') }
  const openHistory = (room) => { setHistoryRoom(room); setView('history') }
  const openCapture = (t) => { setActionError(''); setSelected(t); setView('capture') }

  // Times are only held in memory here — nothing is saved to Supabase until
  // both the start and end photos are captured too, right after this step.
  const handleApplyTimes = ({ startTime, endTime }) => {
    setPendingApply({ startTime, endTime })
    setView('applystart')
  }

  const handleApplyStartPhoto = (blob) => {
    setPendingApply(prev => ({ ...prev, startBlob: blob }))
    setView('applyend')
  }

  const cancelApplyFlow = () => { setPendingApply(null); setSelected(null); setView('list') }

  const handleApplyEndPhoto = async (endBlob) => {
    setSubmitting(true)
    const res = await onApply(selected.id, { ...pendingApply, endBlob })
    setSubmitting(false)
    if (res?.error) {
      // Stay on this step — the end photo is still held by MatriSureCapture's
      // own local state, so the user can just retry without retaking it.
      setActionError('No se pudo guardar el registro de aplicación: ' + res.error)
      return
    }
    setPendingApply(null)
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
      setActionError('No se pudo guardar la verificación MatriSure: ' + res.error)
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

  if (view === 'form') {
    return (
      <div>
        {errorBanner}
        <ApplicationForm
          treatment={selected}
          operatorName={operatorName}
          onSave={handleApplyTimes}
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
          📋 Paso 1 de 2 — foto al colocar el kit en la cámara, coincidente con la hora de inicio registrada.
        </div>
        <MatriSureCapture
          onCapture={handleApplyStartPhoto}
          onCancel={cancelApplyFlow}
          bannerText="Foto de INICIO de la aplicación — en vivo desde la cámara del dispositivo, no se permite subir desde la galería."
          confirmLabel="✓ Usar como foto de inicio"
          previewAlt="Foto de inicio de aplicación"
        />
      </div>
    )
  }

  if (view === 'applyend') {
    return (
      <div>
        {errorBanner}
        <div className="alert info" style={{marginBottom:'16px'}}>
          📋 Paso 2 de 2 — foto al finalizar la aplicación, coincidente con la hora de fin registrada.
        </div>
        <MatriSureCapture
          onCapture={handleApplyEndPhoto}
          onCancel={cancelApplyFlow}
          bannerText="Foto de FIN de la aplicación — en vivo desde la cámara del dispositivo, no se permite subir desde la galería."
          confirmLabel="✓ Usar como foto de fin y guardar"
          previewAlt="Foto de fin de aplicación"
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
          <div style={{fontSize:'14px', fontWeight:700, color:'#0b4358', marginBottom:'12px'}}>¿Qué mostró la tira?</div>
          <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
            <button className="btn-primary" style={{background:'#1a6b30'}} disabled={submitting} onClick={() => handleReview('confirmed')}>
              ✓ Dosis alcanzada
            </button>
            <button className="btn-primary" style={{background:'#b06a00'}} disabled={submitting} onClick={() => handleReview('not_reached')}>
              ✗ Dosis no alcanzada
            </button>
            <button className="btn-secondary" disabled={submitting} onClick={() => handleReview('pending_review', true)}>
              🙋 No estoy seguro — pedir ayuda a Wassington
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
        📸 Las fotos del Kit MatriSure deben tomarse en vivo desde la cámara del dispositivo. No se permiten cargas desde la galería.
      </div>

      <div className="card">
        <div className="card-body" style={{display:'flex', alignItems:'center', gap:'20px'}}>
          <img src={sureImg} alt="MatriSure Kit" style={{height:'80px', objectFit:'contain', flexShrink:0}}/>
          <div>
            <img src={sureLogo} alt="MatriSure" style={{height:'28px', objectFit:'contain', marginBottom:'8px', display:'block'}}/>
            <p style={{fontSize:'13px', color:'var(--gray)', lineHeight:1.6}}>
              Las tiras MatriSure cambian de color cuando la cámara alcanzó la dosis objetivo de 1-MCP.
              Fotografiá la tira al finalizar el tratamiento — la foto queda registrada con fecha,
              hora y número de cámara automáticamente.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Registro de aplicaciones</span>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <span style={{fontSize:'12px', color:'var(--gray)'}}>Temporada 2026</span>
            <button className="btn-secondary btn-sm" onClick={() => exportToExcel('registro_de_aplicaciones.xlsx', APPLOG_COLUMNS, relevant)}>⬇ Exportar a Excel</button>
          </div>
        </div>
        <div style={{padding:0}}>
          {relevant.length === 0 ? (
            <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
              No hay tratamientos aprobados todavía.
            </div>
          ) : (
            <div className="table-scroll"><table className="data-table">
              <thead>
                <tr>
                  <th>Cámara</th><th>Producto</th><th>Dosis / sachets</th>
                  <th>Fecha aplicación</th><th>MatriSure</th><th></th>
                </tr>
              </thead>
              <tbody>
                {relevant.map(t => {
                  const s = statusLabel(t.status)
                  return (
                    <tr key={t.id}>
                      <td style={{fontWeight:600}}>{t.cold_rooms?.name}</td>
                      <td>
                        <span style={{
                          background: t.product === 'powder' ? '#eef4c0' : '#e1f5ee',
                          color: t.product === 'powder' ? '#4a6010' : '#0d7a5f',
                          fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'100px'
                        }}>{t.product === 'powder' ? 'MatriPowder' : 'MatriTablets'}</span>
                      </td>
                      <td style={{fontFamily:'monospace', fontSize:'12px'}}>
                        {pouchBreakdownDisplay(t)}
                      </td>
                      <td style={{color:'var(--gray)'}}>{t.applied_at ? new Date(t.applied_at).toLocaleDateString('es-AR') : '—'}</td>
                      <td>{s ? <span className={`status ${s.cls}`}>{s.label}</span> : '—'}</td>
                      <td>
                        <div style={{display:'flex', gap:'6px'}}>
                          {t.status === 'approved' && (
                            <button className="btn-lime btn-sm" onClick={() => openForm(t)}>
                              📝 Registrar
                            </button>
                          )}
                          {t.status === 'applied' && (
                            <button className="btn-lime btn-sm" onClick={() => openCapture(t)}>
                              📸 Subir MatriSure
                            </button>
                          )}
                          {t.start_photo_url && (
                            <button className="btn-secondary btn-sm" onClick={() => setViewingPhoto(t.start_photo_url)}>📷 Inicio</button>
                          )}
                          {t.end_photo_url && (
                            <button className="btn-secondary btn-sm" onClick={() => setViewingPhoto(t.end_photo_url)}>📷 Fin</button>
                          )}
                          <button className="btn-secondary btn-sm" onClick={() => openHistory(t.cold_rooms?.name)}>
                            🕒 Historial
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
