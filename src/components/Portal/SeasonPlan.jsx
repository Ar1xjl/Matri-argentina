import { useState, useEffect, useMemo } from 'react'
import { fetchOrgPricing, getProductPrice } from '../../lib/orgPricing'
import { DOSE_BASE, greedyCeiling, comboGrams, actualPpb, tabletCombo } from '../../lib/dosing'

function fmtUSD(v) { return '$' + Number(v || 0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2}) }

// Same "indicative cost" math as the Calculator — exact-dose Powder cost, or
// scaled Tablets cost. Undecided product has no indicative cost yet.
function computeIndicativeCost(pricing, product, targetDosePpb, volumeM3) {
  if (!volumeM3 || !targetDosePpb || product === 'undecided') return null
  if (product === 'tablets') {
    const { ppb } = tabletCombo(targetDosePpb, volumeM3)
    const price = getProductPrice(pricing, 'MatriTablets', volumeM3)
    return volumeM3 * price * (ppb / 1000)
  }
  const grams = volumeM3 * DOSE_BASE * (targetDosePpb / 1000)
  const combo = greedyCeiling(grams)
  const actualG = comboGrams(combo)
  const realPpb = actualPpb(actualG, volumeM3)
  const price = getProductPrice(pricing, 'MatriPowder', volumeM3)
  return volumeM3 * price * (realPpb / 1000)
}

const card = {background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'20px', marginBottom:'16px'}
const cell = {padding:'8px 10px', border:'0.5px solid #ddddd5', fontSize:'13px'}
const inp  = {width:'100%', padding:'6px 8px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'13px', color:'#0b4358', fontFamily:'inherit'}

export default function SeasonPlan({ plan, lines = [], coldRooms = [], onAddLine, onUpdateLine, onDeleteLine, onConvert }) {
  const [pricing, setPricing] = useState({ brackets: [], product: [], serviceFee: [] })
  const [selected, setSelected] = useState(new Set())

  useEffect(() => { fetchOrgPricing().then(setPricing) }, [])

  const enriched = useMemo(() => lines.map(l => {
    const room = coldRooms.find(r => r.id === l.cold_room_id)
    const cost = computeIndicativeCost(pricing, l.product_preference, l.planned_dose_ppb, room?.volume_m3)
    return { ...l, room, cost }
  }), [lines, coldRooms, pricing])

  const totals = useMemo(() => {
    const uniqueRooms = new Set(enriched.map(l => l.cold_room_id).filter(Boolean))
    const totalM3 = enriched.reduce((s, l) => s + (l.room?.volume_m3 || 0), 0)
    const totalCost = enriched.reduce((s, l) => s + (l.cost || 0), 0)
    return {
      rooms: uniqueRooms.size,
      applications: enriched.length,
      m3: totalM3,
      cost: totalCost,
      avgPerM3: totalM3 > 0 ? totalCost / totalM3 : 0,
    }
  }, [enriched])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedPlannedLines = enriched.filter(l => selected.has(l.id) && l.status === 'planned')

  const handleConvert = () => {
    if (selectedPlannedLines.length === 0) return
    onConvert(selectedPlannedLines)
    setSelected(new Set())
  }

  return (
    <div>
      <div className="alert info" style={{marginBottom:'16px'}}>
        📋 Planificá tu temporada completa — cámara, fecha estimada y dosis por tratamiento. No es vinculante: podés ajustar todo antes de convertir una línea en un Tratamiento real.
      </div>

      {/* Summary panel */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'14px', marginBottom:'16px'}}>
        {[
          ['Total cámaras', totals.rooms],
          ['Total aplicaciones', totals.applications],
          ['Total m³', totals.m3.toLocaleString('es-AR')],
          ['Costo total', fmtUSD(totals.cost)],
          ['Costo promedio $/m³', fmtUSD(totals.avgPerM3)],
        ].map(([label, value]) => (
          <div key={label} style={{background:'#0b4358', borderRadius:'12px', padding:'14px', textAlign:'center'}}>
            <div style={{fontSize:'10px', color:'rgba(255,255,255,.6)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:'4px'}}>{label}</div>
            <div style={{fontSize:'18px', fontWeight:800, color:'#fff'}}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:'11px', color:'#888', marginBottom:'16px', textAlign:'right'}}>
        Pagás por la dosis real que usás — no una tarifa fija que asume 1.000 ppb para todos los cultivos.
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>{plan?.season_label || 'Temporada'}</span>
          <div style={{display:'flex', gap:'10px'}}>
            <button className="btn-secondary btn-sm" onClick={onAddLine}>+ Agregar línea</button>
            <button
              className="btn-primary btn-sm"
              disabled={selectedPlannedLines.length === 0}
              style={{opacity: selectedPlannedLines.length === 0 ? .5 : 1}}
              onClick={handleConvert}
            >
              Convertir en Tratamiento{selectedPlannedLines.length > 0 ? ` (${selectedPlannedLines.length})` : ''}
            </button>
          </div>
        </div>

        {enriched.length === 0 ? (
          <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>
            No hay líneas planificadas todavía. Hacé click en "+ Agregar línea" para empezar.
          </div>
        ) : (
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr>
                {['', 'Cámara', 'Fecha estimada', 'Dosis (ppb)', 'Producto', 'Costo indicativo', 'Notas', 'Estado', ''].map(h => (
                  <th key={h} style={{...cell, background:'#f5f5ee', fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enriched.map(l => (
                <tr key={l.id}>
                  <td style={cell}>
                    <input type="checkbox" disabled={l.status !== 'planned'}
                      checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)}/>
                  </td>
                  <td style={cell}>
                    <select style={inp} value={l.cold_room_id || ''} disabled={l.status !== 'planned'}
                      onChange={e => onUpdateLine(l.id, { cold_room_id: e.target.value })}>
                      <option value="" disabled>Elegir cámara</option>
                      {coldRooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.volume_m3} m³)</option>)}
                    </select>
                  </td>
                  <td style={cell}>
                    <input style={inp} type="date" value={l.planned_date || ''} disabled={l.status !== 'planned'}
                      onChange={e => onUpdateLine(l.id, { planned_date: e.target.value || null })}/>
                  </td>
                  <td style={cell}>
                    <input style={inp} type="number" value={l.planned_dose_ppb ?? ''} disabled={l.status !== 'planned'}
                      onChange={e => onUpdateLine(l.id, { planned_dose_ppb: Number(e.target.value) || null })}/>
                  </td>
                  <td style={cell}>
                    <select style={inp} value={l.product_preference} disabled={l.status !== 'planned'}
                      onChange={e => onUpdateLine(l.id, { product_preference: e.target.value })}>
                      <option value="undecided">Sin decidir</option>
                      <option value="powder">MatriPowder</option>
                      <option value="tablets">MatriTablets</option>
                    </select>
                  </td>
                  <td style={{...cell, fontWeight:700, color:'#0b4358', whiteSpace:'nowrap'}}>
                    {l.cost != null ? fmtUSD(l.cost) : '—'}
                  </td>
                  <td style={cell}>
                    <input style={inp} type="text" defaultValue={l.notes || ''} disabled={l.status !== 'planned'}
                      onBlur={e => onUpdateLine(l.id, { notes: e.target.value || null })}/>
                  </td>
                  <td style={cell}>
                    <span className={`status ${l.status === 'converted' ? 'approved' : 'pending'}`}>
                      {l.status === 'converted' ? '✓ Convertida' : '⏳ Planificada'}
                    </span>
                  </td>
                  <td style={cell}>
                    {l.status === 'planned' && (
                      <button className="btn-secondary btn-sm" onClick={() => onDeleteLine(l.id)}>✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
