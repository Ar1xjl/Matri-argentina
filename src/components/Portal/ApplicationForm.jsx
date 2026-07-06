import { useState } from 'react'

// Simplified to what the real `treatments` schema actually persists today.
// Generator selection is intentionally left out — Generators.jsx is still
// mock data (no real generator rows exist yet to choose from). Maturity
// parameters (firmness/brix/IEC) aren't modeled on Treatment yet either —
// see the Treatment Evaluation feature idea on hold, per project memory.
// "YYYY-MM-DDTHH:MM" in local time, for pre-filling <input type="datetime-local">
function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function ApplicationForm({ treatment, operatorName, onSave, onCancel }) {
  const [startTime, setStartTime] = useState(nowLocal())
  const [endTime,   setEndTime]   = useState('')
  const [saving,    setSaving]    = useState(false)

  const card  = {background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'24px', marginBottom:'16px'}
  const label = {display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}
  const inp   = {width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8', fontFamily:'inherit'}

  const handleSave = async () => {
    setSaving(true)
    await onSave({ startTime, endTime })
    setSaving(false)
  }

  return (
    <div style={{maxWidth:'600px'}}>

      {treatment && (
        <div className="alert info">
          📋 Registrando aplicación para <strong>{treatment.cold_rooms?.name}</strong> · {treatment.product === 'powder' ? 'MatriPowder' : 'MatriTablets'} · Tratamiento #{treatment.id.slice(0,8)}
        </div>
      )}

      <div style={card}>
        <div style={{fontSize:'15px', fontWeight:700, color:'#0b4358', marginBottom:'16px'}}>
          Datos del tratamiento
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={label}>Dosis (ppb)</label>
          <input style={{...inp, background:'#f0f0ec', color:'#888'}} value={treatment?.target_dose_ppb ?? ''} disabled/>
          <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>
            Definida en la calculadora al crear el tratamiento.
          </div>
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={label}>Operario</label>
          <input style={{...inp, background:'#f0f0ec', color:'#888'}} value={operatorName || ''} disabled/>
          <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>
            Vos, como usuario que registra la aplicación.
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px'}}>
          <div>
            <label style={label}>Fecha y hora de inicio</label>
            <input style={inp} type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}/>
          </div>
          <div>
            <label style={label}>Fecha y hora de fin</label>
            <input style={inp} type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)}/>
          </div>
        </div>
        <div style={{fontSize:'11px', color:'#888', marginTop:'6px'}}>
          Incluí la fecha de cada horario — muchos tratamientos empiezan a la tarde y terminan al día siguiente.
        </div>

        <div style={{fontSize:'11px', color:'#b06a00', marginTop:'12px'}}>
          ⚠️ Selección de generador todavía no disponible — la gestión real de generadores está pendiente.
        </div>
      </div>

      <div style={{display:'flex', gap:'10px'}}>
        <button className="btn-primary" style={{flex:1, opacity: saving ? .6 : 1}} onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar registro de aplicación'}
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
