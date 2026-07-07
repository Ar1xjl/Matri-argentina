import { useState, useEffect, useMemo, useRef } from 'react'
import { fetchOrgPricing, getProductPrice } from '../../lib/orgPricing'
import { DOSE_BASE, greedyCeiling, comboGrams, actualPpb, tabletCombo } from '../../lib/dosing'
import { downloadPlanTemplate } from '../../lib/excelImport'

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

export default function SeasonPlan({
  plan, lines = [], coldRooms = [], onAddLine, onUpdateLine, onDeleteLine, onConvert,
  onImportPlan, onBulkSetProduct, onClearPlannedLines,
}) {
  const [pricing, setPricing] = useState({ brackets: [], product: [], serviceFee: [] })
  const [selected, setSelected] = useState(new Set())
  const [bulkProduct, setBulkProduct] = useState('powder')
  const [importResult, setImportResult] = useState(null) // { imported, errors, duplicates } | null
  const [importing, setImporting] = useState(false)
  const [pendingFile, setPendingFile] = useState(null) // file waiting on the replace/add choice
  const planFileInput = useRef(null)

  useEffect(() => { fetchOrgPricing().then(setPricing) }, [])

  const handleImport = async (file) => {
    if (!file) return
    setImporting(true)
    setImportResult(null)
    const result = await onImportPlan(file)
    setImporting(false)
    setImportResult(result)
  }

  // If there's already a planned line, ask whether this upload should
  // replace them or just add to them — re-uploading a similar file with no
  // warning is exactly how duplicates happen.
  const handleFileSelected = (file) => {
    if (!file) return
    const hasPlannedLines = lines.some(l => l.status === 'planned')
    if (hasPlannedLines) {
      setPendingFile(file)
    } else {
      handleImport(file)
    }
  }

  const resolvePendingImport = async (shouldClearFirst) => {
    const file = pendingFile
    setPendingFile(null)
    if (shouldClearFirst) await onClearPlannedLines()
    await handleImport(file)
  }

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

  const handleBulkApply = async () => {
    if (selectedPlannedLines.length === 0) return
    await onBulkSetProduct(selectedPlannedLines.map(l => l.id), bulkProduct)
  }

  return (
    <div>
      <div className="alert info" style={{marginBottom:'16px'}}>
        📋 Planificá tu temporada completa — cámara, fecha estimada y dosis por tratamiento. No es vinculante: podés ajustar todo antes de convertir una línea en un Tratamiento real.
      </div>

      {/* Excel import */}
      <div style={{...card, background:'#f9faf5'}}>
        <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358', marginBottom:'10px'}}>
          Carga rápida desde Excel
        </div>
        <div style={{display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'center'}}>
          <button className="btn-secondary btn-sm" onClick={downloadPlanTemplate}>📥 Descargar plantilla</button>
          <button className="btn-lime btn-sm" disabled={importing} onClick={() => planFileInput.current?.click()}>📤 Subir plan</button>
          <input ref={planFileInput} type="file" accept=".xlsx,.xls" style={{display:'none'}}
            onChange={e => { handleFileSelected(e.target.files[0]); e.target.value = '' }}/>
          {importing && <span style={{fontSize:'12px', color:'#888'}}>Importando…</span>}
        </div>
        <div style={{fontSize:'11px', color:'#888', marginTop:'6px'}}>
          Frigorífico, Cámara, Volumen y Dosis son opcionales salvo el nombre de la Cámara — podés subir solo lo que ya tengas y completar el resto acá abajo. El producto se elige después de subir, seleccionando filas y aplicándolo en conjunto.
        </div>

        {importResult && (
          <div style={{marginTop:'12px', fontSize:'12px'}}>
            <div style={{color:'#1a6b30', fontWeight:600}}>
              ✓ Se importaron {importResult.imported} registro{importResult.imported === 1 ? '' : 's'}.
            </div>
            {importResult.duplicates?.length > 0 && (
              <div style={{marginTop:'6px', color:'#b06a00'}}>
                {importResult.duplicates.length} fila{importResult.duplicates.length === 1 ? '' : 's'} no se volvieron a cargar por ser duplicadas (misma cámara + misma fecha ya planificada):
                <ul style={{margin:'4px 0 0', paddingLeft:'18px'}}>
                  {importResult.duplicates.map((d, i) => (
                    <li key={i}>{d.room}{d.date ? ` — ${d.date}` : ' — sin fecha'}</li>
                  ))}
                </ul>
              </div>
            )}
            {importResult.errors.length > 0 && (
              <div style={{marginTop:'6px', color:'#8b2020'}}>
                {importResult.errors.length} fila{importResult.errors.length === 1 ? '' : 's'} con problemas:
                <ul style={{margin:'4px 0 0', paddingLeft:'18px'}}>
                  {importResult.errors.map((e, i) => (
                    <li key={i}>{e.row !== '-' ? `Fila ${e.row}: ` : ''}{e.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
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
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'10px'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>{plan?.season_label || 'Temporada'}</span>
          <div style={{display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap'}}>
            <button className="btn-secondary btn-sm" onClick={onAddLine}>+ Agregar línea</button>

            {selectedPlannedLines.length > 0 && (
              <>
                <select style={{...inp, width:'auto'}} value={bulkProduct} onChange={e => setBulkProduct(e.target.value)}>
                  <option value="powder">MatriPowder</option>
                  <option value="tablets">MatriTablets</option>
                </select>
                <button className="btn-secondary btn-sm" onClick={handleBulkApply}>
                  Aplicar a seleccionadas ({selectedPlannedLines.length})
                </button>
              </>
            )}

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

      {pendingFile && (
        <div
          onClick={(e) => e.target === e.currentTarget && setPendingFile(null)}
          style={{position:'fixed', inset:0, background:'rgba(7,46,61,.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center'}}
        >
          <div style={{background:'#fff', borderRadius:'14px', padding:'28px', width:'100%', maxWidth:'440px', boxShadow:'0 8px 32px rgba(11,67,88,.2)'}}>
            <div style={{fontSize:'16px', fontWeight:800, color:'#0b4358', marginBottom:'10px'}}>
              Ya tenés cámaras planificadas para esta temporada
            </div>
            <div style={{fontSize:'13px', color:'#555', lineHeight:1.5, marginBottom:'18px'}}>
              ¿Querés borrarlas y cargar el archivo de nuevo desde cero, o agregar estas cámaras a las que ya tenés cargadas?
              Si el archivo trae la misma cámara para la misma fecha que ya está planificada, el sistema lo va a tomar como un duplicado y no lo va a cargar de nuevo.
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
              <button className="btn-primary" onClick={() => resolvePendingImport(false)}>
                Agregar a lo que ya tengo
              </button>
              <button className="btn-secondary" onClick={() => resolvePendingImport(true)}>
                Borrar lo planificado y cargar de nuevo
              </button>
              <button className="btn-secondary" style={{background:'none', border:'none', color:'#888'}} onClick={() => setPendingFile(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
