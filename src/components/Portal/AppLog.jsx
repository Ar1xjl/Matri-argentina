import { useState } from 'react'
import sureLogo    from '../../assets/logos/MatriSure_Logo.png'
import sureImg     from '../../assets/images/MatriSure_Kit.png'
import ApplicationForm from './ApplicationForm'
import RoomHistory from './RoomHistory'

const LOGS = [
  { room:'Cámara Norte 1', product:'MatriPowder',  logo:'powder',  dose:'250g', date:'20 jun 2026', operator:'J. Rodríguez', gen:'GEN-012', status:'confirmed', slabel:'📸 Confirmado' },
  { room:'Cámara Norte 2', product:'MatriPowder',  logo:'powder',  dose:'310g', date:'12 jun 2026', operator:'J. Rodríguez', gen:'GEN-012', status:'confirmed', slabel:'📸 Confirmado' },
  { room:'Frigorífico A',  product:'MatriTablets', logo:'tablets', dose:'120g', date:'15 jun 2026', operator:'M. García',    gen:'—',       status:'approved',  slabel:'✓ Confirmado' },
  { room:'Cámara Sur 3',   product:'MatriPowder',  logo:'powder',  dose:'180g', date:'—',           operator:'—',           gen:'—',       status:'pending',   slabel:'⏳ Pendiente' },
]

export default function AppLog() {
  const [view, setView] = useState('list') // 'list' | 'form' | 'history'
  const [selectedRoom, setSelectedRoom] = useState(null)

  const openForm = (room) => {
    setSelectedRoom(room)
    setView('form')
  }

  const openHistory = (room) => {
    setSelectedRoom(room)
    setView('history')
  }

  const handleSave = (data) => {
    console.log('Application saved:', data)
    setView('list')
  }

  if (view === 'form') {
    return (
      <ApplicationForm
        order={{ room: selectedRoom, product: 'MatriPowder', id: 'ARG-0040', ppb: 1000 }}
        onSave={handleSave}
        onCancel={() => setView('list')}
      />
    )
  }

  if (view === 'history') {
    return (
      <RoomHistory
        roomName={selectedRoom}
        onClose={() => setView('list')}
      />
    )
  }

  return (
    <div>
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
          <span style={{fontSize:'12px', color:'var(--gray)'}}>Temporada 2026</span>
        </div>
        <div style={{padding:0}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Cámara</th><th>Producto</th><th>Dosis</th>
                <th>Fecha aplicación</th><th>Operario</th>
                <th>Generador</th><th>MatriSure</th><th></th>
              </tr>
            </thead>
            <tbody>
              {LOGS.map((l,i) => (
                <tr key={i}>
                  <td style={{fontWeight:600}}>{l.room}</td>
                  <td>
                    <span style={{
                      background: l.logo === 'powder' ? '#eef4c0' : '#e1f5ee',
                      color: l.logo === 'powder' ? '#4a6010' : '#0d7a5f',
                      fontSize:'11px', fontWeight:700, padding:'3px 10px',
                      borderRadius:'100px'
                    }}>{l.product}</span>
                  </td>
                  <td>{l.dose}</td>
                  <td style={{color:'var(--gray)'}}>{l.date}</td>
                  <td style={{color:'var(--gray)'}}>{l.operator}</td>
                  <td style={{fontFamily:'monospace', fontSize:'12px'}}>{l.gen}</td>
                  <td><span className={`status ${l.status}`}>{l.slabel}</span></td>
                  <td>
                    <div style={{display:'flex', gap:'6px'}}>
                      {l.status === 'pending' && (
                        <button className="btn-lime btn-sm" onClick={() => openForm(l.room)}>
                          📝 Registrar
                        </button>
                      )}
                      <button className="btn-secondary btn-sm" onClick={() => openHistory(l.room)}>
                        🕒 Historial
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}