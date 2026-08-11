import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { generateSequence } from '../../lib/sequence'

// Fase K-1 (2026-08-11) — FreshInset Global's side of MatriSure Kit
// stewardship: register brand-new serialized kit units, then release a lot
// to one specific Distributor. See DOMAIN_MODEL.md Rule 49 and the
// "matri-kit-stewardship-integration" project memory for the full design —
// this is the first of several screens (Distribuidor's receive/assign
// screen comes next).

const STATUS_LABEL = {
  registered: 'En stock (FreshInset)',
  released:   'Liberado',
  assigned:   'Asignado a Aplicador',
  used:       'Usado',
  destroyed:  'Destruido',
}

export default function KitsGlobal({ profile }) {
  const [units, setUnits] = useState([])
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)

  const [lotNumber, setLotNumber] = useState('')
  const [baseTracking, setBaseTracking] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [registerError, setRegisterError] = useState('')
  const [registerSaving, setRegisterSaving] = useState(false)

  const [selected, setSelected] = useState(new Set())
  const [targetDistributorId, setTargetDistributorId] = useState('')
  const [releaseQty, setReleaseQty] = useState('')
  const [releaseError, setReleaseError] = useState('')
  const [releaseSaving, setReleaseSaving] = useState(false)

  const orgId = profile?.org_id

  const reload = async () => {
    const [{ data: unitsData }, { data: orgsData }] = await Promise.all([
      supabase.from('kit_units').select('*').order('created_at', { ascending: false }),
      supabase.from('organizations').select('*'),
    ])
    setUnits(unitsData || [])
    setOrgs(orgsData || [])
    setLoading(false)
  }

  // Inlined directly (rather than calling reload()) to avoid
  // react-hooks/set-state-in-effect — reload() itself stays a standalone
  // function for the register/release handlers to call afterward.
  useEffect(() => {
    Promise.all([
      supabase.from('kit_units').select('*').order('created_at', { ascending: false }),
      supabase.from('organizations').select('*'),
    ]).then(([{ data: unitsData }, { data: orgsData }]) => {
      setUnits(unitsData || [])
      setOrgs(orgsData || [])
      setLoading(false)
    })
  }, [])

  const orgById = new Map(orgs.map(o => [o.id, o]))
  const distributors = orgs.filter(o => o.org_type === 'distributor').sort((a, b) => a.name.localeCompare(b.name))
  // Oldest first — matches FIFO release order, so the table reads top-to-bottom
  // the same way "Seleccionar los más antiguos" picks.
  const inStock = units
    .filter(u => u.org_id === orgId && u.status === 'registered')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const inCirculation = units.filter(u => !(u.org_id === orgId && u.status === 'registered'))

  const quantityNum = Number(quantity)
  const previewSequence = baseTracking.trim() && quantityNum > 0 ? generateSequence(baseTracking.trim(), quantityNum) : []

  const handleRegister = async () => {
    setRegisterError('')
    if (!lotNumber.trim()) { setRegisterError('Completá el número de lote.'); return }
    if (!baseTracking.trim()) { setRegisterError('Completá el número de tracking inicial.'); return }
    if (!quantityNum || quantityNum < 1) { setRegisterError('La cantidad tiene que ser al menos 1.'); return }
    setRegisterSaving(true)

    const payload = previewSequence.map(tn => ({ tracking_number: tn, lot_number: lotNumber.trim() }))
    const { error } = await supabase.rpc('register_kit_units', { p_units: payload })

    setRegisterSaving(false)
    if (error) {
      setRegisterError(error.code === '23505' ? 'Uno de los números de tracking generados ya existe — probá con otro número inicial.' : error.message)
      return
    }
    setLotNumber(''); setBaseTracking(''); setQuantity('1')
    await reload()
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const allInStockSelected = inStock.length > 0 && inStock.every(u => selected.has(u.id))
  const toggleSelectAll = () => setSelected(allInStockSelected ? new Set() : new Set(inStock.map(u => u.id)))

  // FIFO: registered longest ago goes out first — same principle DECCO's
  // Warehouse dispatch uses (project memory, Fase 7). inStock is already
  // sorted oldest-first, so this is just a slice.
  const selectFifo = () => {
    const n = Number(releaseQty)
    if (!n || n < 1) return
    setSelected(new Set(inStock.slice(0, n).map(u => u.id)))
  }

  const handleRelease = async () => {
    setReleaseError('')
    if (selected.size === 0) { setReleaseError('Elegí al menos un kit para liberar.'); return }
    if (!targetDistributorId) { setReleaseError('Elegí a qué Distribuidor liberás este lote.'); return }
    setReleaseSaving(true)

    const { error } = await supabase.rpc('release_kit_units', {
      p_unit_ids: [...selected], p_target_org_id: targetDistributorId,
    })

    setReleaseSaving(false)
    if (error) { setReleaseError(error.message); return }
    setSelected(new Set())
    setTargetDistributorId('')
    setReleaseQty('')
    await reload()
  }

  if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>Cargando…</div>

  return (
    <div>
      <div className="alert info" style={{marginBottom:'16px'}}>
        🧪 Registrá kits MatriSure nuevos con su número de tracking individual, y liberalos a un Distribuidor puntual cuando estén listos para despachar.
      </div>

      {/* Register new units */}
      <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)', marginBottom:'16px'}}>
        <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Registrar kits nuevos</span>
        </div>
        {registerError && <div style={{padding:'10px 20px', color:'#8b2020', fontSize:'12px', background:'#fdeaea'}}>⚠️ {registerError}</div>}
        <div style={{padding:'16px 20px', display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'flex-end'}}>
          <div>
            <label style={{display:'block', fontSize:'11px', color:'#888', marginBottom:'4px'}}>Número de lote</label>
            <input value={lotNumber} onChange={e => setLotNumber(e.target.value)} placeholder="Ej: 2026.08.11"
              style={{padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px', width:'140px'}}/>
          </div>
          <div>
            <label style={{display:'block', fontSize:'11px', color:'#888', marginBottom:'4px'}}>Tracking inicial {quantityNum > 1 ? '(primero de la tanda)' : ''}</label>
            <input value={baseTracking} onChange={e => setBaseTracking(e.target.value)} placeholder="Ej: MSK-0001"
              style={{padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px', width:'160px'}}/>
          </div>
          <div>
            <label style={{display:'block', fontSize:'11px', color:'#888', marginBottom:'4px'}}>Cantidad</label>
            <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)}
              style={{padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px', width:'90px'}}/>
          </div>
          <button className="btn-primary btn-sm" disabled={registerSaving} onClick={handleRegister}>
            {registerSaving ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
        {previewSequence.length > 1 && (
          <div style={{padding:'0 20px 16px', fontSize:'12px', color:'#0b4358'}}>
            Se van a crear {previewSequence.length} unidades: <strong>{previewSequence[0]}</strong> a <strong>{previewSequence[previewSequence.length - 1]}</strong>
          </div>
        )}
      </div>

      {/* In-stock at Global, releasable */}
      <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)', marginBottom:'16px'}}>
        <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Stock en FreshInset — {inStock.length} kit{inStock.length === 1 ? '' : 's'}</span>
        </div>

        {releaseError && <div style={{padding:'10px 20px', color:'#8b2020', fontSize:'12px', background:'#fdeaea'}}>⚠️ {releaseError}</div>}

        {inStock.length === 0 ? (
          <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>
            No hay kits sin liberar todavía. Registrá algunos arriba.
          </div>
        ) : (
          <>
            <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5', display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'center'}}>
              <input type="number" min="1" max={inStock.length} value={releaseQty} onChange={e => setReleaseQty(e.target.value)}
                placeholder="Cantidad" style={{padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'13px', width:'90px'}}/>
              <button className="btn-secondary btn-sm" disabled={!releaseQty} onClick={selectFifo}>
                Seleccionar los más antiguos
              </button>
              <select value={targetDistributorId} onChange={e => setTargetDistributorId(e.target.value)}
                style={{padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'13px'}}>
                <option value="">Liberar seleccionados a…</option>
                {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button className="btn-lime btn-sm" disabled={releaseSaving || selected.size === 0} onClick={handleRelease}>
                {releaseSaving ? 'Liberando…' : `Liberar (${selected.size})`}
              </button>
              {distributors.length === 0 && <span style={{fontSize:'11px', color:'#b06a00'}}>No hay Distribuidores dados de alta todavía.</span>}
            </div>
            <div className="table-scroll"><table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
              <thead>
                <tr>
                  <th style={{padding:'10px 16px', background:'#f5f5ee', borderBottom:'0.5px solid #ddddd5'}}>
                    <input type="checkbox" checked={allInStockSelected} onChange={toggleSelectAll}/>
                  </th>
                  {['Tracking', 'Lote', 'Registrado'].map(h => (
                    <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inStock.map(u => (
                  <tr key={u.id} style={{borderBottom:'0.5px solid #ddddd5'}}>
                    <td style={{padding:'10px 16px'}}>
                      <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)}/>
                    </td>
                    <td style={{padding:'10px 16px', fontWeight:700, fontFamily:'monospace'}}>{u.tracking_number}</td>
                    <td style={{padding:'10px 16px', color:'#6b6b6b'}}>{u.lot_number}</td>
                    <td style={{padding:'10px 16px', color:'#6b6b6b'}}>{new Date(u.created_at).toLocaleDateString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </>
        )}
      </div>

      {/* Everything already released/further downstream — oversight only, read-only here */}
      {inCirculation.length > 0 && (
        <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5'}}>
            <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>En circulación — {inCirculation.length} kit{inCirculation.length === 1 ? '' : 's'}</span>
            <div style={{fontSize:'11px', color:'#888', marginTop:'2px'}}>Solo lectura — la gestión de cada uno pasa a estar del lado del Distribuidor que lo recibió.</div>
          </div>
          <div className="table-scroll"><table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
            <thead>
              <tr>
                {['Tracking', 'Lote', 'Dónde está', 'Estado'].map(h => (
                  <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inCirculation.map(u => (
                <tr key={u.id} style={{borderBottom:'0.5px solid #ddddd5'}}>
                  <td style={{padding:'10px 16px', fontWeight:700, fontFamily:'monospace'}}>{u.tracking_number}</td>
                  <td style={{padding:'10px 16px', color:'#6b6b6b'}}>{u.lot_number}</td>
                  <td style={{padding:'10px 16px'}}>{orgById.get(u.org_id)?.name || '—'}</td>
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
