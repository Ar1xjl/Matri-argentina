import { useState, useEffect } from 'react'
import { POUCHES, DOSE_BASE, greedyCeiling, greedyFloor, comboGrams, actualPpb, tabletCombo } from '../../lib/dosing'
import { fetchOrgPricing, fetchCustomerOverride, fetchPouchCatalog, resolveProductPrice, resolveServiceFee } from '../../lib/orgPricing'

function fmtUSD(v) { return '$' + Number(v).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2}) }
function fmtNum(v, d=1) { return Number(v).toLocaleString('es-AR', {minimumFractionDigits:d, maximumFractionDigits:d}) }

// ── Styles ────────────────────────────────────────────────────────────────
const card    = {background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'24px', marginBottom:'16px'}
const lbl     = {display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}
const inp     = {width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8', fontFamily:'inherit'}
const calcBtn = {background:'#e8736a', color:'#fff', border:'none', borderRadius:'10px', padding:'13px 20px', fontSize:'15px', fontWeight:700, cursor:'pointer', width:'100%', marginTop:'8px', fontFamily:'inherit'}
const pouchRow = {display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', background:'#f5f5ee', borderRadius:'8px', marginBottom:'6px'}
const statBox  = {background:'#f5f5ee', borderRadius:'8px', padding:'8px 6px', textAlign:'center'}
const statLbl  = {fontSize:'9px', color:'#888', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:'3px'}
const statVal  = {fontSize:'15px', fontWeight:700, color:'#0b4358'}

export default function Calculator({ onTreatmentConfirmed, onNavigate, coldRooms = [], orgId = null, prefill = null, queueLength = 0 }) {
  const [pricing,    setPricing]    = useState({ brackets: [], product: [], serviceFee: [] })
  const [override,   setOverride]   = useState(null)
  const [pouchSizes, setPouchSizes] = useState(POUCHES) // real catalog replaces this fallback once loaded
  const [roomIdx,    setRoomIdx]    = useState(0)
  const [roomName,   setRoomName]   = useState('')
  const [ppb,        setPpb]        = useState('1000')
  const [doseSource, setDoseSource] = useState('manual') // 'manual' | 'doseright'
  const [results,    setResults]    = useState(null)   // { exact, adjusted, tablets }
  const [selected,   setSelected]   = useState(null)   // 'exact' | 'adjusted' | 'tablets'
  const [serviceModel, setServiceModel] = useState('self') // 'service' | 'self'
  const [treatmentSent, setTreatmentSent] = useState(false)

  // Load this Organization's pricing (RLS returns whatever ancestor Distributor's
  // tables are visible — see SYSTEM_ARCHITECTURE.md's pricing-visibility note).
  useEffect(() => {
    fetchOrgPricing().then(setPricing)
  }, [])

  // This Distributor's own editable pouch-size catalog (Fase E, 2026-07-12).
  useEffect(() => {
    fetchPouchCatalog().then(sizes => { if (sizes.length > 0) setPouchSizes(sizes) })
  }, [])

  // A negotiated price for this Customer, if one was set by their Distributor
  // (DOMAIN_MODEL.md Rule 36) — resolveProductPrice/resolveServiceFee below
  // fall back to standard list pricing automatically when this is null.
  useEffect(() => {
    if (!orgId) return
    fetchCustomerOverride(orgId).then(setOverride)
  }, [orgId])

  // Coming from Season Plan conversion — pre-fill room/dose, let the customer
  // review and adjust before actually sending, same as any other Treatment.
  // Adjusted during render (React's documented pattern for "sync state to a
  // changed prop") rather than in an effect, to avoid a cascade of separate
  // re-renders from several setState calls firing one after another.
  const [appliedPrefillId, setAppliedPrefillId] = useState(null)
  if (prefill && prefill.id !== appliedPrefillId && coldRooms.length > 0) {
    setAppliedPrefillId(prefill.id)
    const idx = coldRooms.findIndex(r => r.id === prefill.cold_room_id)
    if (idx >= 0) setRoomIdx(idx)
    if (prefill.planned_dose_ppb) setPpb(String(prefill.planned_dose_ppb))
    setDoseSource('manual')
    setResults(null)
    setSelected(null)
    setTreatmentSent(false)
  }

  // Listen for dose coming back from DoseRight module
  useEffect(() => {
    const handler = (e) => {
      if (e.data && e.data.type === 'MATRI_DOSE') {
        setPpb(String(e.data.ppb))
        setDoseSource('doseright')
        setResults(null)
        setSelected(null)
        setTreatmentSent(false)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  if (coldRooms.length === 0) {
    return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>Cargando cámaras...</div>
  }

  const vol    = coldRooms[roomIdx].volume_m3
  const ppbVal = parseFloat(ppb) || 1000

  const calculate = () => {
    const grams = vol * DOSE_BASE * (ppbVal / 1000)

    // Powder exact
    const exactC  = greedyCeiling(grams, pouchSizes)
    const exactG  = comboGrams(exactC)
    const exactPpb = actualPpb(exactG, vol)
    const powderPrice = resolveProductPrice(pricing, 'MatriPowder', vol, override)
    const exactCost = vol * powderPrice * (exactPpb / 1000)

    // Powder adjusted (floor)
    const adjC   = greedyFloor(grams, pouchSizes)
    const adjG   = comboGrams(adjC)
    const adjPpb = adjG > 0 ? actualPpb(adjG, vol) : 0
    const adjCost = vol * powderPrice * (adjPpb / 1000)

    // Service fee
    const serviceFee = resolveServiceFee(pricing, vol, override)

    // Tablets — count scales with target dose, same as powder grams
    const tabCombo  = tabletCombo(ppbVal, vol)
    const tabPrice  = resolveProductPrice(pricing, 'MatriTablets', vol, override)
    const tabCost   = vol * tabPrice * (tabCombo.ppb / 1000)

    setResults({
      exact:    { combo:exactC, grams:exactG, ppb:exactPpb, productCost:exactCost, serviceFee },
      adjusted: { combo:adjC,  grams:adjG,  ppb:adjPpb,  productCost:adjCost,  serviceFee, skip: adjG === exactG || adjG === 0 },
      tablets:  { ...tabCombo, productCost:tabCost },
      powderPrice, tabPrice, serviceFee,
    })
    setSelected(null)
    setTreatmentSent(false)
  }

  const sendTreatment = async () => {
    if (!selected || !results) return
    const r = selected === 'tablets' ? results.tablets : results[selected]
    const product = selected === 'tablets' ? 'tablets' : 'powder'
    const cost = selected === 'tablets'
      ? r.productCost
      : r.productCost + (serviceModel === 'service' ? r.serviceFee : 0)
    const targetDosePpb = results[selected].ppb

    setTreatmentSent(true)
    if (onTreatmentConfirmed) {
      await onTreatmentConfirmed({
        cold_room_id: coldRooms[roomIdx].id,
        product,
        target_dose_ppb: targetDosePpb,
        dose_source: doseSource,
        price_local: Number(cost.toFixed(2)),
        price_currency: 'USD', // simplification: single-currency demo data (see SYSTEM_ARCHITECTURE.md)
        service_fee_local: selected !== 'tablets' && serviceModel === 'service' ? r.serviceFee : null,
        plan_line_id: prefill?.origin === 'plan_line' ? prefill.id : null,
      })
    }
  }

  // ── Option card component ─────────────────────────────────────────────
  const OptionCard = ({ id, title, badge, children, cost, ppbVal: optPpb, productLabel, serviceFee }) => {
    const isSelected = selected === id
    return (
      <div
        onClick={() => { setSelected(id); setServiceModel('self'); setTreatmentSent(false) }}
        style={{
          borderRadius:'12px', border: isSelected ? '2px solid #0b4358' : '1.5px solid #ddddd5',
          padding:'18px', cursor:'pointer', background: isSelected ? '#f0f7ff' : '#fff',
          transition:'border-color .15s, background .15s', flex:1, minWidth:'200px'
        }}
      >
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px'}}>
          <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358'}}>{title}</div>
          {badge && <span style={{background:badge.bg, color:badge.color, fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'100px'}}>{badge.label}</span>}
        </div>
        {children}
        {cost !== undefined && (
          <div style={{borderTop:'0.5px solid #e0e0d8', marginTop:'12px', paddingTop:'12px'}}>
            {/* Itemized breakdown */}
            <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#555', marginBottom:'4px'}}>
              <span>Costo {productLabel}</span>
              <span>{fmtUSD(cost)}</span>
            </div>
            {serviceFee !== undefined && (
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#888', marginBottom:'4px'}}>
                <span>+ Servicio de aplicación (opcional)</span>
                <span>{fmtUSD(serviceFee)}</span>
              </div>
            )}

            {/* Dosis / $ per m³ / Total — only Total in bold */}
            <div style={{display:'grid', gridTemplateColumns: optPpb !== undefined ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap:'8px', marginTop:'10px'}}>
              {optPpb !== undefined && (
                <div style={statBox}>
                  <div style={statLbl}>Dosis</div>
                  <div style={{...statVal, fontWeight:400}}>{fmtNum(optPpb, 0)} ppb</div>
                </div>
              )}
              <div style={statBox}>
                <div style={statLbl}>$/m³</div>
                <div style={{...statVal, fontWeight:400}}>{fmtUSD(cost/vol)}</div>
              </div>
              <div style={statBox}>
                <div style={statLbl}>Total</div>
                <div style={statVal}>{fmtUSD(cost)}</div>
              </div>
            </div>

            {serviceFee !== undefined && (
              <div style={{fontSize:'10px', color:'#aaa', marginTop:'8px', textAlign:'center'}}>
                Total sin servicio · Con servicio gestionado: {fmtUSD(cost + serviceFee)}
              </div>
            )}
          </div>
        )}
        {isSelected && (
          <div style={{marginTop:'10px', background:'#e8f4fc', borderRadius:'8px', padding:'8px 10px', fontSize:'11px', color:'#0c447c', fontWeight:600}}>
            ✓ Seleccionado
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{maxWidth:'800px', margin:'0 auto'}}>

      {prefill && (
        <div className="alert info" style={{marginBottom:'14px'}}>
          {prefill.origin === 'repeat'
            ? '↺ Repitiendo un tratamiento anterior. Ajustá lo que haga falta y confirmá para enviarlo a Wassington.'
            : `🗓️ Revisando línea de tu Planificación de Temporada${queueLength > 1 ? ` — quedan ${queueLength} por revisar` : ''}. Ajustá lo que haga falta y confirmá para enviarla a Wassington.`}
        </div>
      )}

      {/* Admin bar */}
      <div style={{background:'#0b4358', color:'#fff', padding:'8px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:'12px', borderRadius:'8px 8px 0 0'}}>
        <span>{override ? 'Precio pactado con tu distribuidor aplicado a este cálculo' : 'Precios según la tabla configurada por tu distribuidor'}</span>
      </div>

      {/* Inputs */}
      <div style={card}>
        <div style={{fontSize:'15px', fontWeight:700, color:'#0b4358', marginBottom:'16px'}}>Datos de la cámara</div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px'}}>
          <div>
            <label style={lbl}>Cámara</label>
            <select style={inp} value={roomIdx} onChange={e => { setRoomIdx(Number(e.target.value)); setResults(null) }}>
              {coldRooms.map((r,i) => <option key={r.id} value={i}>{r.name}{r.organizations?.name ? ` — ${r.organizations.name}` : ''} ({r.volume_m3} m³)</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Nombre personalizado (opcional)</label>
            <input style={inp} type="text" value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Ej: Sector B — Peras"/>
          </div>
        </div>

        <div style={{marginBottom:'14px'}}>
          <label style={lbl}>Dosis objetivo (ppb)</label>
          <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <input style={{...inp, flex:1}} type="number" value={ppb} onChange={e => { setPpb(e.target.value); setDoseSource('manual'); setResults(null) }} min="100" max="5000" step="50"/>
            <button onClick={() => { setPpb('1000'); setDoseSource('manual') }} style={{background:'none', border:'0.5px solid #b5cc2e', color:'#3b6d11', borderRadius:'8px', padding:'10px 12px', fontSize:'12px', cursor:'pointer', whiteSpace:'nowrap'}}>
              Estándar (1.000 ppb)
            </button>
          </div>
          <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>
            Dosis estándar: 1.000 ppb = 0.067 g MatriPowder 3.3% por m³
          </div>
        </div>

        <div style={{background:'#f0f7e0', border:'1px solid #b5cc2e', borderRadius:'8px', padding:'12px 14px', marginBottom:'14px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{fontSize:'12px', fontWeight:700, color:'#3b6d11', marginBottom:'2px'}}>No sabés qué dosis usar?</div>
            <div style={{fontSize:'11px', color:'#555'}}>Consultá la calculadora científica DoseRight basada en parámetros de cosecha.</div>
          </div>
          <button
            onClick={() => window.open('https://ar1xjl.github.io/Matri-argentina/1mcp-dose-calculator.html', 'doseright', 'width=900,height=700,scrollbars=yes')}
            style={{background:'#0b4358', color:'#fff', border:'none', borderRadius:'8px', padding:'9px 14px', fontSize:'12px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', marginLeft:'12px', fontFamily:'inherit'}}
          >
            Abrir DoseRight
          </button>
        </div>

        <button style={calcBtn} onClick={calculate}>
          Calcular y comparar alternativas
        </button>
      </div>

      {/* Results — 3 alternatives */}
      {results && (
        <div>
          <div style={{fontSize:'15px', fontWeight:700, color:'#0b4358', marginBottom:'4px'}}>
            Compará las alternativas para {roomName || coldRooms[roomIdx].name} ({vol} m³)
          </div>
          <div style={{fontSize:'12px', color:'#888', marginBottom:'16px'}}>
            Dosis objetivo: {fmtNum(ppbVal, 0)} ppb · Hacé click en una alternativa para seleccionarla
          </div>

          <div style={{display:'flex', gap:'14px', flexWrap:'wrap', marginBottom:'20px'}}>

            {/* Option 1 — Powder exact */}
            <OptionCard
              id="exact"
              title="MatriPowder — Dosis exacta"
              badge={{label:'Dosis exacta', bg:'#e8f4fc', color:'#0c447c'}}
              cost={results.exact.productCost}
              ppbVal={results.exact.ppb}
              productLabel="MatriPowder"
              serviceFee={results.exact.serviceFee}
            >
              <div style={{marginBottom:'8px'}}>
                {results.exact.combo.filter(p=>p.qty>0).map(p => (
                  <div key={p.size} style={pouchRow}>
                    <div style={{background:'#0b4358', color:'#fff', borderRadius:'6px', padding:'2px 8px', fontSize:'11px', fontWeight:700}}>{p.size}g</div>
                    <div style={{fontSize:'12px', color:'#333', flex:1}}>Sachet {p.size}g</div>
                    <div style={{fontSize:'13px', fontWeight:700, color:'#e8736a'}}>×{p.qty}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:'11px', color:'#888'}}>{fmtNum(results.exact.grams, 1)} g totales</div>
            </OptionCard>

            {/* Option 2 — Powder adjusted */}
            {!results.adjusted.skip && (
              <OptionCard
                id="adjusted"
                title="MatriPowder — Dosis ajustada"
                badge={{label:'Sin sachet extra', bg:'#eaf7ee', color:'#1a6b30'}}
                cost={results.adjusted.productCost}
                ppbVal={results.adjusted.ppb}
                productLabel="MatriPowder"
                serviceFee={results.adjusted.serviceFee}
              >
                <div style={{marginBottom:'8px'}}>
                  {results.adjusted.combo.filter(p=>p.qty>0).map(p => (
                    <div key={p.size} style={pouchRow}>
                      <div style={{background:'#0b4358', color:'#fff', borderRadius:'6px', padding:'2px 8px', fontSize:'11px', fontWeight:700}}>{p.size}g</div>
                      <div style={{fontSize:'12px', color:'#333', flex:1}}>Sachet {p.size}g</div>
                      <div style={{fontSize:'13px', fontWeight:700, color:'#e8736a'}}>×{p.qty}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:'11px', color:'#888'}}>{fmtNum(results.adjusted.grams, 1)} g totales</div>
              </OptionCard>
            )}

            {/* Option 3 — Tablets */}
            <OptionCard
              id="tablets"
              title="MatriTablets"
              badge={{label:'Autoaplicación', bg:'#fff3cd', color:'#b06a00'}}
              cost={results.tablets.productCost}
              ppbVal={results.tablets.ppb}
              productLabel="MatriTablets"
            >
              <div style={{display:'flex', gap:'10px', marginBottom:'8px'}}>
                <div style={{flex:1, background:'#f5f5ee', borderRadius:'8px', padding:'10px', textAlign:'center'}}>
                  <div style={{fontSize:'11px', color:'#888', marginBottom:'2px'}}>Tableta grande (5m³)</div>
                  <div style={{fontSize:'20px', fontWeight:700, color:'#0b4358'}}>{results.tablets.large}</div>
                </div>
                <div style={{flex:1, background:'#f5f5ee', borderRadius:'8px', padding:'10px', textAlign:'center'}}>
                  <div style={{fontSize:'11px', color:'#888', marginBottom:'2px'}}>Tableta chica (2.5m³)</div>
                  <div style={{fontSize:'20px', fontWeight:700, color:'#0b4358'}}>{results.tablets.small}</div>
                </div>
              </div>
              <div style={{fontSize:'11px', color:'#888'}}>Cobertura: {fmtNum(vol, 1)} m³ · No requiere generador</div>
            </OptionCard>
          </div>

          {/* Service model selector — only for Powder options */}
          {selected && selected !== 'tablets' && (
            <div style={card}>
              <div style={{fontSize:'14px', fontWeight:700, color:'#0b4358', marginBottom:'12px'}}>
                Modelo de aplicación para MatriPowder
              </div>
              <div style={{display:'flex', gap:'12px'}}>
                <div
                  onClick={() => setServiceModel('service')}
                  style={{flex:1, borderRadius:'10px', border: serviceModel==='service' ? '2px solid #0b4358' : '1.5px solid #ddddd5', padding:'14px', cursor:'pointer', background: serviceModel==='service' ? '#f0f7ff' : '#fff'}}
                >
                  <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358', marginBottom:'4px'}}>Servicio gestionado</div>
                  <div style={{fontSize:'12px', color:'#888', marginBottom:'8px'}}>Wassington realiza la aplicación</div>
                  <div style={{fontSize:'16px', fontWeight:700, color:'#e8736a'}}>+{fmtUSD(results[selected].serviceFee)}</div>
                  <div style={{fontSize:'11px', color:'#888'}}>cargo fijo por cámara</div>
                </div>
                <div
                  onClick={() => setServiceModel('self')}
                  style={{flex:1, borderRadius:'10px', border: serviceModel==='self' ? '2px solid #0b4358' : '1.5px solid #ddddd5', padding:'14px', cursor:'pointer', background: serviceModel==='self' ? '#f0f7ff' : '#fff'}}
                >
                  <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358', marginBottom:'4px'}}>Autoaplicación</div>
                  <div style={{fontSize:'12px', color:'#888', marginBottom:'8px'}}>El cliente realiza el tratamiento</div>
                  <div style={{fontSize:'16px', fontWeight:700, color:'#1a6b30'}}>Sin cargo adicional</div>
                  <div style={{fontSize:'11px', color:'#888'}}>requiere generador MaTri</div>
                </div>
              </div>
            </div>
          )}

          {/* Cost summary */}
          {selected && (
            <div style={{background:'#0b4358', borderRadius:'12px', padding:'20px 24px', marginBottom:'16px'}}>
              <div style={{fontSize:'12px', fontWeight:700, color:'#b5cc2e', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'14px'}}>
                Resumen del tratamiento seleccionado
              </div>
              <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'14px'}}>
                {[
                  ['Producto', selected === 'tablets' ? 'MatriTablets' : 'MatriPowder'],
                  ['Cámara', `${vol} m³`],
                  ['Dosis', `${fmtNum(results[selected]?.ppb || 0, 0)} ppb`],
                ].map(([l,v]) => (
                  <div key={l} style={{background:'rgba(255,255,255,.08)', borderRadius:'8px', padding:'10px', textAlign:'center'}}>
                    <div style={{fontSize:'10px', color:'rgba(255,255,255,.5)', marginBottom:'3px', textTransform:'uppercase'}}>{l}</div>
                    <div style={{fontSize:'14px', fontWeight:700, color:'#fff'}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', borderTop:'0.5px solid rgba(255,255,255,.15)', paddingTop:'14px'}}>
                <div>
                  <div style={{fontSize:'13px', color:'rgba(255,255,255,.6)'}}>Costo producto</div>
                  <div style={{fontSize:'13px', color:'rgba(255,255,255,.6)', marginTop:'2px'}}>
                    {selected !== 'tablets' && serviceModel === 'service' && `Servicio de aplicación`}
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'13px', color:'#fff'}}>{fmtUSD(selected === 'tablets' ? results.tablets.productCost : results[selected]?.productCost || 0)}</div>
                  <div style={{fontSize:'13px', color:'#fff'}}>
                    {selected !== 'tablets' && serviceModel === 'service' && fmtUSD(results[selected]?.serviceFee || 0)}
                  </div>
                </div>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', borderTop:'0.5px solid rgba(181,204,46,.3)', paddingTop:'12px', marginTop:'8px'}}>
                <span style={{fontSize:'15px', fontWeight:700, color:'#b5cc2e'}}>Total estimado</span>
                <span style={{fontSize:'24px', fontWeight:800, color:'#fff'}}>
                  {fmtUSD(
                    selected === 'tablets'
                      ? results.tablets.productCost
                      : (results[selected]?.productCost || 0) + (serviceModel === 'service' ? (results[selected]?.serviceFee || 0) : 0)
                  )}
                </span>
              </div>
              <div style={{fontSize:'11px', color:'rgba(255,255,255,.4)', marginTop:'4px', textAlign:'right'}}>
                Precio indicativo · Wassington confirmará al aprobar
              </div>
            </div>
          )}

          {/* Confirm button */}
          {selected && !treatmentSent && (
            <button onClick={sendTreatment} style={{...calcBtn, background:'#0b4358', marginTop:'0'}}>
              Confirmar y enviar tratamiento
            </button>
          )}

          {treatmentSent && (
            <div style={{background:'#eaf7ee', border:'1px solid #a3d9b0', borderRadius:'10px', padding:'16px', textAlign:'center', fontSize:'13px', color:'#1a6b30', fontWeight:500}}>
              Tratamiento enviado a Wassington para aprobación
              <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>Revisá el estado en la sección Tratamientos</div>
              <button onClick={() => onNavigate && onNavigate('treatments')} style={{marginTop:'10px', background:'#0b4358', color:'#fff', border:'none', borderRadius:'8px', padding:'8px 16px', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'inherit'}}>
                Ver mis tratamientos
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{textAlign:'center', fontSize:'11px', color:'#aaa', padding:'16px 0'}}>
        MaTri DoseRight Calculator · Argentina · FreshInset 2026
      </div>
    </div>
  )
}
