import { useState, useEffect, useMemo } from 'react'
import generatorImg  from '../../assets/images/MatriGenerator.png'
import generatorLogo from '../../assets/logos/MatriGenerator_Logo.svg'
import { supabase } from '../../lib/supabaseClient'
import { fetchOrgPricing, getGeneratorPrice, getServiceFee } from '../../lib/orgPricing'

const GENERATOR_STATUS_LABEL = {
  available: '✓ Disponible', dispatched: '📦 Despachado', on_rent: '📅 En alquiler',
  returned: '↩️ Devuelto', in_service: '🔧 En service', repaired: '✓ Reparado', out_of_service: '✗ Fuera de servicio',
}

export default function Generators({ orgId, seasonPlanLines = [], coldRooms = [] }) {
  const [pricing,      setPricing]      = useState({ brackets: [], product: [], serviceFee: [], generator: [] })
  const [myGenerators, setMyGenerators] = useState([])
  const [rooms,      setRooms]      = useState(3)
  const [treatments, setTreatments] = useState(2)
  const [vol,        setVol]        = useState(500)
  const [showRoi,    setShowRoi]    = useState(false)
  const [usedPlanData, setUsedPlanData] = useState(false)

  useEffect(() => { fetchOrgPricing().then(setPricing) }, [])

  useEffect(() => {
    if (!orgId) return
    supabase.from('generators').select('*').eq('org_id', orgId)
      .then(({ data }) => setMyGenerators(data || []))
  }, [orgId])

  // Only MatriPowder lines represent real generator demand — Tablets need no
  // generator, and "sin decidir" is too speculative to plan a fleet around.
  const planSummary = useMemo(() => {
    const powderLines = seasonPlanLines.filter(l => l.product_preference === 'powder')
    const roomVolumeById = new Map(coldRooms.map(r => [r.id, r.volume_m3]))
    const uniqueRoomIds = new Set(powderLines.map(l => l.cold_room_id))
    const totalTreatments = powderLines.length
    const avgVolume = totalTreatments > 0
      ? Math.round(powderLines.reduce((s, l) => s + (roomVolumeById.get(l.cold_room_id) || 0), 0) / totalTreatments)
      : 0

    // Concurrency: how many Powder rooms share the exact same planned date —
    // that's how many generators would be needed at once that day.
    const countByDate = {}
    powderLines.forEach(l => {
      if (!l.planned_date) return
      countByDate[l.planned_date] = (countByDate[l.planned_date] || 0) + 1
    })
    const maxSimultaneous = Object.values(countByDate).length > 0 ? Math.max(...Object.values(countByDate)) : 0

    return { totalTreatments, uniqueRooms: uniqueRoomIds.size, avgVolume, maxSimultaneous }
  }, [seasonPlanLines, coldRooms])

  const applyPlanData = () => {
    const { uniqueRooms, totalTreatments, avgVolume } = planSummary
    if (uniqueRooms === 0) return
    setRooms(uniqueRooms)
    setTreatments(Math.max(1, Math.round(totalTreatments / uniqueRooms)))
    setVol(avgVolume)
    setUsedPlanData(true)
    setShowRoi(true)
  }

  // Prices from the real pricing engine (this Organization's Distributor's tables)
  const { purchase_price: genPurchase, rental_price: genRental } = getGeneratorPrice(pricing, vol)
  const serviceFee = getServiceFee(pricing, vol)

  // ROI calculation
  const totalRooms       = rooms * treatments          // total treatments per season
  const serviceCostTotal = totalRooms * serviceFee     // cost of managed service
  const rentalCostTotal  = totalRooms * genRental      // cost of renting each treatment
  const breakEvenTreatments = serviceFee > 0 ? Math.ceil(genPurchase / serviceFee) : 0 // treatments to break even vs service
  const unitsToBuy = Math.max(1, planSummary.maxSimultaneous)

  const recommendation = () => {
    if (totalRooms >= breakEvenTreatments && breakEvenTreatments > 0) {
      return {
        label: 'Comprar el generador', color:'#1a6b30', bg:'#eaf7ee', icon:'🏆',
        desc: usedPlanData && planSummary.maxSimultaneous > 1
          ? `Con ${totalRooms} tratamientos por temporada el generador se amortiza en ${breakEvenTreatments} tratamientos. Además, tu Plan de Temporada muestra hasta ${planSummary.maxSimultaneous} cámaras tratándose el mismo día — te conviene comprar ${unitsToBuy} unidades, no solo una.`
          : `Con ${totalRooms} tratamientos por temporada el generador se amortiza en ${breakEvenTreatments} tratamientos. Ya conviene comprarlo.`,
      }
    } else if (totalRooms >= 4) {
      return { label:'Alquilar por ahora', color:'#b06a00', bg:'#fff3cd', icon:'📅', desc:`Con ${totalRooms} tratamientos el alquiler es más conveniente. Cuando llegues a ${breakEvenTreatments} tratamientos por temporada conviene comprar.` }
    } else {
      return { label:'Servicio gestionado', color:'#0c447c', bg:'#e8f4fc', icon:'👷', desc:`Con ${totalRooms} tratamientos el servicio gestionado de Wassington es la opción más conveniente. Sin inversión inicial.` }
    }
  }

  const rec = recommendation()

  const fmtUSD = (v) => '$' + Number(v || 0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2})

  const PRODUCTS = [
    { title:'Comprar generador', price: fmtUSD(genPurchase), desc:'Unidad profesional con ID individual. Incluye batería. Mejor opción para operaciones con múltiples cámaras.', btn:'Solicitar compra', style:'primary' },
    { title:'Batería recargable', price:'$95 USD', desc:'Batería de repuesto para el generador MaTri. Compatibilidad garantizada.', btn:'Solicitar compra', style:'primary' },
    { title:'Alquilar generador', price: `${fmtUSD(genRental)}/día`, desc:'Alquilá por los días que necesitás. Wassington confirma disponibilidad y realiza checklist previo.', btn:'Solicitar alquiler', style:'lime' },
  ]

  return (
    <div>
      <div className="alert warn">
        📞 Si un generador falla durante el alquiler, contactá a Wassington: <strong>+54 299 XXX-XXXX</strong>
      </div>

      {/* ROI Calculator */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">¿Conviene comprar el generador?</span>
          <div style={{display:'flex', gap:'8px'}}>
            {planSummary.uniqueRooms > 0 && (
              <button className="btn-lime btn-sm" onClick={applyPlanData}>📋 Usar mi Plan de Temporada</button>
            )}
            <button className="btn-secondary btn-sm" onClick={() => setShowRoi(!showRoi)}>
              {showRoi ? 'Ocultar cálculo' : 'Ver cálculo de conveniencia'}
            </button>
          </div>
        </div>

        {showRoi && (
          <div className="card-body">
            {usedPlanData && (
              <div className="alert info" style={{marginBottom:'16px'}}>
                📋 Estos números vienen de tu Plan de Temporada. Solo se consideran las líneas con producto MatriPowder para este análisis — MatriTablets no necesita generador, y las líneas "sin decidir" todavía no cuentan como demanda real.
              </div>
            )}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'20px'}}>
              <div>
                <label style={{display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}}>
                  Cámaras con MatriPowder
                </label>
                <input
                  type="number" min="1" max="50"
                  value={rooms}
                  onChange={e => { setRooms(Number(e.target.value)); setUsedPlanData(false) }}
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8'}}
                />
              </div>
              <div>
                <label style={{display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}}>
                  Tratamientos por cámara / temporada
                </label>
                <input
                  type="number" min="1" max="10"
                  value={treatments}
                  onChange={e => { setTreatments(Number(e.target.value)); setUsedPlanData(false) }}
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8'}}
                />
              </div>
              <div>
                <label style={{display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}}>
                  Volumen promedio de cámara (m³)
                </label>
                <input
                  type="number" min="50" step="50"
                  value={vol}
                  onChange={e => { setVol(Number(e.target.value)); setUsedPlanData(false) }}
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8'}}
                />
              </div>
            </div>

            {usedPlanData && (
              <div style={{display:'grid', gridTemplateColumns:'1fr', gap:'8px', marginBottom:'20px'}}>
                <div style={{background:'#f5f5ee', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'#0b4358'}}>
                  <strong>Cámaras tratándose el mismo día (pico de tu temporada):</strong> {planSummary.maxSimultaneous || 0}
                </div>
              </div>
            )}

            {/* Recommendation */}
            <div style={{background:rec.bg, border:`1px solid ${rec.color}`, borderRadius:'10px', padding:'16px 20px', marginBottom:'20px', display:'flex', alignItems:'flex-start', gap:'14px'}}>
              <div style={{fontSize:'28px'}}>{rec.icon}</div>
              <div>
                <div style={{fontSize:'14px', fontWeight:700, color:rec.color, marginBottom:'4px'}}>{rec.label}</div>
                <div style={{fontSize:'13px', color:'#444'}}>{rec.desc}</div>
              </div>
            </div>

            {/* Comparison table */}
            <div style={{background:'#fff', borderRadius:'10px', border:'0.5px solid #ddddd5', overflow:'hidden'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
                <thead>
                  <tr>
                    {['Opción', 'Costo por tratamiento', `Total (${totalRooms} tratamientos)`, 'Break-even'].map(h => (
                      <th key={h} style={{padding:'10px 16px', textAlign:'left', fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', background:'#f5f5ee', borderBottom:'0.5px solid #ddddd5'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      option: 'Servicio gestionado',
                      perTreatment: fmtUSD(serviceFee),
                      total: fmtUSD(serviceCostTotal),
                      breakeven: `Siempre disponible`,
                      highlight: rec.label === 'Servicio gestionado',
                    },
                    {
                      option: 'Alquiler de generador',
                      perTreatment: fmtUSD(genRental) + '/día',
                      total: fmtUSD(rentalCostTotal),
                      breakeven: `—`,
                      highlight: rec.label === 'Alquilar por ahora',
                    },
                    {
                      option: 'Compra del generador',
                      perTreatment: fmtUSD(genPurchase / Math.max(totalRooms, 1)) + '/trat.',
                      total: fmtUSD(genPurchase * unitsToBuy) + (unitsToBuy > 1 ? ` (${unitsToBuy} unidades)` : ' (único pago)'),
                      breakeven: breakEvenTreatments > 0 ? `${breakEvenTreatments} tratamientos` : '—',
                      highlight: rec.label === 'Comprar el generador',
                    },
                  ].map((r, i) => (
                    <tr key={i} style={{
                      borderBottom: i < 2 ? '0.5px solid #ddddd5' : 'none',
                      background: r.highlight ? '#f0f7e0' : '#fff',
                    }}>
                      <td style={{padding:'12px 16px', fontWeight: r.highlight ? 700 : 400}}>
                        {r.highlight && '✓ '}{r.option}
                      </td>
                      <td style={{padding:'12px 16px', fontFamily:'monospace'}}>{r.perTreatment}</td>
                      <td style={{padding:'12px 16px', fontWeight:700, fontFamily:'monospace'}}>{r.total}</td>
                      <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{r.breakeven}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{fontSize:'11px', color:'#888', marginTop:'10px'}}>
              * Precios según la tabla de tu distribuidor y volumen promedio {vol} m³. El servicio gestionado incluye mano de obra de Wassington.
            </div>
          </div>
        )}
      </div>

      {/* Product cards */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'20px'}}>
        {PRODUCTS.map((p, i) => (
          <div key={i} style={{background:'white', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'22px 18px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center'}}>
            <img src={generatorImg} alt="Generador" style={{height:'90px', objectFit:'contain', marginBottom:'12px', opacity: i===1 ? .6 : 1}}/>
            <img src={generatorLogo} alt="MaTri Generator" style={{height:'22px', objectFit:'contain', marginBottom:'10px'}}/>
            <div style={{fontSize:'20px', fontWeight:900, color:'var(--coral)', marginBottom:'6px'}}>{p.price}</div>
            <div style={{fontSize:'12px', color:'var(--gray)', marginBottom:'16px', lineHeight:1.6, flex:1}}>{p.desc}</div>
            <button className={p.style === 'lime' ? 'btn-lime' : 'btn-primary'} style={{width:'100%'}}>{p.btn}</button>
          </div>
        ))}
      </div>

      {/* My generators */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Mis generadores</span>
          <span style={{fontSize:'12px', color:'var(--gray)'}}>ID individual por unidad</span>
        </div>
        <div style={{padding:0}}>
          {myGenerators.length === 0 ? (
            <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>
              Todavía no tenés generadores propios. Si comprás uno, va a aparecer acá con seguimiento individual.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID unidad</th><th>N° de serie</th><th>Estado</th><th>Última revisión</th><th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {myGenerators.map(g => (
                  <tr key={g.id}>
                    <td style={{fontWeight:700, fontFamily:'monospace'}}>{g.unit_code}</td>
                    <td style={{fontFamily:'monospace', color:'var(--gray)'}}>{g.serial_number || '—'}</td>
                    <td><span className={`status ${g.status === 'available' ? 'approved' : 'pending'}`}>{GENERATOR_STATUS_LABEL[g.status] || g.status}</span></td>
                    <td style={{color:'var(--gray)'}}>{g.last_service_date || '—'}</td>
                    <td style={{color:'var(--gray)'}}>{g.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
