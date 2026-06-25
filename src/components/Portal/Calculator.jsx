import { useState } from 'react'

const DOSE_TABLE = {
  Manzanas: { Europa: 0.5, USA: 0.6, Local: 0.4, Brasil: 0.45 },
  Peras:    { Europa: 0.45, USA: 0.55, Local: 0.35, Brasil: 0.4 },
  Kiwi:     { Europa: 0.6, USA: 0.65, Local: 0.5, Brasil: 0.55 },
}

const SKUS = [
  { name:'10g', grams:10,  price:4.5 },
  { name:'25g', grams:25,  price:9.8 },
  { name:'50g', grams:50,  price:18.5 },
  { name:'100g',grams:100, price:34.0 },
]

function optimizePouches(totalGrams) {
  let remaining = totalGrams
  const result = []
  ;[...SKUS].reverse().forEach(sku => {
    const qty = Math.floor(remaining / sku.grams)
    if (qty > 0) { result.push({...sku, qty}); remaining -= qty * sku.grams }
  })
  if (remaining > 0) { result.push({...SKUS[0], qty:1}); }
  return result
}

const ROOMS = [
  { name:'Cámara Norte 1', vol:500 },
  { name:'Cámara Norte 2', vol:620 },
  { name:'Cámara Sur 3',   vol:360 },
  { name:'Frigorífico A',  vol:240 },
]

const SERVICE_FEE = 150

export default function Calculator() {
  const [room,    setRoom]    = useState(0)
  const [crop,    setCrop]    = useState('Manzanas')
  const [market,  setMarket]  = useState('Europa')
  const [product, setProduct] = useState('MatriPowder')
  const [model,   setModel]   = useState('service')
  const [date,    setDate]    = useState('')

  const vol       = ROOMS[room].vol
  const doseRate  = DOSE_TABLE[crop]?.[market] ?? 0.5
  const totalG    = vol * doseRate
  const pouches   = optimizePouches(totalG)
  const productCost = pouches.reduce((sum, p) => sum + p.qty * p.price, 0)
  const serviceFee  = model === 'service' ? SERVICE_FEE : 0
  const total       = productCost + serviceFee

  return (
    <div>
      <div className="alert info">
        🧮 Completá los datos de la cámara y el cultivo. El sistema calculará la dosis exacta y la combinación óptima de sachets.
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>

        {/* Inputs */}
        <div className="card" style={{marginBottom:0}}>
          <div className="card-header"><span className="card-title">Parámetros</span></div>
          <div className="card-body">
            <div className="form-field">
              <label>Cámara</label>
              <select value={room} onChange={e => setRoom(Number(e.target.value))}>
                {ROOMS.map((r,i) => <option key={i} value={i}>{r.name} ({r.vol} m³)</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Cultivo</label>
              <select value={crop} onChange={e => setCrop(e.target.value)}>
                {Object.keys(DOSE_TABLE).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Mercado destino</label>
              <select value={market} onChange={e => setMarket(e.target.value)}>
                {['Europa','USA','Local','Brasil'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Fecha de aplicación</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}/>
            </div>
            <div className="form-field">
              <label>Producto</label>
              <select value={product} onChange={e => setProduct(e.target.value)}>
                <option value="MatriPowder">MatriPowder</option>
                <option value="MatriTablets">MatriTablets</option>
              </select>
            </div>
            <div className="form-field">
              <label>Modelo de servicio</label>
              <select value={model} onChange={e => setModel(e.target.value)}>
                <option value="service">Servicio gestionado — Wassington aplica (+$150 USD)</option>
                <option value="self">Autoaplicación — yo realizo el tratamiento</option>
              </select>
            </div>
          </div>
        </div>

        {/* Result */}
        <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
          <div style={{
            background:'var(--navy)', borderRadius:'var(--radius)',
            padding:'24px', color:'white'
          }}>
            <div style={{fontSize:'12px', fontWeight:700, color:'var(--lime)',
              textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'16px'}}>
              Resultado de la calculadora
            </div>

            {[
              ['Cámara',             ROOMS[room].name],
              ['Volumen',            `${vol} m³`],
              ['Dosis recomendada',  `${doseRate} g/m³`],
              ['Total activo requerido', `${totalG.toFixed(0)} g`],
              ['Cultivo',            crop],
              ['Mercado destino',    market],
              ['Producto',           product],
            ].map(([label, value]) => (
              <div key={label} style={{
                display:'flex', justifyContent:'space-between',
                padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,.1)',
                fontSize:'13px'
              }}>
                <span style={{color:'#90b8c8'}}>{label}</span>
                <span style={{fontWeight:700}}>{value}</span>
              </div>
            ))}

            {model === 'service' && (
              <div style={{
                display:'flex', justifyContent:'space-between',
                padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,.1)',
                fontSize:'13px'
              }}>
                <span style={{color:'#90b8c8'}}>Servicio de aplicación</span>
                <span style={{fontWeight:700}}>+$150.00</span>
              </div>
            )}

            <div style={{
              display:'flex', justifyContent:'space-between',
              padding:'14px 0 0', marginTop:'8px',
              borderTop:'1px solid rgba(168,200,50,.3)'
            }}>
              <span style={{fontSize:'15px', fontWeight:700, color:'var(--lime)'}}>
                Precio estimado (USD)
              </span>
              <span style={{fontSize:'22px', fontWeight:900}}>
                ${total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Pouch suggestion */}
          <div style={{
            background:'rgba(168,200,50,.12)', border:'1px solid rgba(168,200,50,.3)',
            borderRadius:'var(--radius)', padding:'16px'
          }}>
            <div style={{fontSize:'13px', fontWeight:700, color:'var(--navy)', marginBottom:'10px'}}>
              💡 Combinación óptima de sachets
            </div>
            {pouches.map((p,i) => (
              <div key={i} style={{
                display:'flex', justifyContent:'space-between',
                fontSize:'13px', color:'var(--navy)', padding:'4px 0'
              }}>
                <span>{p.qty} × {product} {p.name}</span>
                <span style={{fontWeight:700}}>{p.qty * p.grams}g</span>
              </div>
            ))}
            <div style={{
              borderTop:'1px solid rgba(168,200,50,.3)', marginTop:'8px',
              paddingTop:'8px', display:'flex', justifyContent:'space-between',
              fontSize:'13px', fontWeight:800, color:'var(--navy)'
            }}>
              <span>Total</span>
              <span>{pouches.reduce((s,p) => s + p.qty*p.grams, 0)}g</span>
            </div>
          </div>

          <button className="btn-primary" style={{width:'100%', padding:'14px', fontSize:'15px'}}>
            Confirmar y enviar pedido
          </button>
          <div style={{fontSize:'11px', color:'var(--gray)', textAlign:'center'}}>
            Precio indicativo. Wassington confirmará al aprobar el pedido.
          </div>
        </div>
      </div>
    </div>
  )
}