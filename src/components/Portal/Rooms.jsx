import { useState } from 'react'
import RoomHistory from './RoomHistory'

const statusLabel = (status) => ({
  approved:  { cls:'approved',  label:'Activa' },
  submitted: { cls:'pending',   label:'Pendiente' },
  applied:   { cls:'pending',   label:'Aplicado' },
  completed: { cls:'confirmed', label:'MatriSure OK' },
  rejected:  { cls:'rejected',  label:'Rechazado' },
  cancelled: { cls:'rejected',  label:'Cancelado' },
}[status] || null)

export default function Rooms({ coldRooms = [], treatments = [], onAddRoom }) {
  const [showForm, setShowForm] = useState(false)
  const [historyRoom, setHistoryRoom] = useState(null)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [volume, setVolume] = useState('')
  const [crop, setCrop] = useState('Manzanas')

  if (historyRoom) {
    return (
      <RoomHistory
        roomName={historyRoom}
        onClose={() => setHistoryRoom(null)}
      />
    )
  }

  // Last treatment per Cold Room, for the "último trat." / estado columns
  const lastTreatmentByRoom = {}
  treatments.forEach(t => {
    const roomId = t.cold_room_id
    if (!roomId) return
    if (!lastTreatmentByRoom[roomId] || new Date(t.created_at) > new Date(lastTreatmentByRoom[roomId].created_at)) {
      lastTreatmentByRoom[roomId] = t
    }
  })

  const handleSave = async () => {
    if (!name || !volume) return
    await onAddRoom({ name, location, volume_m3: Number(volume), primary_crop: crop })
    setName(''); setLocation(''); setVolume(''); setCrop('Manzanas')
    setShowForm(false)
  }

  return (
    <div>
      <div className="alert info">
        ℹ️ Las cámaras se guardan automáticamente con el primer tratamiento, o podés agregarlas manualmente.
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Frigoríficos y Cámaras</span>
          <button className="btn-lime btn-sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Cancelar' : '+ Nueva cámara'}
          </button>
        </div>

        {showForm && (
          <div style={{padding:'20px', borderBottom:'1px solid var(--border)', background:'var(--gray-lt)'}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px'}}>
              <div className="form-field">
                <label>Nombre de la cámara</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Cámara Norte 3"/>
              </div>
              <div className="form-field">
                <label>Ubicación / establecimiento</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ej: Est. San José"/>
              </div>
              <div className="form-field">
                <label>Volumen (m³)</label>
                <input type="number" value={volume} onChange={e => setVolume(e.target.value)} placeholder="Ej: 450"/>
              </div>
              <div className="form-field">
                <label>Cultivo principal</label>
                <select value={crop} onChange={e => setCrop(e.target.value)}>
                  <option>Manzanas</option>
                  <option>Peras</option>
                  <option>Kiwi</option>
                  <option>Otro</option>
                </select>
              </div>
              <div className="form-field" style={{display:'flex', alignItems:'flex-end'}}>
                <button className="btn-primary" style={{width:'100%'}} onClick={handleSave}>Guardar cámara</button>
              </div>
            </div>
          </div>
        )}

        <div style={{padding:0}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Cámara</th><th>Ubicación</th><th>Volumen (m³)</th>
                <th>Cultivo</th><th>Último trat.</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {coldRooms.map(r => {
                const last = lastTreatmentByRoom[r.id]
                const s = last ? statusLabel(last.status) : null
                return (
                  <tr key={r.id}>
                    <td style={{fontWeight:700}}>{r.name}</td>
                    <td style={{color:'var(--gray)'}}>{r.location || '—'}</td>
                    <td>{r.volume_m3} m³</td>
                    <td>{r.primary_crop || '—'}</td>
                    <td style={{color:'var(--gray)'}}>{last ? new Date(last.created_at).toLocaleDateString('es-AR') : '—'}</td>
                    <td>{s ? <span className={`status ${s.cls}`}>{s.label}</span> : '—'}</td>
                    <td>
                      <div style={{display:'flex', gap:'6px'}}>
                        <button className="btn-secondary btn-sm" onClick={() => setHistoryRoom(r.name)}>
                          🕒 Historial
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
