import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

const SKU_LABEL = { MatriPowder: 'MatriPowder', MatriTablets: 'MatriTablets' }
// Both MatriPowder pouch sizes and MatriTablets envelope sizes come from
// their editable per-Distributor catalogs now (Fase E, 2026-07-12) — see
// powderVariants/tabletVariants state below. The two loose-tablet pools
// (suelta_grande/suelta_chica) always exist regardless of the envelope
// catalog, since that's what Treatments actually consume from.
function tabletVariantLabel(variant) {
  if (variant === 'suelta_grande') return 'Sueltas — grande (fuera de sobre)'
  if (variant === 'suelta_chica') return 'Sueltas — chica (fuera de sobre)'
  const m = variant.match(/^sobre_(\d+)_(grande|chica)$/)
  return m ? `Sobre × ${m[1]} tabletas (${m[2]})` : variant
}

const LOT_MAX_AGE_DAYS = 30

function lotAgeDays(receivedAt) {
  const ms = Date.now() - new Date(receivedAt + 'T00:00:00').getTime()
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

export default function Inventory({ profile, readOnly = false }) {
  const [items, setItems] = useState([])
  const [powderVariants, setPowderVariants] = useState([]) // ['100g','50g',...] from pouch_catalog
  const [tabletVariants, setTabletVariants] = useState([]) // ['sobre_10_grande',...,'suelta_grande','suelta_chica']
  const [loading, setLoading] = useState(true)
  const [deltas, setDeltas] = useState({}) // `${sku}|${variant}` -> string input value
  const [saving, setSaving] = useState(null) // key currently being adjusted
  const [error, setError] = useState(null)

  // MatriSure kit lot tracking (Juan, 2026-07-31) — additive to the
  // aggregate `items` above, exists so the 30-day aging QA rule has a
  // received_at to check against. Receiving/destroying a lot also keeps the
  // aggregate inventory_items count in sync.
  const [lots, setLots] = useState([])
  const [lotForm, setLotForm] = useState({ sku: 'MatriPowder', variant: '', lot_number: '', quantity: '', received_at: new Date().toISOString().slice(0, 10) })
  const [lotSaving, setLotSaving] = useState(false)
  const [lotError, setLotError] = useState(null)
  const [destroyingLotId, setDestroyingLotId] = useState(null)
  const [destroyReason, setDestroyReason] = useState('')

  const orgId = profile?.org_id
  const skuVariants = { MatriPowder: powderVariants, MatriTablets: tabletVariants }

  const reloadItems = async () => {
    const { data } = await supabase.from('inventory_items').select('*').eq('org_id', orgId)
    setItems(data || [])
  }

  const reloadLots = async () => {
    const { data } = await supabase.from('matrisure_kit_lots').select('*').eq('org_id', orgId).eq('status', 'active').order('received_at', { ascending: true })
    setLots(data || [])
  }

  useEffect(() => {
    if (!orgId) return
    Promise.all([
      supabase.from('inventory_items').select('*').eq('org_id', orgId),
      supabase.from('pouch_catalog').select('*').eq('org_id', orgId).eq('active', true).order('size_g', { ascending: false }),
      supabase.from('tablet_catalog').select('*').eq('org_id', orgId).eq('active', true).order('envelope_count', { ascending: false }),
      supabase.from('matrisure_kit_lots').select('*').eq('org_id', orgId).eq('status', 'active').order('received_at', { ascending: true }),
    ]).then(([{ data: itemsData, error }, { data: pouches }, { data: envelopes }, { data: lotsData }]) => {
      if (error) console.error(error)
      setItems(itemsData || [])
      setPowderVariants((pouches || []).map(c => `${c.size_g}g`))
      const envelopeVariants = (envelopes || []).map(e => `sobre_${e.envelope_count}_${e.tablet_size}`)
      setTabletVariants([...envelopeVariants, 'suelta_grande', 'suelta_chica'])
      setLots(lotsData || [])
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
    await reloadItems()
  }

  const receiveLot = async () => {
    const quantity = Number(lotForm.quantity)
    if (!lotForm.variant || !lotForm.lot_number || !quantity) return
    setLotSaving(true)
    setLotError(null)

    const { error: lotInsertError } = await supabase.from('matrisure_kit_lots').insert({
      org_id: orgId, sku: lotForm.sku, variant: lotForm.variant, lot_number: lotForm.lot_number,
      quantity, received_at: lotForm.received_at, created_by: profile.id,
    })
    if (lotInsertError) { setLotSaving(false); setLotError(lotInsertError.message); return }

    const existing = items.find(i => i.sku === lotForm.sku && i.variant === lotForm.variant)
    const invResult = existing
      ? await supabase.from('inventory_items').update({ quantity: existing.quantity + quantity, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : await supabase.from('inventory_items').insert({ org_id: orgId, sku: lotForm.sku, variant: lotForm.variant, quantity })

    setLotSaving(false)
    if (invResult.error) { setLotError(invResult.error.message); return }

    setLotForm(prev => ({ ...prev, variant: '', lot_number: '', quantity: '' }))
    await Promise.all([reloadLots(), reloadItems()])
  }

  const destroyLot = async (lot) => {
    setLotSaving(true)
    setLotError(null)

    const { error: destroyError } = await supabase.from('matrisure_kit_lots').update({
      status: 'destroyed', destroyed_at: new Date().toISOString(), destroyed_by: profile.id, destroyed_reason: destroyReason || null,
    }).eq('id', lot.id)
    if (destroyError) { setLotSaving(false); setLotError(destroyError.message); return }

    const existing = items.find(i => i.sku === lot.sku && i.variant === lot.variant)
    if (existing) {
      await supabase.from('inventory_items').update({ quantity: Math.max(0, existing.quantity - lot.quantity), updated_at: new Date().toISOString() }).eq('id', existing.id)
    }

    setLotSaving(false)
    setDestroyingLotId(null)
    setDestroyReason('')
    await Promise.all([reloadLots(), reloadItems()])
  }

  const lotFormVariants = skuVariants[lotForm.sku] || []

  return (
    <>
    <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
      <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5'}}>
        <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Inventario</span>
        <div style={{fontSize:'11px', color:'#888', marginTop:'2px'}}>
          Stock disponible de tu propia organización. Se descuenta automáticamente cuando un cliente marca un Tratamiento como aplicado — este primer alcance no reparte stock por sub-distribuidor todavía.
        </div>
        <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>
          MatriTablets: los "Sobre × N" son paquetes cerrados, sin abrir — no se descuentan solos. Cuando abrís uno físicamente, restale 1 al sobre y sumale su cantidad a "Sueltas" a mano; los Tratamientos descuentan de ahí, y lo que sobra de un sobre abierto queda disponible para el siguiente.
        </div>
        {readOnly && (
          <div style={{fontSize:'11px', color:'#0c447c', marginTop:'6px', fontWeight:600}}>
            👁️ Vista de solo lectura — el ajuste de stock lo hace cada Distribuidor/Sub-distribuidor sobre su propio inventario.
          </div>
        )}
      </div>

      {error && <div style={{padding:'10px 20px', color:'#8b2020', fontSize:'12px', background:'#fdeaea'}}>⚠️ {error}</div>}
      {!loading && powderVariants.length === 0 && (
        <div style={{padding:'10px 20px', color:'#b06a00', fontSize:'12px', background:'#fff3cd'}}>
          ⚠️ Todavía no cargaste tamaños de sachet en "Catálogo de SKU" — MatriPowder no va a aparecer acá hasta que agregues al menos uno.
        </div>
      )}

      {loading ? (
        <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>Cargando…</div>
      ) : (
        <div className="table-scroll"><table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
          <thead>
            <tr>
              {(readOnly ? ['SKU','Variante','Stock actual'] : ['SKU','Variante','Stock actual','Ajustar (+/-)','']).map(h => (
                <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(skuVariants).map(([sku, variants]) => variants.map((variant, vi) => {
              const key = `${sku}|${variant}`
              const qty = quantityOf(sku, variant)
              return (
                <tr key={key} style={{borderBottom:'0.5px solid #ddddd5'}}>
                  {vi === 0 && (
                    <td rowSpan={variants.length} style={{padding:'12px 16px', fontWeight:700, verticalAlign:'top', borderRight:'0.5px solid #ddddd5'}}>
                      {SKU_LABEL[sku]}
                    </td>
                  )}
                  <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{sku === 'MatriPowder' ? variant : tabletVariantLabel(variant)}</td>
                  <td style={{padding:'12px 16px', fontWeight:700, color: qty < 0 ? '#8b2020' : '#0b4358'}}>{qty}</td>
                  {!readOnly && (
                    <>
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
                    </>
                  )}
                </tr>
              )
            }))}
          </tbody>
        </table></div>
      )}
    </div>

    {!readOnly && (
      <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)', marginTop:'16px'}}>
        <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Lotes de kits MatriSure</span>
          <div style={{fontSize:'11px', color:'#888', marginTop:'2px'}}>
            Directiva de calidad: un lote con más de {LOT_MAX_AGE_DAYS} días de antigüedad debe destruirse y reponerse con tarjetas nuevas. Registrá acá cada lote que recibís para poder controlar su antigüedad.
          </div>
        </div>

        {lotError && <div style={{padding:'10px 20px', color:'#8b2020', fontSize:'12px', background:'#fdeaea'}}>⚠️ {lotError}</div>}

        <div style={{padding:'16px 20px', borderBottom:'0.5px solid #ddddd5', display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'flex-end'}}>
          <div>
            <label style={{display:'block', fontSize:'11px', color:'#888', marginBottom:'4px'}}>SKU</label>
            <select value={lotForm.sku} onChange={e => setLotForm(prev => ({ ...prev, sku: e.target.value, variant: '' }))} style={{padding:'7px 8px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'13px'}}>
              <option value="MatriPowder">MatriPowder</option>
              <option value="MatriTablets">MatriTablets</option>
            </select>
          </div>
          <div>
            <label style={{display:'block', fontSize:'11px', color:'#888', marginBottom:'4px'}}>Variante</label>
            <select value={lotForm.variant} onChange={e => setLotForm(prev => ({ ...prev, variant: e.target.value }))} style={{padding:'7px 8px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'13px'}}>
              <option value="">Elegir…</option>
              {lotFormVariants.map(v => (
                <option key={v} value={v}>{lotForm.sku === 'MatriPowder' ? v : tabletVariantLabel(v)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{display:'block', fontSize:'11px', color:'#888', marginBottom:'4px'}}>N° de lote</label>
            <input value={lotForm.lot_number} onChange={e => setLotForm(prev => ({ ...prev, lot_number: e.target.value }))} placeholder="ej: 2026.07.31" style={{width:'120px', padding:'6px 8px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'13px'}}/>
          </div>
          <div>
            <label style={{display:'block', fontSize:'11px', color:'#888', marginBottom:'4px'}}>Cantidad</label>
            <input type="number" value={lotForm.quantity} onChange={e => setLotForm(prev => ({ ...prev, quantity: e.target.value }))} style={{width:'90px', padding:'6px 8px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'13px'}}/>
          </div>
          <div>
            <label style={{display:'block', fontSize:'11px', color:'#888', marginBottom:'4px'}}>Fecha de recepción</label>
            <input type="date" value={lotForm.received_at} onChange={e => setLotForm(prev => ({ ...prev, received_at: e.target.value }))} style={{padding:'6px 8px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'13px'}}/>
          </div>
          <button className="btn-secondary btn-sm" disabled={lotSaving || !lotForm.variant || !lotForm.lot_number || !lotForm.quantity} onClick={receiveLot}>
            Registrar lote
          </button>
        </div>

        {lots.length === 0 ? (
          <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>No hay lotes activos registrados todavía.</div>
        ) : (
          <div className="table-scroll"><table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
            <thead>
              <tr>
                {['SKU','Variante','N° de lote','Cantidad','Recibido','Antigüedad',''].map(h => (
                  <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lots.map(lot => {
                const age = lotAgeDays(lot.received_at)
                const expired = age > LOT_MAX_AGE_DAYS
                return (
                  <tr key={lot.id} style={{borderBottom:'0.5px solid #ddddd5'}}>
                    <td style={{padding:'12px 16px', fontWeight:700}}>{SKU_LABEL[lot.sku]}</td>
                    <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{lot.sku === 'MatriPowder' ? lot.variant : tabletVariantLabel(lot.variant)}</td>
                    <td style={{padding:'12px 16px', fontFamily:'monospace'}}>{lot.lot_number}</td>
                    <td style={{padding:'12px 16px'}}>{lot.quantity}</td>
                    <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{new Date(lot.received_at + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                    <td style={{padding:'12px 16px'}}>
                      {expired ? (
                        <span style={{background:'#fdeaea', color:'#8b2020', fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'100px'}}>⚠️ {age} días — vencido</span>
                      ) : (
                        <span style={{color:'#6b6b6b'}}>{age} días</span>
                      )}
                    </td>
                    <td style={{padding:'12px 16px'}}>
                      {destroyingLotId === lot.id ? (
                        <div style={{display:'flex', gap:'6px', alignItems:'center'}}>
                          <input
                            value={destroyReason}
                            onChange={e => setDestroyReason(e.target.value)}
                            placeholder="Motivo (opcional)"
                            style={{width:'130px', padding:'5px 7px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'12px'}}
                          />
                          <button className="btn-secondary btn-sm" disabled={lotSaving} onClick={() => destroyLot(lot)} style={{background:'#fdeaea', color:'#8b2020', border:'0.5px solid #f5c1c1'}}>Confirmar</button>
                          <button className="btn-secondary btn-sm" disabled={lotSaving} onClick={() => { setDestroyingLotId(null); setDestroyReason('') }}>Cancelar</button>
                        </div>
                      ) : (
                        <button className="btn-secondary btn-sm" onClick={() => setDestroyingLotId(lot.id)}>🗑️ Destruir</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </div>
    )}
    </>
  )
}
