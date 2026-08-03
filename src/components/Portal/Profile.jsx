import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function Profile({ profile }) {
  const orgId = profile?.org_id
  const [loading, setLoading] = useState(true)
  const [orgName, setOrgName] = useState('')
  const [form, setForm] = useState({ tax_id: '', tax_status: '', region: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!orgId) return
    supabase.from('organizations').select('name, tax_id, tax_status, region').eq('id', orgId).single().then(({ data }) => {
      if (data) {
        setOrgName(data.name || '')
        setForm({ tax_id: data.tax_id || '', tax_status: data.tax_status || '', region: data.region || '' })
      }
      setLoading(false)
    })
  }, [orgId])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase.from('organizations').update({
      tax_id: form.tax_id.trim() || null,
      tax_status: form.tax_status.trim() || null,
      region: form.region.trim() || null,
    }).eq('id', orgId)
    setSaving(false)
    if (!error) setSaved(true)
  }

  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>

      {/* Company data — CUIT/Situación Fiscal/Región ya no se piden en el alta
          pública (varían por país); el propio dueño de la cuenta los completa
          acá, en texto libre, una vez que su organización ya existe. */}
      <div className="card" style={{marginBottom:0}}>
        <div className="card-header"><span className="card-title">Datos de la empresa</span></div>
        <div className="card-body">
          {loading ? (
            <div style={{padding:'12px 0', color:'#888', fontSize:'13px'}}>Cargando…</div>
          ) : (
            <>
              <div className="form-field">
                <label>Razón Social</label>
                <input defaultValue={orgName} readOnly style={{background:'var(--gray-lt)', color:'var(--gray)'}} />
              </div>
              {[
                ['CUIT', 'tax_id', 'Ej: 30-XXXXXXXX-X'],
                ['Situación Fiscal', 'tax_status', 'Ej: Responsable Inscripto'],
                ['Provincia / Región', 'region', 'Ej: Río Negro'],
              ].map(([label, key, placeholder]) => (
                <div key={key} className="form-field">
                  <label>{label}</label>
                  <input
                    value={form[key]}
                    placeholder={placeholder}
                    onChange={e => { setForm({ ...form, [key]: e.target.value }); setSaved(false) }}
                  />
                </div>
              ))}
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              {saved && <div style={{fontSize:'12px', color:'#1a6b30', marginTop:'8px'}}>✓ Guardado</div>}
            </>
          )}
        </div>
      </div>

      {/* Password */}
      <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-header"><span className="card-title">Cambiar contraseña</span></div>
          <div className="card-body">
            {[
              ['Contraseña actual',   'password', '••••••••'],
              ['Nueva contraseña',    'password', '••••••••'],
              ['Confirmar contraseña','password', '••••••••'],
            ].map(([label, type, ph]) => (
              <div key={label} className="form-field">
                <label>{label}</label>
                <input type={type} placeholder={ph}/>
              </div>
            ))}
            <button className="btn-primary">Actualizar contraseña</button>
          </div>
        </div>

        <div className="alert info">
          ℹ️ Si olvidaste tu contraseña, contactá a tu distribuidor para recibir una contraseña temporal. Tu sesión se cierra automáticamente a los 10 minutos de inactividad.
        </div>

        {/* Account info */}
        <div className="card" style={{marginBottom:0}}>
          <div className="card-header"><span className="card-title">Información de cuenta</span></div>
          <div className="card-body">
            {[
              ['Distribuidor asignado', 'Wassington'],
              ['Región',               'Río Negro, Argentina'],
              ['Miembro desde',        'Junio 2026'],
              ['Último acceso',        'Hoy, 11:30 hs'],
            ].map(([label, value]) => (
              <div key={label} style={{
                display:'flex', justifyContent:'space-between',
                padding:'8px 0', borderBottom:'1px solid var(--border)',
                fontSize:'13px'
              }}>
                <span style={{color:'var(--gray)'}}>{label}</span>
                <span style={{fontWeight:600, color:'var(--navy)'}}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
