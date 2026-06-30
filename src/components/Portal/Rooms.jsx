import { useState } from 'react'
import RoomHistory from './RoomHistory'

const ROOMS_DATA = [
  { id:1, name:'Cámara Norte 1', location:'Est. San José',  vol:500, crop:'Manzana Fuji',   date:'20 jun 2026', status:'approved',  slabel:'Activa' },
  { id:2, name:'Cámara Norte 2', location:'Est. San José',  vol:620, crop:'Pera Williams',  date:'12 jun 2026', status:'confirmed', slabel:'MatriSure OK' },
  { id:3, name:'Cámara Sur 3',   location:'Bodega Norte',   vol:360, crop:'Pera Packham',   date:'18 jun 2026', status:'pending',   slabel:'Pendiente' },
  { id:4, name:'Frigorífico A',  location:'Bodega Norte',   vol:240, crop:'Kiwi Hayward',   date:'15 jun 2026', status:'approved',  slabel:'Activa' },
]

export default function Rooms() {
  const [showForm, setShowForm] = useState(false)
  const [historyRoom, setHistoryRoom] = useState(null)

  if (historyRoom) {
    return (
      <RoomHistory
        roomName={historyRoom}
        onClose={() => setHistoryRoom(null)}
      />
    )
  }

  return (
    <div>
      <div className="alert info">
        ℹ️ Las cámaras se guardan automáticamente con el primer pedido, o podés agregarlas manualmente.
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Ubicaciones y cámaras</span>
          <button className="btn-lime btn-sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Cancelar' : '+ Nueva cámara'}
          </button>
        </div>

        {showForm && (
          <div style={{padding:'20px', borderBottom:'1px solid var(--border)', background:'var(--gray-lt)'}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px'}}>
              <div className="form-field">
                <label>Nombre de la cámara</label>
                <input placeholder="Ej: Cámara Norte 3"/>
              </div>
              <div className="form-field">
                <label>Ubicación / establecimiento</label>
                <input placeholder="Ej: Est. San José"/>
              </div>
              <div className="form-field">
                <label>Volumen (m³)</label>
                <input type="number" placeholder="Ej: 450"/>
              </div>
              <div className="form-field">
                <label>Cultivo principal</label>
                <select>
                  <option>Manzanas</option>
                  <option>Peras</option>
                  <option>Kiwi</option>
                  <option>Otro</option>
                </select>
              </div>
              <div className="form-field">
                <label>Variedad</label>
                <input placeholder="Ej: Fuji, Williams, Hayward"/>
              </div>
              <div className="form-field" style={{display:'flex', alignItems:'flex-end'}}>
                <button className="btn-primary" style={{width:'100%'}}>Guardar cámara</button>
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
              {ROOMS_DATA.map(r => (
                <tr key={r.id}>
                  <td style={{fontWeight:700}}>{r.name}</td>
                  <td style={{color:'var(--gray)'}}>{r.location}</td>
                  <td>{r.vol} m³</td>
                  <td>{r.crop}</td>
                  <td style={{color:'var(--gray)'}}>{r.date}</td>
                  <td><span className={`status ${r.status}`}>{r.slabel}</span></td>
                  <td>
                    <div style={{display:'flex', gap:'6px'}}>
                      <button className="btn-secondary btn-sm">Pedir</button>
                      <button className="btn-secondary btn-sm" onClick={() => setHistoryRoom(r.name)}>
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