import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

const ROLES = [
  { id: 'owner',    label: 'Owner',        description: 'Acceso total a su organización y a todo lo que esté debajo en el árbol. Es el único rol que puede administrar usuarios (agregar, sacar, asignar roles). Toda organización necesita al menos un Owner siempre.' },
  { id: 'approver', label: 'Aprobador',    description: 'Revisa, fija el precio final y aprueba o rechaza Tratamientos enviados por las organizaciones debajo de la suya.' },
  { id: 'planner',  label: 'Planificador', description: 'Crea, edita y envía Tratamientos — usa la Calculadora y carga el Plan de Temporada.' },
  { id: 'operator', label: 'Operador',     description: 'Registra la aplicación física del tratamiento y sube la verificación MatriSure.' },
  { id: 'viewer',   label: 'Viewer',       description: 'Solo lectura de Tratamientos e historial — no puede crear ni modificar nada.' },
]

function rolesOf(m) { return (m?.user_roles || []).map(r => r.role) }

export default function Users({ profile }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedRoles, setSelectedRoles] = useState([])
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [removingId, setRemovingId] = useState(null)
  const [removeError, setRemoveError] = useState('')
  const [showRoleInfo, setShowRoleInfo] = useState(false)

  const orgId = profile?.org_id

  const loadMembers = async () => {
    const { data, error } = await supabase.from('profiles').select('*, user_roles(role)').eq('org_id', orgId)
    if (error) { console.error('[Users loadMembers]', error); setLoadError(error.message); return }
    setMembers(data || [])
  }

  useEffect(() => {
    if (!orgId) return
    supabase.from('profiles').select('*, user_roles(role)').eq('org_id', orgId).then(({ data, error }) => {
      if (error) { console.error('[Users loadMembers]', error); setLoadError(error.message) }
      setMembers(data || [])
      setLoading(false)
    })
  }, [orgId])

  const me = members.find(m => m.id === profile.id)
  const isOwner = rolesOf(me).includes('owner')

  // Roles are independent, not a hierarchy — an Owner assigns whatever
  // combination fits (e.g. Aprobador+Planificador for a mid-size org, or all
  // four for a one-person shop). The one convenience: any other role implies
  // being able to at least view, so checking it also checks Viewer.
  const toggleRole = (roleId) => {
    setSelectedRoles(prev => {
      if (prev.includes(roleId)) return prev.filter(r => r !== roleId)
      const next = [...prev, roleId]
      if (roleId !== 'viewer' && !next.includes('viewer')) next.push('viewer')
      return next
    })
  }

  const handleAdd = async () => {
    setAddError('')
    if (!email.trim()) { setAddError('Ingresá un email.'); return }
    if (selectedRoles.length === 0) { setAddError('Elegí al menos un rol.'); return }
    setAdding(true)

    const { data: foundId, error: lookupError } = await supabase.rpc('find_user_id_by_email', { p_email: email.trim() })
    if (lookupError) { setAdding(false); setAddError(lookupError.message); return }
    if (!foundId) {
      setAdding(false)
      setAddError('Ese email todavía no tiene una cuenta creada — pedile que entre a "Crear cuenta" en la pantalla de login primero, y después volvé a intentarlo acá.')
      return
    }

    const { data: existing } = await supabase.from('profiles').select('org_id').eq('id', foundId).maybeSingle()
    if (existing && existing.org_id !== orgId) {
      setAdding(false)
      setAddError('Ese usuario ya pertenece a otra organización — un usuario no puede estar en dos organizaciones a la vez.')
      return
    }

    if (!existing) {
      const { error: insertError } = await supabase.from('profiles').insert({ id: foundId, org_id: orgId, full_name: fullName.trim() || email.trim(), email: email.trim() })
      if (insertError) { setAdding(false); setAddError(insertError.message); return }
    }

    const { error: rolesError } = await supabase.from('user_roles').insert(selectedRoles.map(role => ({ profile_id: foundId, role })))
    setAdding(false)
    if (rolesError) { setAddError(rolesError.message); return }

    setEmail(''); setFullName(''); setSelectedRoles([])
    await loadMembers()
  }

  const handleRemoveAccess = async (memberId) => {
    setRemoveError('')
    setRemovingId(memberId)
    const { error } = await supabase.from('user_roles').delete().eq('profile_id', memberId)
    setRemovingId(null)
    if (error) {
      setRemoveError(error.message === 'Cannot remove the last Owner of an Organization'
        ? 'No se puede quitar acceso: toda organización necesita al menos un Owner.'
        : error.message)
      return
    }
    await loadMembers()
  }

  if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>Cargando…</div>

  return (
    <div>
      {loadError && (
        <div className="alert" style={{background:'#fdeaea', color:'#8b2020', border:'1px solid #f5c1c1', marginBottom:'16px'}}>
          ⚠️ No se pudo cargar la lista de usuarios: {loadError}
        </div>
      )}
      <div className="alert info" style={{marginBottom:'16px'}}>
        👥 Gestioná quién tiene acceso a {profile?.organizations?.name || 'tu organización'}. Para agregar a alguien, primero tiene que crear su propia cuenta desde "Crear cuenta" en la pantalla de login — acá solo la asignás con los roles que le correspondan.
      </div>

      {isOwner && (
        <div className="card">
          <div className="card-header"><span className="card-title">Agregar usuario existente</span></div>
          <div className="card-body">
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px'}}>
              <div className="form-field">
                <label>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="diego@wassington.com.ar"/>
              </div>
              <div className="form-field">
                <label>Nombre (opcional)</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Diego Frish"/>
              </div>
            </div>
            <div style={{marginBottom:'14px'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px'}}>
                <label style={{fontSize:'13px', fontWeight:500, color:'#0b4358'}}>Roles</label>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setShowRoleInfo(!showRoleInfo)}>
                  {showRoleInfo ? '✕ Cerrar' : 'ℹ️ Descripción de roles'}
                </button>
              </div>

              {showRoleInfo && (
                <div style={{background:'#f5f5ee', borderRadius:'8px', padding:'14px 16px', marginBottom:'12px'}}>
                  {ROLES.map(r => (
                    <div key={r.id} style={{marginBottom:'10px'}}>
                      <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358'}}>{r.label}</div>
                      <div style={{fontSize:'12px', color:'#555', lineHeight:1.5}}>{r.description}</div>
                    </div>
                  ))}
                  <div style={{fontSize:'11px', color:'#888', marginTop:'8px', fontStyle:'italic'}}>
                    Nota: hoy solo el rol Owner ya está controlado por el sistema (para administrar usuarios). Los otros roles están definidos pero todavía no restringen acciones — es una funcionalidad pendiente de una etapa futura.
                  </div>
                </div>
              )}

              <div style={{display:'flex', gap:'14px', flexWrap:'wrap'}}>
                {ROLES.map(r => (
                  <label key={r.id} style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', color:'#0b4358'}}>
                    <input type="checkbox" checked={selectedRoles.includes(r.id)} onChange={() => toggleRole(r.id)}/>
                    {r.label}
                  </label>
                ))}
              </div>
            </div>
            {addError && <div style={{color:'#8b2020', fontSize:'12px', marginBottom:'12px'}}>{addError}</div>}
            <button className="btn-primary" disabled={adding} onClick={handleAdd}>
              {adding ? 'Agregando…' : '+ Agregar usuario'}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Usuarios de {profile?.organizations?.name}</span>
          <span style={{fontSize:'12px', color:'var(--gray)'}}>{members.length} usuario{members.length === 1 ? '' : 's'}</span>
        </div>
        {removeError && <div style={{padding:'10px 20px', color:'#8b2020', fontSize:'12px', background:'#fdeaea'}}>⚠️ {removeError}</div>}
        <div style={{padding:0}}>
          <table className="data-table">
            <thead>
              <tr><th>Nombre</th><th>Email</th><th>Roles</th>{isOwner && <th></th>}</tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td style={{fontWeight:600}}>{m.full_name}{m.id === profile.id ? ' (vos)' : ''}</td>
                  <td style={{color:'var(--gray)'}}>{m.email || '—'}</td>
                  <td>
                    {rolesOf(m).length === 0 ? <span style={{color:'#888'}}>Sin acceso</span> : rolesOf(m).map(r => (
                      <span key={r} style={{background:'#f5f5ee', color:'#6b6b6b', fontSize:'11px', fontWeight:600, padding:'2px 8px', borderRadius:'100px', marginRight:'4px'}}>
                        {ROLES.find(x => x.id === r)?.label || r}
                      </span>
                    ))}
                  </td>
                  {isOwner && (
                    <td>
                      {rolesOf(m).length > 0 && (
                        <button className="btn-secondary btn-sm" disabled={removingId === m.id} onClick={() => handleRemoveAccess(m.id)}>
                          Quitar acceso
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
