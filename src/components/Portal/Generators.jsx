import { useState } from 'react'
import generatorImg  from '../../assets/images/MatriGenerator.png'
import generatorLogo from '../../assets/logos/MatriGenerator_Logo.svg'
import { getPrice, GENERATOR_PRICES, SERVICE_FEES } from '../../data/pricing'

const MY_GENERATORS = [
  { id:'GEN-012', type:'Generador MaTri', status:'approved', slabel:'✓ Disponible', review:'10 jun 2026', notes:'—' },
]

export default function Generators({ userTier = 'T1' }) {
  const [rooms,      setRooms]      = useState(3)
  const [treatments, setTreatments] = useState(2)
  const [vol,        setVol]        = useState(500)
  const [showRoi,    setShowRoi]    = useState(false)

  // Prices from pricing engine
  const genPurchase = getPrice(GENERATOR_PRICES.purchase, userTier, vol)
  const genRental   = getPrice(GENERATOR_PRICES.rental,   userTier, vol)
  const serviceFee  = getPrice(SERVICE_FEES.prices,       userTier, vol)

  // ROI calculation
  const totalRooms       = rooms * treatments          // total treatments per season
  const serviceCostTotal = totalRooms * serviceFee     // cost of managed service
  const rentalCostTotal  = totalRooms * genRental      // cost of renting each treatment
  const breakEvenTreatments = Math.ceil(genPurchase / serviceFee) // treatments to break even vs service
  const breakEvenRental     = Math.ceil(genPurchase / genRental)  // treatments to break even vs rental

  const recommendation = () => {
    if (totalRooms >= breakEvenTreatments) {
      return { label:'Comprar el generador', color:'#1a6b30', bg:'#eaf7ee', icon:'🏆', desc:`Con ${totalRooms} tratamientos por temporada el generador se amortiza en ${breakEvenTreatments} tratamientos. Ya conviene comprarlo.` }
    } else if (totalRooms >= 4) {
      return { label:'Alquilar por ahora', color:'#b06a00', bg:'#fff3cd', icon:'📅', desc:`Con ${totalRooms} tratamientos el alquiler es más conveniente. Cuando llegues a ${breakEvenTreatments} tratamientos por temporada conviene comprar.` }
    } else {
      return { label:'Servicio gestionado', color:'#0c447c', bg:'#e8f4fc', icon:'👷', desc:`Con ${totalRooms} tratamientos el servicio gestionado de Wassington es la opción más conveniente. Sin inversión inicial.` }
    }
  }

  const rec = recommendation()

  const fmtUSD = (v) => '$' + Number(v).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2})

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
          <button className="btn-secondary btn-sm" onClick={() => setShowRoi(!showRoi)}>
            {showRoi ? 'Ocultar cálculo' : 'Ver cálculo de conveniencia'}
          </button>
        </div>

        {showRoi && (
          <div className="card-body">
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'20px'}}>
              <div>
                <label style={{display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}}>
                  Cámaras con MatriPowder
                </label>
                <input
                  type="number" min="1" max="50"
                  value={rooms}
                  onChange={e => setRooms(Number(e.target.value))}
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
                  onChange={e => setTreatments(Number(e.target.value))}
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
                  onChange={e => setVol(Number(e.target.value))}
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8'}}
                />
              </div>
            </div>

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
                      total: fmtUSD(genPurchase) + ' (único pago)',
                      breakeven: `${breakEvenTreatments} tratamientos`,
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
              * Precios según Tier {userTier} y volumen promedio {vol} m³. El servicio gestionado incluye mano de obra de Wassington.
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
          <table className="data-table">
            <thead>
              <tr>
                <th>ID unidad</th><th>Tipo</th><th>Estado</th><th>Última revisión</th><th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {MY_GENERATORS.map((g, i) => (
                <tr key={i}>
                  <td style={{fontWeight:700, fontFamily:'monospace'}}>{g.id}</td>
                  <td>{g.type}</td>
                  <td><span className={`status ${g.status}`}>{g.slabel}</span></td>
                  <td style={{color:'var(--gray)'}}>{g.review}</td>
                  <td style={{color:'var(--gray)'}}>{g.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}