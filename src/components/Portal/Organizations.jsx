import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import CustomerPricingModal from './CustomerPricingModal'

const TYPE_LABEL = {
  global: 'FreshInset Global', distributor: 'Distribuidor',
  subdistributor: 'Sub-distribuidor', customer: 'Cliente',
}

// Rule 1/13 (DOMAIN_MODEL.md): who can create what directly below them.
const ALLOWED_CHILD_TYPES = {
  global: ['distributor'],
  distributor: ['subdistributor', 'customer'],
  subdistributor: ['customer'],
  customer: [],
}

const emptyForm = { name: '', org_type: '', parent_id: '', country: '', currency: '', fx_rate_to_usd: '' }

export default function Organizations({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [pricingCustomer, setPricingCustomer] = useState(null) // org row, or null
  const [myRoles, setMyRoles] = useState([])
  const [requests, setRequests] = useState([]) // pending organization_access_requests
  const [convertingRequest, setConvertingRequest] = useState(null) // request row being turned into an org, or null

  const myOrgType = profile?.organizations?.org_type
  const isGlobal = myOrgType === 'global'
  const childTypes = ALLOWED_CHILD_TYPES[myOrgType] || []
  // Setting a Customer's negotiated price is an Owner/Approver action
  // (DOMAIN_MODEL.md Rule 36) — same authority as approving a Treatment's price.
  const canEditPricing = myRoles.includes('owner') || myRoles.includes('approver')

  const fetchOrgs = () => supabase.from('organizations').select('*').order('org_type').order('name')

  const loadOrgs = async () => {
    const { data, error } = await fetchOrgs()
    if (error) { console.error(error); setLoading(false); return }
    setOrgs(data || [])
    setLoading(false)
  }

  const loadRequests = async () => {
    const { data, error } = await supabase.from('organization_access_requests')
      .select('*').eq('status', 'pending').order('created_at')
    if (error) { console.error(error); return }
    setRequests(data || [])
  }

  useEffect(() => {
    supabase.from('user_roles').select('role').eq('profile_id', profile.id).then(({ data }) => {
      setMyRoles((data || []).map(r => r.role))
    })
    fetchOrgs().then(({ data, error }) => {
      if (error) console.error(error)
      setOrgs(data || [])
      setLoading(false)
    })
    supabase.from('organization_access_requests').select('*').eq('status', 'pending').order('created_at').then(({ data, error }) => {
      if (error) { console.error(error); return }
      setRequests(data || [])
    })
  }, [profile.id])

  const orgById = useMemo(() => new Map(orgs.map(o => [o.id, o])), [orgs])
  // Only non-Customer orgs in my subtree can act as a parent — a Customer has no children.
  const validParents = useMemo(() => orgs.filter(o => o.org_type !== 'customer'), [orgs])

  const openModal = () => {
    setConvertingRequest(null)
    setForm({ ...emptyForm, org_type: childTypes[0] || '', parent_id: profile?.org_id || '' })
    setError(null)
    setShowModal(true)
  }

  // Assigning a pending access request reuses the same "+ Nueva organización"
  // modal, pre-filled — the request itself has no org_type/parent_id (the
  // requester doesn't know where they'll be slotted in), so the reviewer
  // still picks that here, same as any manual creation.
  const openModalForRequest = (request) => {
    setConvertingRequest(request)
    setForm({
      ...emptyForm,
      name: request.company_name,
      org_type: childTypes.includes('customer') ? 'customer' : (childTypes[0] || ''),
      parent_id: profile?.org_id || '',
      country: request.region || '',
    })
    setError(null)
    setShowModal(true)
  }

  const handleCreate = async () => {
    if (!form.name.trim() || !form.org_type || !form.parent_id) {
      setError('Completá nombre, tipo y organización superior.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name.trim(),
      org_type: form.org_type,
      parent_id: form.parent_id,
      country: form.country || null,
      currency: form.org_type === 'distributor' ? (form.currency || null) : null,
      fx_rate_to_usd: form.org_type === 'distributor' && form.fx_rate_to_usd ? Number(form.fx_rate_to_usd) : null,
    }
    const { data: newOrg, error } = await supabase.from('organizations').insert(payload).select().single()
    if (error) { setSaving(false); setError(error.message); return }

    if (convertingRequest) {
      const { error: reqError } = await supabase.from('organization_access_requests').update({
        status: 'approved', resulting_org_id: newOrg.id,
        reviewed_by: profile.id, reviewed_at: new Date().toISOString(),
      }).eq('id', convertingRequest.id)
      if (reqError) console.error(reqError)
    }

    setSaving(false)
    setShowModal(false)
    setConvertingRequest(null)
    await Promise.all([loadOrgs(), loadRequests()])
  }

  const rejectRequest = async (request) => {
    const { error } = await supabase.from('organization_access_requests').update({
      status: 'rejected', reviewed_by: profile.id, reviewed_at: new Date().toISOString(),
    }).eq('id', request.id)
    if (error) { console.error(error); return }
    await loadRequests()
  }

  const activateOrg = async (id) => {
    const { error } = await supabase.from('organizations').update({ status: 'active' }).eq('id', id)
    if (error) { console.error(error); return }
    await loadOrgs()
  }

  return (
    <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
      {requests.length > 0 && childTypes.length > 0 && (
        <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5'}}>
            <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>📥 Solicitudes de acceso pendientes</span>
            <div style={{fontSize:'11px', color:'#888', marginTop:'2px'}}>
              Empresas que pidieron acceso desde "Solicitar acceso — nueva empresa". Asignalas a tu árbol o rechazalas.
            </div>
          </div>
          <div style={{padding:'12px 20px', display:'flex', flexDirection:'column', gap:'10px'}}>
            {requests.map(r => (
              <div key={r.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', background:'#f5f5ee', borderRadius:'8px', padding:'10px 14px', flexWrap:'wrap'}}>
                <div>
                  <div style={{fontWeight:700, color:'#0b4358', fontSize:'13px'}}>{r.company_name}</div>
                  <div style={{fontSize:'11px', color:'#6b6b6b', marginTop:'2px'}}>
                    {[r.tax_id, r.tax_status, r.region].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{fontSize:'11px', color:'#6b6b6b'}}>{r.contact_email}{r.contact_phone ? ` · ${r.contact_phone}` : ''}</div>
                </div>
                <div style={{display:'flex', gap:'6px'}}>
                  <button
                    style={{background:'#e8f4fc', color:'#0c447c', border:'0.5px solid #b8dcf5', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:600, cursor:'pointer'}}
                    onClick={() => openModalForRequest(r)}
                  >
                    Asignar organización
                  </button>
                  <button
                    style={{background:'#fdeaea', color:'#8b2020', border:'0.5px solid #f0c7c7', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:600, cursor:'pointer'}}
                    onClick={() => rejectRequest(r)}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
      <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Organizaciones</span>
          <div style={{fontSize:'11px', color:'#888', marginTop:'2px'}}>
            Tu organización y todo lo que cuelga debajo en el árbol.
          </div>
        </div>
        {childTypes.length > 0 && (
          <button
            style={{background:'#b5cc2e', color:'#0b4358', border:'none', borderRadius:'6px', padding:'6px 14px', fontSize:'12px', fontWeight:700, cursor:'pointer'}}
            onClick={openModal}
          >
            + Nueva organización
          </button>
        )}
      </div>

      {loading ? (
        <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>Cargando…</div>
      ) : (
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
          <thead>
            <tr>
              {['Nombre','Tipo','Organización superior','País','Moneda','Estado',''].map(h => (
                <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orgs.map((o, i) => (
              <tr key={o.id} style={{borderBottom: i < orgs.length-1 ? '0.5px solid #ddddd5' : 'none'}}>
                <td style={{padding:'12px 16px', fontWeight:600}}>{o.name}</td>
                <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{TYPE_LABEL[o.org_type] || o.org_type}</td>
                <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{o.parent_id ? (orgById.get(o.parent_id)?.name || '—') : '—'}</td>
                <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{o.country || '—'}</td>
                <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{o.currency || '—'}</td>
                <td style={{padding:'12px 16px'}}>
                  <span style={{background: o.status==='active'?'#eaf7ee':'#fff3cd', color: o.status==='active'?'#1a6b30':'#b06a00', fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'100px'}}>
                    {o.status==='active' ? '✓ Activa' : '⏳ Pendiente'}
                  </span>
                </td>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex', gap:'6px'}}>
                    {o.status === 'pending' && isGlobal && (
                      <button
                        style={{background:'#f5f5ee', color:'#0b4358', border:'0.5px solid #ddddd5', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:600, cursor:'pointer'}}
                        onClick={() => activateOrg(o.id)}
                      >
                        Activar
                      </button>
                    )}
                    {o.status === 'pending' && !isGlobal && (
                      <span style={{fontSize:'11px', color:'#888'}}>Espera aprobación de FreshInset Global</span>
                    )}
                    {o.org_type === 'customer' && o.id !== profile.org_id && canEditPricing && (
                      <button
                        style={{background:'#e8f4fc', color:'#0c447c', border:'0.5px solid #b8dcf5', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:600, cursor:'pointer'}}
                        onClick={() => setPricingCustomer(o)}
                      >
                        💲 Precio
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div
          onClick={(e) => e.target === e.currentTarget && (setShowModal(false), setConvertingRequest(null))}
          style={{position:'fixed', inset:0, background:'rgba(7,46,61,.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center'}}
        >
          <div style={{background:'#fff', borderRadius:'14px', padding:'28px', width:'100%', maxWidth:'440px', boxShadow:'0 8px 32px rgba(11,67,88,.2)'}}>
            <div style={{fontSize:'16px', fontWeight:800, color:'#0b4358', marginBottom:'16px'}}>
              {convertingRequest ? `Asignar organización — ${convertingRequest.company_name}` : 'Nueva organización'}
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:'12px', marginBottom:'8px'}}>
              <div>
                <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>Nombre</label>
                <input
                  style={{width:'100%', padding:'9px 12px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px'}}
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Frutícola Río Negro"
                />
              </div>

              <div>
                <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>Tipo</label>
                <select
                  style={{width:'100%', padding:'9px 12px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px'}}
                  value={form.org_type} onChange={e => setForm({ ...form, org_type: e.target.value })}
                >
                  {childTypes.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </div>

              <div>
                <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>Organización superior</label>
                <select
                  style={{width:'100%', padding:'9px 12px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px'}}
                  value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })}
                >
                  {validParents.map(o => <option key={o.id} value={o.id}>{o.name} ({TYPE_LABEL[o.org_type]})</option>)}
                </select>
              </div>

              <div>
                <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>País</label>
                <input
                  style={{width:'100%', padding:'9px 12px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px'}}
                  value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="Ej: AR"
                />
              </div>

              {form.org_type === 'distributor' && (
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                  <div>
                    <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>Moneda</label>
                    <input
                      style={{width:'100%', padding:'9px 12px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px'}}
                      value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} placeholder="Ej: ARS"
                    />
                  </div>
                  <div>
                    <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>TC a USD</label>
                    <input
                      type="number" step="0.01"
                      style={{width:'100%', padding:'9px 12px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px'}}
                      value={form.fx_rate_to_usd} onChange={e => setForm({ ...form, fx_rate_to_usd: e.target.value })} placeholder="Ej: 1000"
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{fontSize:'11px', color:'#888', marginBottom:'16px'}}>
              Queda en estado "Pendiente" hasta que FreshInset Global la apruebe (Rule 13 — no bloquea el uso interno mientras tanto).
            </div>

            {error && <div style={{color:'#8b2020', fontSize:'12px', marginBottom:'12px'}}>{error}</div>}

            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
              <button className="btn-primary" disabled={saving} onClick={handleCreate}>
                {saving ? 'Creando…' : 'Crear organización'}
              </button>
              <button className="btn-secondary" style={{background:'none', border:'none', color:'#888'}} onClick={() => { setShowModal(false); setConvertingRequest(null) }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {pricingCustomer && (
        <CustomerPricingModal customer={pricingCustomer} profile={profile} onClose={() => setPricingCustomer(null)} />
      )}
    </div>
    </div>
  )
}
