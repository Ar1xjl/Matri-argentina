import { useState } from 'react'

const HISTORY_DATA = [
  { date:'20 jun 2026', season:'2026', crop:'Manzana Fuji',   ppb:1000, operator:'J. Rodríguez', generator:'GEN-012', sureStatus:'confirmed', surePhoto:true },
  { date:'12 jun 2026', season:'2026', crop:'Pera Williams',  ppb:950,  operator:'J. Rodríguez', generator:'GEN-012', sureStatus:'confirmed', surePhoto:true },
  { date:'15 mar 2026', season:'2026', crop:'Pera Packham',   ppb:900,  operator:'M. García',    generator:'GEN-013', sureStatus:'confirmed', surePhoto:true },
  { date:'02 dic 2025', season:'2025', crop:'Manzana Gala',   ppb:1000, operator:'J. Rodríguez', generator:'GEN-012', sureStatus:'confirmed', surePhoto:true },
  { date:'18 nov 2025', season:'2025', crop:'Pera Williams',  ppb:1000, operator:'M. García',    generator:'GEN-011', sureStatus:'pending',   surePhoto:false },
  { date:'05 ago 2025', season:'2025', crop:'Manzana Fuji',   ppb:920,  operator:'J. Rodríguez', generator:'GEN-012', sureStatus:'confirmed', surePhoto:true },
]

const SEASONS = ['Todas', '2026', '2025']

export default function RoomHistory({ roomName, onClose }) {
  const [season, setSeason] = useState('Todas')

  const filtered = season === 'Todas'
    ? HISTORY_DATA
    : HISTORY_DATA.filter(h => h.season === season)

  const avgPpb = Math.round(filtered.reduce((s,h) => s + h.ppb, 0) / filtered.length)

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px'}}>
        <div>
          <div style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>
            Historial de tratamientos — {roomName}
          </div>
          <div style={{fontSize:'12px', color:'#888', marginTop:'2px'}}>
            {filtered.length} tratamientos · Dosis promedio: {avgPpb} ppb
          </div>
        </div>
        {onClose && (
          <button className="btn-secondary btn-sm" onClick={onClose}>✕ Cerrar</button>
        )}
      </div>

      {/* Season filter + export */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px'}}>
        <div style={{display:'flex', gap:'6px'}}>
          {SEASONS.map(s => (
            <button
              key={s}
              onClick={() => setSeason(s)}
              style={{
                background: season === s ? '#0b4358' : '#f5f5ee',
                color: season === s ? '#fff' : '#0b4358',
                border:'none', borderRadius:'7px', padding:'7px 14px',
                fontSize:'12px', fontWeight:600, cursor:'pointer'
              }}
            >{s === 'Todas' ? 'Todas las temporadas' : `Temporada ${s}`}</button>
          ))}
        </div>
        <div style={{display:'flex', gap:'8px'}}>
          <button className="btn-secondary btn-sm">📄 Exportar PDF</button>
          <button className="btn-secondary btn-sm">📊 Exportar Excel</button>
        </div>
      </div>

      {/* Timeline */}
      <div className="card" style={{marginBottom:0}}>
        <div style={{padding:0}} className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th><th>Fruta / variedad</th><th>Dosis</th>
                <th>Operario</th><th>Generador</th><th>MatriSure</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h,i) => (
                <tr key={i}>
                  <td style={{color:'#6b6b6b'}}>{h.date}</td>
                  <td style={{fontWeight:600}}>{h.crop}</td>
                  <td style={{fontWeight:700}}>{h.ppb} ppb</td>
                  <td>{h.operator}</td>
                  <td style={{fontFamily:'monospace', fontSize:'12px'}}>{h.generator}</td>
                  <td>
                    <span className={`status ${h.sureStatus}`}>
                      {h.sureStatus === 'confirmed' ? '📸 Confirmado' : '⏳ Pendiente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div style={{textAlign:'center', padding:'40px', color:'#888', fontSize:'13px'}}>
          No hay tratamientos registrados para esta temporada.
        </div>
      )}
    </div>
  )
}