import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'

const ROLES = [
  { id: 'owner',    label: 'Owner',        description: 'Acceso total a su organización y a todo lo que esté debajo en el árbol. Es el único rol que puede administrar usuarios (agregar, sacar, asignar roles). Toda organización necesita al menos un Owner siempre.' },
  { id: 'approver', label: 'Aprobador',    description: 'Revisa, fija el precio final y aprueba o rechaza Tratamientos enviados por las organizaciones debajo de la suya.' },
  { id: 'planner',  label: 'Planificador', description: 'Crea, edita y envía Tratamientos — usa la Calculadora y carga el Plan de Temporada.' },
  { id: 'operator', label: 'Operador',     description: 'Registra la aplicación física del tratamiento y sube la verificación MatriSure.' },
  { id: 'viewer',   label: 'Viewer',       description: 'Solo lectura de Tratamientos e historial — no puede crear ni modificar nada.' },
]

function rolesOf(m) { return (m?.user_roles || []).map(r => r.role) }

function OrgNode({ org, childrenOf, depth, expanded, toggleExpand, selectedOrgId, selectOrg }) {
  const kids = childrenOf(org.id)
  const isExpanded = expanded.has(org.id)
  const isSelected = selectedOrgId === org.id
  return (
    <div>
      <div
        onClick={() => selectOrg(org.id)}
        style={{
          display:'flex', alignItems:'center', gap:'6px', cursor:'pointer',
          padding:'6px 8px', paddingLeft:`${8 + depth * 18}px`, borderRadius:'6px',
          background: isSelected ? '#0b4358' : 'transparent',
          color: isSelected ? '#fff' : '#0b4358',
        }}
      >
        {kids.length > 0 ? (
          <span onClick={(e) => { e.stopPropagation(); toggleExpand(org.id) }} style={{width:'14px', fontSize:'11px', textAlign:'center'}}>
            {isExpanded ? '▼' : '▶'}
          </span>
        ) : <span style={{width:'14px'}} />}
        <span style={{fontSize:'13px', fontWeight: isSelected ? 700 : 500}}>{org.name}</span>
      </div>
      {isExpanded && kids.map(child => (
        <OrgNode key={child.id} org={child} childrenOf={childrenOf} depth={depth + 1}
          expanded={expanded} toggleExpand={toggleExpand} selectedOrgId={selectedOrgId} selectOrg={selectOrg} />
      ))}
    </div>
  )
}

export default function Users({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [myRoles, setMyRoles] = useState([])
  const [expanded, setExpanded] = useState(new Set())
  const [selectedOrgId, setSelectedOrgId] = useState(profile?.org_id)
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
  const [pendingSignups, setPendingSignups] = useState([])
  const [dismissingId, setDismissingId] = useState(null)

  const myOrgId = profile?.org_id

  const loadMembers = async (orgId) => {
    const { data, error } = await supabase.from('profiles').select('*, user_roles(role)').eq('org_id', orgId)
    if (error) { console.error('[Users loadMembers]', error); setLoadError(error.message); return }
    setMembers(data || [])
  }

  // Org tree + my own roles load once — RLS already scopes "organizations"
  // to my whole visible subtree (root/global sees everyone below it, a
  // Customer sees only itself), same free win as Cámaras/Season Plan.
  useEffect(() => {
    if (!myOrgId) return
    Promise.all([
      supabase.from('organizations').select('*'),
      supabase.from('user_roles').select('role').eq('profile_id', profile.id),
      supabase.from('pending_user_signups').select('*').order('created_at'),
    ]).then(([{ data: orgData, error: orgError }, { data: roleData }, { data: pendingData }]) => {
      if (orgError) { console.error('[Users loadOrgs]', orgError); setLoadError(orgError.message) }
      setOrgs(orgData || [])
      setMyRoles((roleData || []).map(r => r.role))
      setPendingSignups(pendingData || [])
      setExpanded(new Set([myOrgId]))
      setLoading(false)
    })
  }, [myOrgId, profile.id])

  const loadPendingSignups = () => {
    supabase.from('pending_user_signups').select('*').order('created_at').then(({ data, error }) => {
      if (error) { console.error('[Users loadPendingSignups]', error); return }
      setPendingSignups(data || [])
    })
  }

  const claimSignup = (p) => {
    setEmail(p.email)
    setFullName(p.full_name || '')
    setAddError('')
  }

  const handleDismissSignup = async (id) => {
    setDismissingId(id)
    const { error } = await supabase.from('pending_user_signups').delete().eq('id', id)
    setDismissingId(null)
    if (error) { console.error('[Users dismissSignup]', error); return }
    loadPendingSignups()
  }

  useEffect(() => {
    if (!selectedOrgId) return
    supabase.from('profiles').select('*, user_roles(role)').eq('org_id', selectedOrgId).then(({ data, error }) => {
      if (error) { console.error('[Users loadMembers]', error); setLoadError(error.message) }
      setMembers(data || [])
    })
  }, [selectedOrgId])

  const isOwner = myRoles.includes('owner')
  const orgById = useMemo(() => new Map(orgs.map(o => [o.id, o])), [orgs])
  const childrenOf = (parentId) => orgs.filter(o => o.parent_id === parentId)
  const rootOrg = orgById.get(myOrgId)
  const selectedOrg = orgById.get(selectedOrgId)

  const toggleExpand = (orgId) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(orgId) ? next.delete(orgId) : next.add(orgId)
      return next
    })
  }

  const selectOrg = (orgId) => {
    setSelectedOrgId(orgId)
    setEmail(''); setFullName(''); setSelectedRoles([]); setAddError(''); setRemoveError('')
  }

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
    if (existing && existing.org_id !== selectedOrgId) {
      setAdding(false)
      setAddError('Ese usuario ya pertenece a otra organización — un usuario no puede estar en dos organizaciones a la vez.')
      return
    }

    if (!existing) {
      const { error: insertError } = await supabase.from('profiles').insert({ id: foundId, org_id: selectedOrgId, full_name: fullName.trim() || email.trim(), email: email.trim() })
      if (insertError) { setAdding(false); setAddError(insertError.message); return }
    }

    const { error: rolesError } = await supabase.from('user_roles').insert(selectedRoles.map(role => ({ profile_id: foundId, role })))
    setAdding(false)
    if (rolesError) { setAddError(rolesError.message); return }

    setEmail(''); setFullName(''); setSelectedRoles([])
    await loadMembers(selectedOrgId)
    loadPendingSignups()
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
    await loadMembers(selectedOrgId)
  }

  if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>Cargando…</div>

  return (
    <div>
      {loadError && (
        <div className="alert" style={{background:'#fdeaea', color:'#8b2020', border:'1px solid #f5c1c1', marginBottom:'16px'}}>
          ⚠️ {loadError}
        </div>
      )}

      {pendingSignups.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📥 Solicitudes de usuario pendientes de asignar</span>
            <span style={{fontSize:'12px', color:'var(--gray)'}}>{pendingSignups.length}</span>
          </div>
          <div style={{padding:'12px 20px', display:'flex', flexDirection:'column', gap:'8px'}}>
            {pendingSignups.map(p => (
              <div key={p.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', background:'#f5f5ee', borderRadius:'8px', padding:'10px 14px', flexWrap:'wrap'}}>
                <div>
                  <div style={{fontWeight:700, color:'#0b4358', fontSize:'13px'}}>{p.full_name || '(sin nombre)'}</div>
                  <div style={{fontSize:'12px', color:'#6b6b6b'}}>{p.email} · {new Date(p.created_at).toLocaleDateString('es-AR')}</div>
                </div>
                {isOwner && (
                  <div style={{display:'flex', gap:'6px'}}>
                    <button className="btn-secondary btn-sm" onClick={() => claimSignup(p)}>Asignar</button>
                    <button
                      style={{background:'#fdeaea', color:'#8b2020', border:'0.5px solid #f0c7c7', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:600, cursor:'pointer'}}
                      disabled={dismissingId === p.id}
                      onClick={() => handleDismissSignup(p.id)}
                    >
                      Descartar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="alert info" style={{marginBottom:'16px'}}>
        👥 Elegí una organización del árbol para ver y gestionar sus usuarios. Para agregar a alguien, primero tiene que crear su propia cuenta desde "Crear cuenta" en la pantalla de login.
      </div>

      <div style={{display:'grid', gridTemplateColumns:'260px 1fr', gap:'16px', alignItems:'start'}}>
        {/* Org tree */}
        <div className="card" style={{marginBottom:0}}>
          <div className="card-header"><span className="card-title">Organizaciones</span></div>
          <div style={{padding:'10px'}}>
            {rootOrg && (
              <OrgNode org={rootOrg} childrenOf={childrenOf} depth={0}
                expanded={expanded} toggleExpand={toggleExpand}
                selectedOrgId={selectedOrgId} selectOrg={selectOrg} />
            )}
          </div>
        </div>

        {/* Selected org's users */}
        <div>
          {isOwner && (
            <div className="card">
              <div className="card-header"><span className="card-title">Agregar usuario a {selectedOrg?.name}</span></div>
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
              <span className="card-title">Usuarios de {selectedOrg?.name}</span>
              <span style={{fontSize:'12px', color:'var(--gray)'}}>{members.length} usuario{members.length === 1 ? '' : 's'}</span>
            </div>
            {removeError && <div style={{padding:'10px 20px', color:'#8b2020', fontSize:'12px', background:'#fdeaea'}}>⚠️ {removeError}</div>}
            <div style={{padding:0}} className="table-scroll">
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
      </div>
    </div>
  )
}
