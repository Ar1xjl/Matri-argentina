import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

function fmt(v) { return '$' + Number(v || 0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2}) }

function buildValues(brackets, product, serviceFee, generator) {
  return Object.fromEntries(brackets.map(b => [b.code, {
    powder:      product.find(p => p.sku === 'MatriPowder' && p.bracket === b.code)?.price ?? 0,
    tablets:     product.find(p => p.sku === 'MatriTablets' && p.bracket === b.code)?.price ?? 0,
    service:     serviceFee.find(f => f.bracket === b.code)?.price ?? 0,
    genPurchase: generator.find(g => g.bracket === b.code)?.purchase_price ?? 0,
    genRental:   generator.find(g => g.bracket === b.code)?.rental_price ?? 0,
  }]))
}

const inputStyle = { width:'90px', padding:'6px 8px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'13px', textAlign:'right', fontFamily:'monospace' }
const thStyle = { padding:'10px 14px', textAlign:'right', fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', background:'#f5f5ee', borderBottom:'0.5px solid #ddddd5' }

export default function PricingPanel({ profile }) {
  const [brackets, setBrackets] = useState([])
  const [product, setProduct] = useState([])
  const [serviceFee, setServiceFee] = useState([])
  const [generator, setGenerator] = useState([])
  const [currency, setCurrency] = useState('USD')
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newBracket, setNewBracket] = useState({ code: '', min_m3: '', max_m3: '' })

  const orgId = profile?.org_id

  const loadAll = async () => {
    const [{ data: b }, { data: p }, { data: sf }, { data: gen }, { data: org }] = await Promise.all([
      supabase.from('volume_brackets').select('*').eq('org_id', orgId).order('min_m3'),
      supabase.from('pricing_product').select('*').eq('org_id', orgId),
      supabase.from('pricing_service_fee').select('*').eq('org_id', orgId),
      supabase.from('pricing_generator').select('*').eq('org_id', orgId),
      supabase.from('organizations').select('currency').eq('id', orgId).single(),
    ])
    setBrackets(b || [])
    setProduct(p || [])
    setServiceFee(sf || [])
    setGenerator(gen || [])
    setCurrency(org?.currency || 'USD')
    setValues(buildValues(b || [], p || [], sf || [], gen || []))
    setLoading(false)
  }

  useEffect(() => {
    if (!orgId) return
    Promise.all([
      supabase.from('volume_brackets').select('*').eq('org_id', orgId).order('min_m3'),
      supabase.from('pricing_product').select('*').eq('org_id', orgId),
      supabase.from('pricing_service_fee').select('*').eq('org_id', orgId),
      supabase.from('pricing_generator').select('*').eq('org_id', orgId),
      supabase.from('organizations').select('currency').eq('id', orgId).single(),
    ]).then(([{ data: b }, { data: p }, { data: sf }, { data: gen }, { data: org }]) => {
      setBrackets(b || [])
      setProduct(p || [])
      setServiceFee(sf || [])
      setGenerator(gen || [])
      setCurrency(org?.currency || 'USD')
      setValues(buildValues(b || [], p || [], sf || [], gen || []))
      setLoading(false)
    })
  }, [orgId])

  const setCell = (code, field, val) => setValues(prev => ({ ...prev, [code]: { ...prev[code], [field]: val } }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const productRows = brackets.flatMap(b => [
      { org_id: orgId, sku: 'MatriPowder',  bracket: b.code, price: Number(values[b.code]?.powder) || 0 },
      { org_id: orgId, sku: 'MatriTablets', bracket: b.code, price: Number(values[b.code]?.tablets) || 0 },
    ])
    const serviceRows = brackets.map(b => ({ org_id: orgId, bracket: b.code, price: Number(values[b.code]?.service) || 0 }))
    const generatorRows = brackets.map(b => ({
      org_id: orgId, bracket: b.code,
      purchase_price: Number(values[b.code]?.genPurchase) || 0,
      rental_price: Number(values[b.code]?.genRental) || 0,
    }))

    const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
      productRows.length ? supabase.from('pricing_product').upsert(productRows, { onConflict: 'org_id,sku,bracket' }) : { error: null },
      serviceRows.length ? supabase.from('pricing_service_fee').upsert(serviceRows, { onConflict: 'org_id,bracket' }) : { error: null },
      generatorRows.length ? supabase.from('pricing_generator').upsert(generatorRows, { onConflict: 'org_id,bracket' }) : { error: null },
    ])
    setSaving(false)
    const err = e1 || e2 || e3
    if (err) { setError(err.message); return }
    setEditing(false)
    await loadAll()
  }

  const handleCancel = () => {
    setValues(buildValues(brackets, product, serviceFee, generator))
    setEditing(false)
  }

  const handleAddBracket = async () => {
    setError('')
    if (!newBracket.code.trim() || newBracket.min_m3 === '') { setError('Completá código y m³ desde.'); return }
    const { error } = await supabase.from('volume_brackets').insert({
      org_id: orgId,
      code: newBracket.code.trim(),
      min_m3: Number(newBracket.min_m3),
      max_m3: newBracket.max_m3 === '' ? null : Number(newBracket.max_m3),
    })
    if (error) {
      setError(error.code === '23505' ? 'Ya existe un bracket con ese código.' : error.message)
      return
    }
    setNewBracket({ code: '', min_m3: '', max_m3: '' })
    await loadAll()
  }

  const handleRemoveBracket = async (id) => {
    const { error } = await supabase.from('volume_brackets').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await loadAll()
  }

  if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>Cargando…</div>

  return (
    <div>
      <div className="alert info">
        Estos son los precios de lista de tu organización ({currency}) — se aplican automáticamente en la calculadora y el Plan de Temporada de tus clientes, salvo que tengan un precio pactado particular (ver "Organizaciones").
      </div>

      {error && <div style={{padding:'10px 16px', color:'#8b2020', fontSize:'12px', background:'#fdeaea', borderRadius:'8px', marginBottom:'12px'}}>⚠️ {error}</div>}

      {brackets.length === 0 ? (
        <div style={{color:'#888', fontSize:'13px', padding:'16px', background:'#fff3cd', borderRadius:'8px', marginBottom:'16px'}}>
          Todavía no cargaste ningún bracket de volumen — agregá al menos uno abajo para poder cargar precios.
        </div>
      ) : (
        <div style={{background:'#fff', borderRadius:'10px', border:'0.5px solid #ddddd5', overflow:'hidden', marginBottom:'16px'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'0.5px solid #ddddd5'}}>
            <div style={{fontSize:'14px', fontWeight:700, color:'#0b4358'}}>Precios por bracket de volumen</div>
            <div style={{display:'flex', gap:'8px'}}>
              {editing ? (
                <>
                  <button onClick={handleSave} disabled={saving} style={{background:'#1a6b30', color:'#fff', border:'none', borderRadius:'6px', padding:'6px 14px', fontSize:'12px', fontWeight:700, cursor:'pointer'}}>
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button onClick={handleCancel} className="btn-secondary btn-sm">Cancelar</button>
                </>
              ) : (
                <button onClick={() => setEditing(true)} className="btn-secondary btn-sm">Editar precios</button>
              )}
            </div>
          </div>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
            <thead>
              <tr>
                <th style={{...thStyle, textAlign:'left'}}>Bracket (m³)</th>
                <th style={thStyle}>MatriPowder $/m³</th>
                <th style={thStyle}>MatriTablets $/m³</th>
                <th style={thStyle}>Servicio $/cámara</th>
                <th style={thStyle}>Generador compra</th>
                <th style={thStyle}>Generador alquiler/día</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {brackets.map((b, i) => (
                <tr key={b.id} style={{borderBottom: i < brackets.length-1 ? '0.5px solid #ddddd5' : 'none'}}>
                  <td style={{padding:'10px 14px', fontWeight:700, color:'#0b4358'}}>{b.code} ({b.min_m3}–{b.max_m3 ?? '+'})</td>
                  {[
                    ['powder', p => fmt(p)],
                    ['tablets', p => fmt(p)],
                    ['service', p => fmt(p)],
                    ['genPurchase', p => fmt(p)],
                    ['genRental', p => fmt(p)],
                  ].map(([field, formatter]) => (
                    <td key={field} style={{padding:'8px 14px', textAlign:'right'}}>
                      {editing ? (
                        <input type="number" step="0.01" style={inputStyle} value={values[b.code]?.[field] ?? 0} onChange={e => setCell(b.code, field, e.target.value)} />
                      ) : (
                        <span style={{fontFamily:'monospace', fontWeight:500}}>{formatter(values[b.code]?.[field])}</span>
                      )}
                    </td>
                  ))}
                  <td style={{padding:'8px 14px', textAlign:'right'}}>
                    {!editing && (
                      <button onClick={() => handleRemoveBracket(b.id)} style={{background:'none', border:'none', color:'#8b2020', cursor:'pointer', fontSize:'13px'}} title="Eliminar bracket">✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{background:'#fff', borderRadius:'10px', border:'0.5px solid #ddddd5', padding:'16px'}}>
        <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358', marginBottom:'10px'}}>+ Agregar bracket de volumen</div>
        <div style={{display:'flex', gap:'10px', alignItems:'flex-end', flexWrap:'wrap'}}>
          <div>
            <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>Código</label>
            <input style={{padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px', width:'90px'}} value={newBracket.code} onChange={e => setNewBracket(prev => ({ ...prev, code: e.target.value }))} placeholder="Ej: xl"/>
          </div>
          <div>
            <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>Desde (m³)</label>
            <input type="number" style={{padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px', width:'110px'}} value={newBracket.min_m3} onChange={e => setNewBracket(prev => ({ ...prev, min_m3: e.target.value }))} placeholder="Ej: 1800"/>
          </div>
          <div>
            <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>Hasta (m³, vacío = sin límite)</label>
            <input type="number" style={{padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px', width:'110px'}} value={newBracket.max_m3} onChange={e => setNewBracket(prev => ({ ...prev, max_m3: e.target.value }))} placeholder="Vacío = +"/>
          </div>
          <button className="btn-primary" onClick={handleAddBracket}>+ Agregar</button>
        </div>
      </div>

      <div style={{background:'#f0f7e0', border:'0.5px solid #b5cc2e', borderRadius:'10px', padding:'14px 16px', fontSize:'12px', color:'#3b6d11', marginTop:'16px'}}>
        <strong>Nota:</strong> esto es el precio de lista estándar. El precio final de un Tratamiento siempre lo confirma el Aprobador al aprobarlo, y un Cliente puede tener un precio particular pactado (ver "Organizaciones" → 💲 Precio).
      </div>
    </div>
  )
}
