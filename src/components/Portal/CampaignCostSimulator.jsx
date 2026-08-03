import { useState, useMemo } from 'react'
import { DOSE_BASE, greedyCeiling, greedyFloor, comboGrams, actualPpb, tabletCombo } from '../../lib/dosing'
import { resolveProductPrice, resolveServiceFee, getGeneratorPrice, getServiceFee } from '../../lib/orgPricing'

function fmtUSD(v) { return '$' + Number(v || 0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2}) }
function fmtNum(v, d=1) { return Number(v || 0).toLocaleString('es-AR', {minimumFractionDigits:d, maximumFractionDigits:d}) }

const card = {background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'20px', marginBottom:'16px'}

// Per-room math — same formulas as Calculator.jsx, run once per Cámara instead
// of once for a single room, so the whole campaign's cost can be totaled.
function computeRoomOptions(line, pricing, override, pouchSizes) {
  const vol = line.room?.volume_m3
  const ppbTarget = line.planned_dose_ppb
  if (!vol || !ppbTarget || line.product_preference === 'undecided') return null

  if (line.product_preference === 'tablets') {
    const combo = tabletCombo(ppbTarget, vol)
    const price = resolveProductPrice(pricing, 'MatriTablets', vol, override)
    const cost = vol * price * (combo.ppb / 1000)
    return { kind: 'tablets', vol, ppb: combo.ppb, cost }
  }

  const grams = vol * DOSE_BASE * (ppbTarget / 1000)
  const powderPrice = resolveProductPrice(pricing, 'MatriPowder', vol, override)

  const exactC = greedyCeiling(grams, pouchSizes)
  const exactG = comboGrams(exactC)
  const exactPpb = actualPpb(exactG, vol)
  const exactCost = vol * powderPrice * (exactPpb / 1000)

  const floorC = greedyFloor(grams, pouchSizes)
  const floorG = comboGrams(floorC)
  const floorPpb = floorG > 0 ? actualPpb(floorG, vol) : 0
  const floorCost = vol * powderPrice * (floorPpb / 1000)
  const skipFloor = floorG === exactG || floorG === 0

  const serviceFee = resolveServiceFee(pricing, vol, override)

  return { kind: 'powder', vol, exactPpb, exactCost, floorPpb, floorCost, skipFloor, serviceFee }
}

export default function CampaignCostSimulator({ lines = [], pricing, override, pouchSizes, onClose, onNavigate }) {
  const [roundingByLine, setRoundingByLine] = useState({}) // { [lineId]: 'exact' | 'floor' }
  const [serviceModel, setServiceModel] = useState('self') // 'self' | 'service' — applies to every Powder room at once

  const rooms = useMemo(() => {
    return lines.map(l => ({ line: l, options: computeRoomOptions(l, pricing, override, pouchSizes) }))
  }, [lines, pricing, override, pouchSizes])

  const included = rooms.filter(r => r.options)
  const excluded = rooms.filter(r => !r.options)
  const powderRooms = included.filter(r => r.options.kind === 'powder')
  const tabletRooms = included.filter(r => r.options.kind === 'tablets')

  const totals = useMemo(() => {
    let productCost = 0
    let serviceCost = 0
    let totalM3 = 0
    powderRooms.forEach(r => {
      const choice = roundingByLine[r.line.id] === 'floor' && !r.options.skipFloor ? 'floor' : 'exact'
      productCost += choice === 'floor' ? r.options.floorCost : r.options.exactCost
      if (serviceModel === 'service') serviceCost += r.options.serviceFee
      totalM3 += r.options.vol
    })
    tabletRooms.forEach(r => {
      productCost += r.options.cost
      totalM3 += r.options.vol
    })
    const total = productCost + serviceCost
    return { productCost, serviceCost, total, totalM3, costPerM3: totalM3 > 0 ? total / totalM3 : 0 }
  }, [powderRooms, tabletRooms, roundingByLine, serviceModel])

  // Same buy-vs-service math as Generators.jsx's ROI calculator (rental por
  // día discontinued, DOMAIN_MODEL.md Rule 39 update), just framed here as a
  // decision that already knows the real planned application count instead
  // of asking the customer to guess it.
  const roi = useMemo(() => {
    if (powderRooms.length === 0) return null
    const avgVol = powderRooms.reduce((s, r) => s + r.options.vol, 0) / powderRooms.length
    const { purchase_price: genPurchase } = getGeneratorPrice(pricing, avgVol)
    const repFee = getServiceFee(pricing, avgVol)
    const totalTreatments = powderRooms.length
    const breakEven = repFee > 0 ? Math.ceil(genPurchase / repFee) : 0
    let rec
    if (totalTreatments >= breakEven && breakEven > 0) {
      rec = { label: 'Comprar el generador', color:'#1a6b30', bg:'#eaf7ee', icon:'🏆',
        desc: `Con ${totalTreatments} aplicaciones de MatriPowder planificadas, el generador se amortiza en ${breakEven} tratamientos — ya te conviene comprarlo en vez de pagar el servicio por cada aplicación.` }
    } else {
      rec = { label: 'Servicio gestionado', color:'#0c447c', bg:'#e8f4fc', icon:'👷',
        desc: `Con solo ${totalTreatments} aplicación${totalTreatments === 1 ? '' : 'es'} planificada${totalTreatments === 1 ? '' : 's'}, el servicio gestionado de Wassington es la opción más conveniente — sin inversión inicial.` }
    }
    return { ...rec, totalTreatments, breakEven }
  }, [powderRooms, pricing])

  const setRounding = (lineId, value) => setRoundingByLine(prev => ({ ...prev, [lineId]: value }))

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose?.()} style={{position:'fixed', inset:0, background:'rgba(7,46,61,.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'30px 20px', overflowY:'auto'}}>
      <div style={{background:'#f5f5ee', borderRadius:'14px', padding:'26px', width:'100%', maxWidth:'960px', boxShadow:'0 8px 32px rgba(11,67,88,.25)'}}>

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'18px'}}>
          <div>
            <div style={{fontSize:'18px', fontWeight:800, color:'#0b4358'}}>🧮 Simulador del costo total por campaña</div>
            <div style={{fontSize:'12px', color:'#666', marginTop:'2px'}}>
              {included.length} cámara{included.length === 1 ? '' : 's'} incluida{included.length === 1 ? '' : 's'} en el cálculo
              {excluded.length > 0 ? ` · ${excluded.length} sin producto o dosis definida (no incluida${excluded.length === 1 ? '' : 's'})` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{background:'none', border:'none', fontSize:'20px', color:'#888', cursor:'pointer', lineHeight:1}}>✕</button>
        </div>

        {included.length === 0 ? (
          <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>
            Ninguna de las cámaras elegidas tiene producto y dosis definidos todavía — completá eso en la tabla antes de simular el costo.
          </div>
        ) : (
          <>
            {/* Per-room rounding choice, Powder only */}
            {powderRooms.length > 0 && (
              <div style={card}>
                <div style={{fontSize:'14px', fontWeight:700, color:'#0b4358', marginBottom:'4px'}}>Redondeo de dosis por cámara — MatriPowder</div>
                <div style={{fontSize:'11px', color:'#888', marginBottom:'14px'}}>
                  Debido a la limitación del tamaño de los sobres, la dosis debe redondearse hacia arriba o hacia abajo. Seleccioná tu preferencia para cada cámara.
                </div>
                {powderRooms.map(r => {
                  const choice = roundingByLine[r.line.id] === 'floor' && !r.options.skipFloor ? 'floor' : 'exact'
                  return (
                    <div key={r.line.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', padding:'10px 12px', background:'#fafaf8', borderRadius:'8px', marginBottom:'8px', flexWrap:'wrap'}}>
                      <div style={{minWidth:'160px'}}>
                        <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358'}}>{r.line.room?.name}</div>
                        <div style={{fontSize:'11px', color:'#888'}}>{r.options.vol} m³ · {fmtNum(r.line.planned_dose_ppb, 0)} ppb objetivo</div>
                      </div>
                      <div style={{display:'flex', gap:'6px'}}>
                        <button
                          onClick={() => setRounding(r.line.id, 'exact')}
                          style={{fontSize:'11px', fontWeight:700, padding:'6px 10px', borderRadius:'7px', cursor:'pointer', border: choice==='exact' ? '2px solid #0b4358' : '1px solid #ddddd5', background: choice==='exact' ? '#f0f7ff' : '#fff', color:'#0b4358'}}
                        >
                          Dosis base · {fmtNum(r.options.exactPpb, 0)} ppb · {fmtUSD(r.options.exactCost)}
                        </button>
                        {!r.options.skipFloor && (
                          <button
                            onClick={() => setRounding(r.line.id, 'floor')}
                            style={{fontSize:'11px', fontWeight:700, padding:'6px 10px', borderRadius:'7px', cursor:'pointer', border: choice==='floor' ? '2px solid #0b4358' : '1px solid #ddddd5', background: choice==='floor' ? '#f0f7ff' : '#fff', color:'#0b4358'}}
                          >
                            Dosis ajustada · {fmtNum(r.options.floorPpb, 0)} ppb · {fmtUSD(r.options.floorCost)}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tabletRooms.length > 0 && (
              <div style={card}>
                <div style={{fontSize:'14px', fontWeight:700, color:'#0b4358', marginBottom:'4px'}}>MatriTablets — autoaplicación</div>
                <div style={{fontSize:'11px', color:'#888', marginBottom:'14px'}}>Sin cargo de servicio ni elección de redondeo — la cantidad de tabletas ya está optimizada para la dosis objetivo.</div>
                {tabletRooms.map(r => (
                  <div key={r.line.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'#fafaf8', borderRadius:'8px', marginBottom:'8px'}}>
                    <div>
                      <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358'}}>{r.line.room?.name}</div>
                      <div style={{fontSize:'11px', color:'#888'}}>{r.options.vol} m³ · {fmtNum(r.options.ppb, 0)} ppb</div>
                    </div>
                    <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358'}}>{fmtUSD(r.options.cost)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Global self-apply vs service model, Powder only */}
            {powderRooms.length > 0 && (
              <div style={card}>
                <div style={{fontSize:'14px', fontWeight:700, color:'#0b4358', marginBottom:'12px'}}>
                  Modelo de aplicación para MatriPowder — {powderRooms.length} aplicación{powderRooms.length === 1 ? '' : 'es'} planificada{powderRooms.length === 1 ? '' : 's'}
                </div>
                <div style={{display:'flex', gap:'12px', marginBottom: roi ? '14px' : 0}}>
                  <div
                    onClick={() => setServiceModel('service')}
                    style={{flex:1, borderRadius:'10px', border: serviceModel==='service' ? '2px solid #0b4358' : '1.5px solid #ddddd5', padding:'14px', cursor:'pointer', background: serviceModel==='service' ? '#fff' : '#fafaf8'}}
                  >
                    <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358', marginBottom:'4px'}}>Servicio gestionado</div>
                    <div style={{fontSize:'12px', color:'#888', marginBottom:'8px'}}>Wassington realiza todas las aplicaciones</div>
                    <div style={{fontSize:'16px', fontWeight:700, color:'#e8736a'}}>+{fmtUSD(powderRooms.reduce((s,r)=>s+r.options.serviceFee,0))}</div>
                    <div style={{fontSize:'11px', color:'#888'}}>total por la campaña</div>
                  </div>
                  <div
                    onClick={() => setServiceModel('self')}
                    style={{flex:1, borderRadius:'10px', border: serviceModel==='self' ? '2px solid #0b4358' : '1.5px solid #ddddd5', padding:'14px', cursor:'pointer', background: serviceModel==='self' ? '#fff' : '#fafaf8'}}
                  >
                    <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358', marginBottom:'4px'}}>Autoaplicación</div>
                    <div style={{fontSize:'12px', color:'#888', marginBottom:'8px'}}>El cliente realiza el tratamiento</div>
                    <div style={{fontSize:'16px', fontWeight:700, color:'#1a6b30'}}>Sin cargo adicional</div>
                    <div style={{fontSize:'11px', color:'#888'}}>requiere generador MaTri</div>
                  </div>
                </div>

                {roi && (
                  <div style={{background:roi.bg, border:`1px solid ${roi.color}`, borderRadius:'10px', padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:'12px'}}>
                    <div style={{fontSize:'22px'}}>{roi.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'13px', fontWeight:700, color:roi.color, marginBottom:'3px'}}>{roi.label}</div>
                      <div style={{fontSize:'12px', color:'#444'}}>{roi.desc}</div>
                    </div>
                    {onNavigate && (
                      <button onClick={() => { onClose?.(); onNavigate('generators') }} style={{background:'none', border:`1px solid ${roi.color}`, color:roi.color, borderRadius:'7px', padding:'7px 10px', fontSize:'11px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit'}}>
                        Ver en Generadores →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Final total */}
            <div style={{background:'#0b4358', borderRadius:'12px', padding:'20px 24px'}}>
              <div style={{fontSize:'12px', fontWeight:700, color:'#b5cc2e', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'14px'}}>
                Costo total estimado de la campaña
              </div>
              <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'14px'}}>
                {[
                  ['Cámaras', included.length],
                  ['Total m³', fmtNum(totals.totalM3, 0)],
                  ['$/m³', fmtUSD(totals.costPerM3)],
                ].map(([l,v]) => (
                  <div key={l} style={{background:'rgba(255,255,255,.08)', borderRadius:'8px', padding:'10px', textAlign:'center'}}>
                    <div style={{fontSize:'10px', color:'rgba(255,255,255,.5)', marginBottom:'3px', textTransform:'uppercase'}}>{l}</div>
                    <div style={{fontSize:'14px', fontWeight:700, color:'#fff'}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', borderTop:'0.5px solid rgba(255,255,255,.15)', paddingTop:'14px'}}>
                <div style={{fontSize:'13px', color:'rgba(255,255,255,.6)'}}>
                  Costo producto
                  {totals.serviceCost > 0 && <div style={{marginTop:'2px'}}>Servicio de aplicación</div>}
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'13px', color:'#fff'}}>{fmtUSD(totals.productCost)}</div>
                  {totals.serviceCost > 0 && <div style={{fontSize:'13px', color:'#fff', marginTop:'2px'}}>{fmtUSD(totals.serviceCost)}</div>}
                </div>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', borderTop:'0.5px solid rgba(181,204,46,.3)', paddingTop:'12px', marginTop:'8px'}}>
                <span style={{fontSize:'15px', fontWeight:700, color:'#b5cc2e'}}>Total estimado</span>
                <span style={{fontSize:'24px', fontWeight:800, color:'#fff'}}>{fmtUSD(totals.total)}</span>
              </div>
              <div style={{fontSize:'11px', color:'rgba(255,255,255,.4)', marginTop:'6px', textAlign:'right'}}>
                Estimación indicativa — no modifica tu Plan de Temporada
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
