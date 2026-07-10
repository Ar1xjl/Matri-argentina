import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

const CHECKLIST_ITEMS = [
  ['battery', 'Batería cargada'],
  ['seals',   'Sellos intactos'],
  ['test',    'Test de funcionamiento realizado'],
  ['service', 'Service al día'],
]

const labelStyle = { fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase' }
const inputStyle = { width:'100%', padding:'9px 12px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px' }

// Traspaso a sub-distribuidor: mueve la unidad como stock entre depósitos —
// cambia org_id, sin checklist ni registro de despacho (el nuevo dueño la
// administra como parte de su propia flota, misma lógica que hoy usa Wassington).
// Alquilar / Vender a cliente: ambas piden el mismo checklist previo (entrega
// física real). Alquilar deja org_id sin cambios y crea un generator_dispatches;
// Vender cambia org_id de forma permanente (Rule 29 — arranca historial nuevo,
// no queda registro de despacho).
export default function GeneratorTransferModal({ generator, profile, onClose, onDone }) {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState(null)
  const [targetOrgId, setTargetOrgId] = useState('')
  const [checklist, setChecklist] = useState({ battery: false, seals: false, test: false, service: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('organizations').select('*').neq('id', profile.org_id).order('name').then(({ data, error }) => {
      if (error) { setError(error.message); setLoading(false); return }
      setOrgs(data || [])
      setLoading(false)
    })
  }, [profile.org_id])

  const subdistributors = orgs.filter(o => o.org_type === 'subdistributor')
  const customers = orgs.filter(o => o.org_type === 'customer')

  const MODES = [
    ...(subdistributors.length > 0 ? [{ id: 'subdistributor', label: 'Traspaso a sub-distribuidor' }] : []),
    { id: 'rent', label: 'Alquilar a cliente' },
    { id: 'sell', label: 'Vender a cliente' },
  ]

  const targetOptions = mode === 'subdistributor' ? subdistributors : customers
  const needsChecklist = mode === 'rent' || mode === 'sell'
  const checklistOk = CHECKLIST_ITEMS.every(([key]) => checklist[key])
  const canConfirm = mode && targetOrgId && (!needsChecklist || checklistOk)

  const selectMode = (m) => { setMode(m); setTargetOrgId('') }

  const handleConfirm = async () => {
    setSaving(true)
    setError('')

    if (mode === 'subdistributor') {
      const { error } = await supabase.from('generators').update({ org_id: targetOrgId }).eq('id', generator.id)
      setSaving(false)
      if (error) { setError(error.message); return }
    } else if (mode === 'sell') {
      const { error } = await supabase.from('generators').update({ org_id: targetOrgId, status: 'available' }).eq('id', generator.id)
      setSaving(false)
      if (error) { setError(error.message); return }
    } else {
      const { error: dispatchError } = await supabase.from('generator_dispatches').insert({
        generator_id: generator.id,
        dispatched_to_org_id: targetOrgId,
        dispatched_at: new Date().toISOString(),
        checklist_battery_charged: true,
        checklist_seals_intact: true,
        checklist_test_run_completed: true,
        checklist_service_interval_ok: true,
      })
      if (dispatchError) { setSaving(false); setError(dispatchError.message); return }
      const { error: statusError } = await supabase.from('generators').update({ status: 'on_rent' }).eq('id', generator.id)
      setSaving(false)
      if (statusError) { setError(statusError.message); return }
    }
    onDone()
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{position:'fixed', inset:0, background:'rgba(7,46,61,.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'}}
    >
      <div style={{background:'#fff', borderRadius:'14px', padding:'28px', width:'100%', maxWidth:'460px', boxShadow:'0 8px 32px rgba(11,67,88,.2)'}}>
        <div style={{fontSize:'16px', fontWeight:800, color:'#0b4358', marginBottom:'4px'}}>
          Transferir {generator.unit_code}
        </div>
        <div style={{fontSize:'12px', color:'#888', marginBottom:'18px'}}>
          Elegí qué tipo de traspaso es y a quién.
        </div>

        {loading ? (
          <div style={{padding:'20px', textAlign:'center', color:'#888', fontSize:'13px'}}>Cargando…</div>
        ) : (
          <>
            <div style={{display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px'}}>
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => selectMode(m.id)}
                  style={{
                    textAlign:'left', padding:'10px 14px', borderRadius:'8px', cursor:'pointer',
                    border: mode === m.id ? '1.5px solid #0b4358' : '1.5px solid #dde0d5',
                    background: mode === m.id ? '#e8f4fc' : '#fff',
                    color:'#0b4358', fontSize:'13px', fontWeight:600,
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {mode && (
              <>
                <div style={{marginBottom:'14px'}}>
                  <label style={labelStyle}>{mode === 'subdistributor' ? 'Sub-distribuidor destino' : 'Cliente destino'}</label>
                  <select style={inputStyle} value={targetOrgId} onChange={e => setTargetOrgId(e.target.value)}>
                    <option value="">Elegí uno…</option>
                    {targetOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  {targetOptions.length === 0 && (
                    <div style={{fontSize:'11px', color:'#b06a00', marginTop:'4px'}}>
                      No hay {mode === 'subdistributor' ? 'sub-distribuidores' : 'clientes'} en tu árbol todavía.
                    </div>
                  )}
                </div>

                {needsChecklist && (
                  <div style={{background:'#f5f5ee', borderRadius:'8px', padding:'12px 14px', marginBottom:'16px'}}>
                    <div style={{fontSize:'11px', fontWeight:700, color:'#0b4358', marginBottom:'8px', textTransform:'uppercase'}}>
                      Checklist previo a la entrega
                    </div>
                    {CHECKLIST_ITEMS.map(([key, label]) => (
                      <label key={key} style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'#0b4358', marginBottom:'6px', cursor:'pointer'}}>
                        <input type="checkbox" checked={checklist[key]} onChange={e => setChecklist(prev => ({ ...prev, [key]: e.target.checked }))}/>
                        {label}
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}

            {error && <div style={{color:'#8b2020', fontSize:'12px', marginBottom:'12px'}}>{error}</div>}

            <div style={{display:'flex', gap:'8px'}}>
              <button className="btn-primary" disabled={!canConfirm || saving} onClick={handleConfirm} style={{flex:1, opacity: canConfirm ? 1 : .5}}>
                {saving ? 'Confirmando…' : 'Confirmar traspaso'}
              </button>
              <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
