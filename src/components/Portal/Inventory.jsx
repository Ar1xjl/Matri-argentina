import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

const SKU_LABEL = { MatriPowder: 'MatriPowder', MatriTablets: 'MatriTablets' }
const SKU_VARIANTS = {
  MatriPowder: ['100g', '50g', '20g', '10g'],
  MatriTablets: ['grande', 'chica'],
}

export default function Inventory({ profile }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [deltas, setDeltas] = useState({}) // `${sku}|${variant}` -> string input value
  const [saving, setSaving] = useState(null) // key currently being adjusted
  const [error, setError] = useState(null)

  const orgId = profile?.org_id

  useEffect(() => {
    if (!orgId) return
    supabase.from('inventory_items').select('*').eq('org_id', orgId).then(({ data, error }) => {
      if (error) console.error(error)
      setItems(data || [])
      setLoading(false)
    })
  }, [orgId])

  const quantityOf = (sku, variant) => items.find(i => i.sku === sku && i.variant === variant)?.quantity ?? 0

  const adjust = async (sku, variant) => {
    const key = `${sku}|${variant}`
    const delta = Number(deltas[key])
    if (!delta) return
    setSaving(key)
    setError(null)

    const existing = items.find(i => i.sku === sku && i.variant === variant)
    const result = existing
      ? await supabase.from('inventory_items').update({ quantity: existing.quantity + delta, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : await supabase.from('inventory_items').insert({ org_id: orgId, sku, variant, quantity: delta })

    setSaving(null)
    if (result.error) { setError(result.error.message); return }

    setDeltas(prev => ({ ...prev, [key]: '' }))
    const { data } = await supabase.from('inventory_items').select('*').eq('org_id', orgId)
    setItems(data || [])
  }

  return (
    <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
      <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5'}}>
        <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Inventario</span>
        <div style={{fontSize:'11px', color:'#888', marginTop:'2px'}}>
          Stock disponible de tu propia organización. Se descuenta automáticamente cuando un cliente marca un Tratamiento como aplicado — este primer alcance no reparte stock por sub-distribuidor todavía.
        </div>
      </div>

      {error && <div style={{padding:'10px 20px', color:'#8b2020', fontSize:'12px', background:'#fdeaea'}}>⚠️ {error}</div>}

      {loading ? (
        <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>Cargando…</div>
      ) : (
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
          <thead>
            <tr>
              {['SKU','Variante','Stock actual','Ajustar (+/-)',''].map(h => (
                <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(SKU_VARIANTS).map(([sku, variants]) => variants.map((variant, vi) => {
              const key = `${sku}|${variant}`
              const qty = quantityOf(sku, variant)
              return (
                <tr key={key} style={{borderBottom:'0.5px solid #ddddd5'}}>
                  {vi === 0 && (
                    <td rowSpan={variants.length} style={{padding:'12px 16px', fontWeight:700, verticalAlign:'top', borderRight:'0.5px solid #ddddd5'}}>
                      {SKU_LABEL[sku]}
                    </td>
                  )}
                  <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{variant}</td>
                  <td style={{padding:'12px 16px', fontWeight:700, color: qty < 0 ? '#8b2020' : '#0b4358'}}>{qty}</td>
                  <td style={{padding:'12px 16px'}}>
                    <input
                      type="number"
                      placeholder="ej: 50 o -10"
                      value={deltas[key] || ''}
                      onChange={e => setDeltas(prev => ({ ...prev, [key]: e.target.value }))}
                      style={{width:'110px', padding:'6px 8px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'13px'}}
                    />
                  </td>
                  <td style={{padding:'12px 16px'}}>
                    <button className="btn-secondary btn-sm" disabled={saving === key || !deltas[key]} onClick={() => adjust(sku, variant)}>
                      Aplicar
                    </button>
                  </td>
                </tr>
              )
            }))}
          </tbody>
        </table>
      )}
    </div>
  )
}
