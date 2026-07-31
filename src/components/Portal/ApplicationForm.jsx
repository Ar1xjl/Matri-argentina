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

// mode='start': just the Inicio time, shown when the operator places the kit
// in the Cold Room. mode='end': just the Fin time, shown separately later —
// often 12-30h afterward — when they come back to close out the
// application. A single combined start+end form doesn't match how long a
// real application actually takes (Juan, 2026-07-31).
export default function ApplicationForm({ treatment, operatorName, mode, onSave, onCancel }) {
  const [time,   setTime]   = useState(nowLocal())
  const [saving, setSaving] = useState(false)

  const card  = {background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'24px', marginBottom:'16px'}
  const label = {display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}
  const inp   = {width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8', fontFamily:'inherit'}

  const timeLabel = mode === 'start' ? 'Fecha y hora de inicio' : 'Fecha y hora de fin'
  const heading   = mode === 'start' ? 'Iniciar aplicación' : 'Finalizar aplicación'

  const handleSave = async () => {
    setSaving(true)
    await onSave(mode === 'start' ? { startTime: time } : { endTime: time })
    setSaving(false)
  }

  return (
    <div style={{maxWidth:'600px'}}>

      {treatment && (
        <div className="alert info">
          📋 {heading} para <strong>{treatment.cold_rooms?.name}</strong> · {treatment.product === 'powder' ? 'MatriPowder' : 'MatriTablets'} · Tratamiento #{treatment.id.slice(0,8)}
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

        <div>
          <label style={label}>{timeLabel}</label>
          <input style={inp} type="datetime-local" value={time} onChange={e => setTime(e.target.value)}/>
        </div>

        {mode === 'start' && (
          <div style={{fontSize:'11px', color:'#b06a00', marginTop:'12px'}}>
            ⚠️ Selección de generador todavía no disponible — la gestión real de generadores está pendiente.
          </div>
        )}
      </div>

      <div style={{display:'flex', gap:'10px'}}>
        <button className="btn-primary" style={{flex:1, opacity: saving ? .6 : 1}} onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Continuar a la foto'}
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
