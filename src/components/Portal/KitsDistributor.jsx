import { useState, useEffect, Fragment } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { fetchAllRows } from '../../lib/fetchAll'

// Fase K-1c (2026-08-11) — the Distribuidor's side of MatriSure Kit
// stewardship: stock that Global released shows up here directly (no
// separate "confirm receipt" step, DOMAIN_MODEL.md Rule 49), and Manager
// assigns specific units to one of their own Aplicadores, gated by the same
// 5-item QA checklist as the Treatment Dispatch Checklist. See project
// memory "matri-kit-stewardship-integration" for the full design.

const CHECKLIST_ITEMS = [
  { key: 'training_completed',         label: 'Protocolo y capacitación en manejo de calidad de MatriSure realizada.' },
  { key: 'kept_vacuum_sealed',         label: 'El kit se mantuvo en su envoltorio plástico sellado al vacío hasta el momento de uso.' },
  { key: 'refrigerated_2_6c',          label: 'Almacenamiento refrigerado in situ a 2–6°C.' },
  { key: 'lot_age_verified',           label: 'Verifiqué que el lote no supera los 30 días de antigüedad.' },
  { key: 'followed_card_instructions', label: 'Se siguieron las instrucciones de la tarjeta MatriSure.' },
]
const EMPTY_CHECKLIST = Object.fromEntries(CHECKLIST_ITEMS.map(i => [i.key, false]))

const STATUS_LABEL = { assigned: 'Asignado', used: 'Usado', destroyed: 'Destruido' }

function rolesOf(m) { return (m?.user_roles || []).map(r => r.role) }

export default function KitsDistributor({ profile }) {
  const [units, setUnits] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState(new Set())
  const [assignQty, setAssignQty] = useState('')
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [targetApplicatorId, setTargetApplicatorId] = useState('')
  const [checklist, setChecklist] = useState(EMPTY_CHECKLIST)
  const [assignError, setAssignError] = useState('')
  const [assignSaving, setAssignSaving] = useState(false)

  // Fase K-2e (2026-08-11) — Juan asked for a quality-control/destroy path
  // at receipt: a kit that arrives damaged shouldn't just sit in "Sin
  // asignar" forever with no way out. Doesn't reinstate the separate
  // "confirm receipt" step Juan deliberately dropped in K-1 — units still
  // show up as stock automatically, this only adds an escape hatch for a
  // bad one.
  const [destroyingId, setDestroyingId] = useState(null)
  const [destroyReason, setDestroyReason] = useState('')
  const [destroySaving, setDestroySaving] = useState(false)
  const [destroyError, setDestroyError] = useState('')

  const orgId = profile?.org_id

  // kit_units goes through fetchAllRows, not a bare .select() — scoped to
  // one Distributor's own org here, so lower risk than Global's system-wide
  // read, but a real Distributor accumulates one row per physical kit over
  // time too. See src/lib/fetchAll.js.
  const reload = async () => {
    const [{ data: unitsData }, { data: membersData }] = await Promise.all([
      fetchAllRows(() => supabase.from('kit_units').select('*').eq('org_id', orgId).order('created_at', { ascending: true })),
      supabase.from('profiles').select('*, user_roles(role)').eq('org_id', orgId),
    ])
    setUnits(unitsData || [])
    setMembers(membersData || [])
    setLoading(false)
  }

  // Inlined (not calling reload()) to avoid react-hooks/set-state-in-effect
  // — reload() itself stays standalone for the assign handler to call after.
  useEffect(() => {
    if (!orgId) return
    Promise.all([
      fetchAllRows(() => supabase.from('kit_units').select('*').eq('org_id', orgId).order('created_at', { ascending: true })),
      supabase.from('profiles').select('*, user_roles(role)').eq('org_id', orgId),
    ]).then(([{ data: unitsData }, { data: membersData }]) => {
      setUnits(unitsData || [])
      setMembers(membersData || [])
      setLoading(false)
    })
  }, [orgId])

  const applicators = members.filter(m => rolesOf(m).includes('operator')).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
  const applicatorById = new Map(members.map(m => [m.id, m]))
  // Oldest-received first — same FIFO principle as Global's release screen.
  const unassigned = units.filter(u => u.status === 'released')
  const assignedOrBeyond = units.filter(u => u.status !== 'released')

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const allUnassignedSelected = unassigned.length > 0 && unassigned.every(u => selected.has(u.id))
  const toggleSelectAll = () => setSelected(allUnassignedSelected ? new Set() : new Set(unassigned.map(u => u.id)))
  const selectFifo = () => {
    const n = Number(assignQty)
    if (!n || n < 1) return
    setSelected(new Set(unassigned.slice(0, n).map(u => u.id)))
  }

  const checklistComplete = CHECKLIST_ITEMS.every(i => checklist[i.key])
  const toggleChecklistItem = (key) => setChecklist(prev => ({ ...prev, [key]: !prev[key] }))

  const openAssignForm = () => {
    setChecklist(EMPTY_CHECKLIST)
    setTargetApplicatorId('')
    setAssignError('')
    setShowAssignForm(true)
  }

  const handleAssign = async () => {
    setAssignError('')
    if (selected.size === 0) { setAssignError('Elegí al menos un kit para asignar.'); return }
    if (!targetApplicatorId) { setAssignError('Elegí a qué Aplicador se lo asignás.'); return }
    if (!checklistComplete) { setAssignError('Completá el checklist antes de asignar.'); return }
    setAssignSaving(true)

    const { error } = await supabase.rpc('assign_kit_units', {
      p_unit_ids: [...selected],
      p_applicator_profile_id: targetApplicatorId,
      p_checklist_training_completed: checklist.training_completed,
      p_checklist_kept_vacuum_sealed: checklist.kept_vacuum_sealed,
      p_checklist_refrigerated_2_6c: checklist.refrigerated_2_6c,
      p_checklist_lot_age_verified: checklist.lot_age_verified,
      p_checklist_followed_card_instructions: checklist.followed_card_instructions,
    })

    setAssignSaving(false)
    if (error) { setAssignError(error.message); return }
    setSelected(new Set())
    setAssignQty('')
    setShowAssignForm(false)
    await reload()
  }

  const openDestroy = (unitId) => { setDestroyingId(unitId); setDestroyReason(''); setDestroyError('') }
  const confirmDestroy = async () => {
    if (!destroyReason.trim()) { setDestroyError('Contá brevemente qué encontraste mal con el kit.'); return }
    setDestroySaving(true)
    setDestroyError('')
    const { error } = await supabase.from('kit_units').update({
      status: 'destroyed',
      destroyed_at: new Date().toISOString(),
      destroyed_by: profile.id,
      destroyed_reason: destroyReason.trim(),
    }).eq('id', destroyingId)
    setDestroySaving(false)
    if (error) { setDestroyError(error.message); return }
    setDestroyingId(null)
    setSelected(prev => { const next = new Set(prev); next.delete(destroyingId); return next })
    await reload()
  }

  if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>Cargando…</div>

  return (
    <div>
      <div className="alert info" style={{marginBottom:'16px'}}>
        🧪 Los kits que FreshInset te libera aparecen acá directamente como tu stock — sin ningún paso de confirmación aparte. Asignalos a un Aplicador cuando estén listos para usarse, o descartalos si llegan en mal estado.
      </div>

      {/* Fase K-2e (2026-08-11) — same stat-card style as the rest of the portal's dashboards */}
      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'16px'}}>
        {[
          { icon:'📦', label:'Sin asignar', value: unassigned.length, bg:'#e8f4fc' },
          { icon:'👷', label:'Asignados',   value: units.filter(u => u.status === 'assigned').length,  bg:'#eaf7ee' },
          { icon:'📸', label:'Usados',      value: units.filter(u => u.status === 'used').length,      bg:'#f0f7e0' },
          { icon:'🗑️', label:'Descartados', value: units.filter(u => u.status === 'destroyed').length, bg:'#fdeaea' },
        ].map((s,i) => (
          <div key={i} style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'18px', position:'relative', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
            <div style={{position:'absolute', top:0, left:0, right:0, height:'3px', background:'#b5cc2e'}}/>
            <div style={{position:'absolute', right:'14px', top:'16px', width:'36px', height:'36px', borderRadius:'8px', background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px'}}>{s.icon}</div>
            <div style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'6px'}}>{s.label}</div>
            <div style={{fontSize:'26px', fontWeight:800, color:'#0b4358', lineHeight:1}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Unassigned stock */}
      <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)', marginBottom:'16px'}}>
        <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Sin asignar — {unassigned.length} kit{unassigned.length === 1 ? '' : 's'}</span>
        </div>

        {unassigned.length === 0 ? (
          <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>
            No tenés kits sin asignar todavía — van a aparecer acá cuando FreshInset te libere un lote.
          </div>
        ) : (
          <>
            <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5', display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'center'}}>
              <input type="number" min="1" max={unassigned.length} value={assignQty} onChange={e => setAssignQty(e.target.value)}
                placeholder="Cantidad" style={{padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'13px', width:'90px'}}/>
              <button className="btn-secondary btn-sm" disabled={!assignQty} onClick={selectFifo}>
                Seleccionar los más antiguos
              </button>
              <button className="btn-lime btn-sm" disabled={selected.size === 0} onClick={openAssignForm}>
                Asignar a Aplicador ({selected.size})
              </button>
              {applicators.length === 0 && <span style={{fontSize:'11px', color:'#b06a00'}}>Todavía no tenés ningún Aplicador dado de alta en Usuarios.</span>}
            </div>

            {/* Assign form — right under the toolbar so it's never hidden below a long table */}
            {showAssignForm && (
              <div style={{borderBottom:'0.5px solid #ddddd5', background:'#f0f7ff'}}>
                <div style={{padding:'14px 20px 0'}}>
                  <span style={{fontSize:'14px', fontWeight:700, color:'#0b4358'}}>Asignar {selected.size} kit{selected.size === 1 ? '' : 's'} a un Aplicador</span>
                </div>

                {assignError && <div style={{margin:'10px 20px 0', padding:'8px 12px', color:'#8b2020', fontSize:'12px', background:'#fdeaea', borderRadius:'6px'}}>⚠️ {assignError}</div>}

                <div style={{padding:'14px 20px 0'}}>
                  <label style={{display:'block', fontSize:'11px', color:'#888', marginBottom:'4px'}}>Aplicador</label>
                  <select value={targetApplicatorId} onChange={e => setTargetApplicatorId(e.target.value)}
                    style={{padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'13px', minWidth:'240px'}}>
                    <option value="">Elegir…</option>
                    {applicators.map(a => <option key={a.id} value={a.id}>{a.full_name || a.id}</option>)}
                  </select>
                </div>

                <div style={{padding:'14px 20px'}}>
                  <div style={{fontSize:'11px', fontWeight:700, color:'#0b4358', marginBottom:'10px', textTransform:'uppercase'}}>
                    Checklist previo a la entrega
                  </div>
                  {CHECKLIST_ITEMS.map(i => (
                    <label key={i.key} style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'#0b4358', marginBottom:'8px', cursor:'pointer'}}>
                      <input type="checkbox" checked={checklist[i.key]} onChange={() => toggleChecklistItem(i.key)}/>
                      {i.label}
                    </label>
                  ))}
                  <div style={{display:'flex', gap:'8px', marginTop:'6px'}}>
                    <button className="btn-primary btn-sm" disabled={assignSaving || !checklistComplete || !targetApplicatorId} onClick={handleAssign} style={{opacity: (!checklistComplete || !targetApplicatorId) ? .5 : 1}}>
                      {assignSaving ? 'Asignando…' : 'Confirmar asignación'}
                    </button>
                    <button className="btn-secondary btn-sm" onClick={() => setShowAssignForm(false)}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}

            <div className="table-scroll"><table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
              <thead>
                <tr>
                  <th style={{padding:'10px 16px', background:'#f5f5ee', borderBottom:'0.5px solid #ddddd5'}}>
                    <input type="checkbox" checked={allUnassignedSelected} onChange={toggleSelectAll}/>
                  </th>
                  {['Tracking', 'Lote', 'Recibido', ''].map(h => (
                    <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unassigned.map(u => (
                  <Fragment key={u.id}>
                  <tr style={{borderBottom:'0.5px solid #ddddd5'}}>
                    <td style={{padding:'10px 16px'}}>
                      <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)}/>
                    </td>
                    <td style={{padding:'10px 16px', fontWeight:700, fontFamily:'monospace'}}>{u.tracking_number}</td>
                    <td style={{padding:'10px 16px', color:'#6b6b6b'}}>{u.lot_number}</td>
                    <td style={{padding:'10px 16px', color:'#6b6b6b'}}>{new Date(u.created_at).toLocaleDateString('es-AR')}</td>
                    <td style={{padding:'10px 16px'}}>
                      <button className="btn-secondary btn-sm" onClick={() => openDestroy(u.id)} title="Descartar por mal estado">🗑️ Descartar</button>
                    </td>
                  </tr>
                  {destroyingId === u.id && (
                    <tr style={{background:'#fdeaea', borderBottom:'0.5px solid #ddddd5'}}>
                      <td colSpan={5} style={{padding:'12px 16px'}}>
                        <div style={{display:'flex', flexWrap:'wrap', gap:'8px', alignItems:'center'}}>
                          <span style={{fontSize:'12px', fontWeight:700, color:'#8b2020'}}>¿Por qué se descarta {u.tracking_number}?</span>
                          <input value={destroyReason} onChange={e => setDestroyReason(e.target.value)} placeholder="Ej: llegó sin sellar al vacío"
                            style={{flex:1, minWidth:'200px', padding:'7px 10px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'13px'}}/>
                          <button className="btn-primary btn-sm" style={{background:'#8b2020'}} disabled={destroySaving} onClick={confirmDestroy}>
                            {destroySaving ? 'Descartando…' : 'Confirmar descarte'}
                          </button>
                          <button className="btn-secondary btn-sm" onClick={() => setDestroyingId(null)}>Cancelar</button>
                          {destroyError && <span style={{fontSize:'11px', color:'#8b2020'}}>⚠️ {destroyError}</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table></div>
          </>
        )}
      </div>

      {/* Already assigned/used/destroyed — oversight */}
      {assignedOrBeyond.length > 0 && (
        <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5'}}>
            <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Asignados / usados / descartados — {assignedOrBeyond.length} kit{assignedOrBeyond.length === 1 ? '' : 's'}</span>
          </div>
          <div className="table-scroll"><table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
            <thead>
              <tr>
                {['Tracking', 'Lote', 'Aplicador', 'Estado'].map(h => (
                  <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignedOrBeyond.map(u => (
                <tr key={u.id} style={{borderBottom:'0.5px solid #ddddd5'}}>
                  <td style={{padding:'10px 16px', fontWeight:700, fontFamily:'monospace'}}>{u.tracking_number}</td>
                  <td style={{padding:'10px 16px', color:'#6b6b6b'}}>{u.lot_number}</td>
                  <td style={{padding:'10px 16px'}}>{applicatorById.get(u.assigned_to_profile_id)?.full_name || '—'}</td>
                  <td style={{padding:'10px 16px'}}>{STATUS_LABEL[u.status] || u.status}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}
