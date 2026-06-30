import { useState } from 'react'

const GENERATORS = ['GEN-012', 'GEN-013', 'GEN-014', 'Otro / sin generador']

export default function ApplicationForm({ order, onSave, onCancel }) {
  // Heredados de la orden / calculadora — editables
  const [ppb,       setPpb]       = useState(order?.ppb || '1000')
  const [operator,  setOperator]  = useState('')
  const [generator, setGenerator] = useState(GENERATORS[0])
  const [startTime, setStartTime] = useState('')
  const [endTime,   setEndTime]   = useState('')

  // Opcionales
  const [showOptional, setShowOptional] = useState(false)
  const [temp,      setTemp]      = useState('')
  const [firmness,  setFirmness]  = useState(order?.firmness || '')
  const [brix,      setBrix]      = useState(order?.brix || '')
  const [iec,       setIec]       = useState(order?.iec || '')
  const [cert,      setCert]      = useState('')

  const card = {background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'24px', marginBottom:'16px'}
  const label = {display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}
  const inp = {width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8', fontFamily:'inherit'}

  const handleSave = () => {
    onSave({
      ppb, operator, generator, startTime, endTime,
      temp: temp || null,
      firmness: firmness || null,
      brix: brix || null,
      iec: iec || null,
      cert: cert || null,
      date: new Date().toLocaleDateString('es-AR'),
    })
  }

  return (
    <div style={{maxWidth:'600px'}}>

      {order && (
        <div className="alert info">
          📋 Registrando aplicación para <strong>{order.room}</strong> · {order.product} · Pedido #{order.id}
        </div>
      )}

      {/* Required fields */}
      <div style={card}>
        <div style={{fontSize:'15px', fontWeight:700, color:'#0b4358', marginBottom:'16px'}}>
          Datos del tratamiento
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={label}>Dosis aplicada (ppb)</label>
          <input style={inp} type="number" value={ppb} onChange={e => setPpb(e.target.value)}/>
          <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>
            Heredada de la calculadora — podés ajustarla si difiere de lo planificado.
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'16px'}}>
          <div>
            <label style={label}>Operario</label>
            <input style={inp} type="text" value={operator} onChange={e => setOperator(e.target.value)} placeholder="Nombre y apellido"/>
          </div>
          <div>
            <label style={label}>Generador utilizado</label>
            <select style={inp} value={generator} onChange={e => setGenerator(e.target.value)}>
              {GENERATORS.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px'}}>
          <div>
            <label style={label}>Horario de inicio</label>
            <input style={inp} type="time" value={startTime} onChange={e => setStartTime(e.target.value)}/>
          </div>
          <div>
            <label style={label}>Horario de fin</label>
            <input style={inp} type="time" value={endTime} onChange={e => setEndTime(e.target.value)}/>
          </div>
        </div>
      </div>

      {/* Optional toggle */}
      <div style={card}>
        <div
          onClick={() => setShowOptional(!showOptional)}
          style={{display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer'}}
        >
          <div>
            <div style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Datos adicionales (opcional)</div>
            <div style={{fontSize:'12px', color:'#888', marginTop:'2px'}}>
              Temperatura de cámara y parámetros de madurez de la fruta
            </div>
          </div>
          <span style={{fontSize:'20px', color:'#0b4358'}}>{showOptional ? '−' : '+'}</span>
        </div>

        {showOptional && (
          <div style={{marginTop:'20px', paddingTop:'20px', borderTop:'0.5px solid #e0e0d8'}}>
            <div style={{marginBottom:'16px'}}>
              <label style={label}>Temperatura de cámara (°C)</label>
              <input style={inp} type="number" value={temp} onChange={e => setTemp(e.target.value)} placeholder="Ej: 1"/>
            </div>

            <div style={{fontSize:'12px', fontWeight:700, color:'#0b4358', marginBottom:'10px', marginTop:'20px'}}>
              Parámetros de madurez de la fruta
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'16px'}}>
              <div>
                <label style={label}>Firmness (lbf)</label>
                <input style={inp} type="number" value={firmness} onChange={e => setFirmness(e.target.value)} placeholder="12.0"/>
              </div>
              <div>
                <label style={label}>Brix (°)</label>
                <input style={inp} type="number" value={brix} onChange={e => setBrix(e.target.value)} placeholder="12.0"/>
              </div>
              <div>
                <label style={label}>IEC (µL/L)</label>
                <input style={inp} type="number" value={iec} onChange={e => setIec(e.target.value)} placeholder="0.05" step="0.01"/>
              </div>
            </div>
            {(order?.firmness || order?.brix || order?.iec) && (
              <div style={{fontSize:'11px', color:'#3b6d11', marginBottom:'16px'}}>
                ✓ Valores heredados de DoseRight — podés ajustarlos si cambiaron.
              </div>
            )}

            <div style={{marginTop:'16px'}}>
              <label style={label}>Certificación de la partida (opcional)</label>
              <select style={inp} value={cert} onChange={e => setCert(e.target.value)}>
                <option value="">Sin especificar</option>
                <option value="globalgap">GlobalGAP</option>
                <option value="brc">BRC</option>
                <option value="europa">Mercado Europa — requisitos especiales</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div style={{display:'flex', gap:'10px'}}>
        <button className="btn-primary" style={{flex:1}} onClick={handleSave}>
          Guardar registro de aplicación
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}