import { useState, useEffect } from 'react'

const POUCHES   = [100, 50, 20, 10]
const DOSE_BASE = 0.067

function greedyCeiling(g) {
  let rem = g, r = []
  for (const s of POUCHES) { const q = Math.floor(rem/s); r.push({size:s,qty:q}); rem -= q*s }
  if (rem > 0.001) r[r.length-1].qty += 1
  return r
}
function greedyFloor(g) {
  let rem = g, r = []
  for (const s of POUCHES) { const q = Math.floor(rem/s); r.push({size:s,qty:q}); rem -= q*s }
  return r
}
function comboGrams(c) { return c.reduce((s,p) => s + p.size*p.qty, 0) }
function comboLabel(c) { return c.filter(p=>p.qty>0).map(p=>p.qty+' x '+p.size+'g').join(' + ') || '-' }
function actualPpb(g, vol) { return (g/(vol*DOSE_BASE))*1000 }
function fmtUSD(v) { return '$'+v.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}) }
function fmtNum(v,d=1) { return v.toLocaleString('es-AR',{minimumFractionDigits:d,maximumFractionDigits:d}) }

const card  = {background:'#fff',borderRadius:'12px',border:'0.5px solid #ddddd5',padding:'24px',marginBottom:'16px'}
const label = {display:'block',fontSize:'13px',fontWeight:500,color:'#0b4358',marginBottom:'5px'}
const inp   = {width:'100%',padding:'10px 12px',borderRadius:'8px',border:'0.5px solid #ccc',fontSize:'14px',color:'#0b4358',background:'#fafaf8',fontFamily:'inherit'}
const calcBtn = {background:'#e8736a',color:'#fff',border:'none',borderRadius:'10px',padding:'13px 20px',fontSize:'15px',fontWeight:700,cursor:'pointer',width:'100%',marginTop:'8px',fontFamily:'inherit'}
const metricBox = {background:'#f5f5ee',borderRadius:'8px',padding:'12px',textAlign:'center'}
const pouchRow  = {display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',background:'#f5f5ee',borderRadius:'8px',marginBottom:'6px'}

export default function Calculator() {
  const [product,    setProduct]    = useState('powder')
  const [adminOpen,  setAdminOpen]  = useState(false)
  const [pricePerM3, setPricePerM3] = useState(0.85)
  const [adminPrice, setAdminPrice] = useState('0.85')
  const [roomName,   setRoomName]   = useState('')
  const [volume,     setVolume]     = useState('')
  const [ppb,        setPpb]        = useState('1000')
  const [result,     setResult]     = useState(null)
  const [selected,   setSelected]   = useState(null)
  const [orderSent,  setOrderSent]  = useState(false)

  // Listen for dose coming back from DoseRight module
  useEffect(() => {
    const handler = (e) => {
      if (e.data && e.data.type === 'MATRI_DOSE') {
        setPpb(String(e.data.ppb))
        setProduct('powder')
        window.scrollTo(0, 0)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])
  const [roomNameT,  setRoomNameT]  = useState('')
  const [volumeT,    setVolumeT]    = useState('')
  const [resultT,    setResultT]    = useState(null)

  const calcCost = (vol, ppbVal) => vol * pricePerM3 * (ppbVal/1000)

  const calcPowder = () => {
    const vol  = parseFloat(volume)
    const ppbV = parseFloat(ppb)
    if (!vol || vol <= 0) return
    const grams     = vol * DOSE_BASE * (ppbV/1000)
    const exactC    = greedyCeiling(grams)
    const adjC      = greedyFloor(grams)
    const exactG    = comboGrams(exactC)
    const adjG      = comboGrams(adjC)
    const exactExcess = (exactG - grams)/grams*100
    const needsChoice = exactExcess > 1.0 && adjG > 0 && adjG !== exactG
    setResult({vol, ppbV, grams, exactC, adjC, exactG, adjG, exactExcess, needsChoice})
    setSelected(null)
    setOrderSent(false)
  }

  const calcTablets = () => {
    const vol = parseFloat(volumeT)
    if (!vol || vol <= 0) return
    const large   = Math.floor(vol/5)
    const rem     = vol - large*5
    const small   = Math.ceil(rem/2.5)
    const covered = large*5 + small*2.5
    const cost    = calcCost(covered, 1000)
    setResultT({vol, large, small, covered, cost})
  }

  const activeCombo = result && selected ? (selected==='exact' ? result.exactC : result.adjC) : result?.exactC
  const activeG     = activeCombo ? comboGrams(activeCombo) : 0
  const activePpb   = result ? actualPpb(activeG, result.vol) : 0
  const activeCost  = result ? calcCost(result.vol, activePpb) : 0

  return (
    <div style={{maxWidth:'720px',margin:'0 auto'}}>

      <div style={{background:'#0b4358',color:'#fff',padding:'8px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'12px',borderRadius:'8px 8px 0 0'}}>
        <span>Panel de administracion - Wassington</span>
        <button onClick={() => setAdminOpen(!adminOpen)} style={{background:'none',border:'0.5px solid rgba(255,255,255,.4)',borderRadius:'6px',color:'#fff',padding:'4px 12px',fontSize:'11px',cursor:'pointer'}}>
          Configurar precio
        </button>
      </div>

      {adminOpen && (
        <div style={{background:'#0d3f54',padding:'16px 20px',borderBottom:'2px solid #b5cc2e',marginBottom:'16px'}}>
          <div style={{fontSize:'11px',fontWeight:700,color:'#b5cc2e',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:'12px'}}>Parametros de precio</div>
          <div style={{display:'flex',gap:'12px',alignItems:'flex-end',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:'160px'}}>
              <div style={{fontSize:'11px',color:'rgba(255,255,255,.6)',marginBottom:'4px'}}>Precio base a 1.000 ppb ($/m3)</div>
              <input style={{...inp,background:'rgba(255,255,255,.1)',border:'0.5px solid rgba(255,255,255,.3)',color:'#fff',fontWeight:600}} type="number" value={adminPrice} min="0.01" step="0.01" onChange={e => setAdminPrice(e.target.value)}/>
            </div>
            <button onClick={() => { const p=parseFloat(adminPrice); if(p>0){setPricePerM3(p);setAdminOpen(false)} }} style={{background:'#b5cc2e',color:'#0b4358',border:'none',borderRadius:'7px',padding:'10px 16px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>
              Guardar
            </button>
          </div>
          <div style={{fontSize:'11px',color:'rgba(255,255,255,.45)',marginTop:'8px'}}>Precio activo: {fmtUSD(pricePerM3)}/m3 a 1.000 ppb</div>
        </div>
      )}

      <div style={{fontSize:'17px',fontWeight:700,color:'#0b4358',marginBottom:'16px',paddingBottom:'8px',borderBottom:'0.5px solid #d0d0c8'}}>
        Selecciona el producto
      </div>

      <div style={{display:'flex',marginBottom:'24px',borderRadius:'10px',overflow:'hidden',border:'0.5px solid #ddddd5'}}>
        <button style={{flex:1,padding:'13px',border:'none',background:product==='powder'?'#0b4358':'#fff',color:product==='powder'?'#fff':'#0b4358',fontSize:'14px',fontWeight:600,cursor:'pointer'}} onClick={() => setProduct('powder')}>
          MatriPowder
        </button>
        <button style={{flex:1,padding:'13px',border:'none',borderLeft:'0.5px solid #ddddd5',background:product==='tablets'?'#0b4358':'#fff',color:product==='tablets'?'#fff':'#0b4358',fontSize:'14px',fontWeight:600,cursor:'pointer'}} onClick={() => setProduct('tablets')}>
          MatriTablets
        </button>
      </div>

      {product === 'powder' && (
        <div>
          <div style={card}>
            <div style={{fontSize:'15px',fontWeight:700,color:'#0b4358',marginBottom:'16px'}}>Datos de la camara</div>

            <div style={{marginBottom:'16px'}}>
              <label style={label}>Nombre de la camara</label>
              <input style={inp} type="text" value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Ej: Camara 1 - Peras"/>
            </div>

            <div style={{marginBottom:'16px'}}>
              <label style={label}>Volumen de la camara (m3)</label>
              <input style={inp} type="number" value={volume} onChange={e => setVolume(e.target.value)} placeholder="Ej: 1500" min="1"/>
            </div>

            <div style={{marginBottom:'16px'}}>
              <label style={label}>Dosis objetivo (ppb)</label>
              <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
                <input style={{...inp,flex:1}} type="number" value={ppb} onChange={e => setPpb(e.target.value)} min="100" max="5000" step="50"/>
                <button onClick={() => setPpb('1000')} style={{background:'none',border:'0.5px solid #b5cc2e',color:'#3b6d11',borderRadius:'8px',padding:'10px 12px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'}}>
                  Estandar (1.000 ppb)
                </button>
              </div>
              <div style={{fontSize:'11px',color:'#888',marginTop:'4px'}}>Dosis estandar: 1.000 ppb = 0,067 g de MatriPowder 3,3% por m3</div>
            </div>

            <div style={{background:'#f0f7e0',border:'1px solid #b5cc2e',borderRadius:'8px',padding:'12px 14px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'12px',fontWeight:700,color:'#3b6d11',marginBottom:'2px'}}>No sabes que dosis usar?</div>
                <div style={{fontSize:'11px',color:'#555'}}>Consulta la calculadora cientifica DoseRight basada en parametros de cosecha.</div>
              </div>
              <button onClick={() => window.open("https://ar1xjl.github.io/Matri-argentina/1mcp-dose-calculator.html", "doseright", "width=900,height=700,scrollbars=yes")} style={{background:'#0b4358',color:'#fff',border:'none',borderRadius:'8px',padding:'9px 14px',fontSize:'12px',fontWeight:700,whiteSpace:'nowrap',marginLeft:'12px',cursor:'pointer',fontFamily:'inherit'}}>
                Abrir DoseRight
              </button>
            </div>

            <button style={calcBtn} onClick={calcPowder}>Calcular dosis y costo</button>
          </div>

          {result && (
            <div style={{...card,border:'2px solid #b5cc2e'}}>
              <div style={{fontSize:'13px',fontWeight:700,color:'#0b4358',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:'16px'}}>Resultado - MatriPowder</div>

              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'16px'}}>
                {[['Volumen',fmtNum(result.vol,0),'m3'],['Dosis objetivo',fmtNum(result.ppbV,0),'ppb'],['Gramos necesarios',fmtNum(result.grams,1),'g']].map(([l,v,u]) => (
                  <div key={l} style={metricBox}>
                    <div style={{fontSize:'11px',color:'#666',marginBottom:'3px'}}>{l}</div>
                    <div style={{fontSize:'20px',fontWeight:700,color:'#0b4358'}}>{v}</div>
                    <div style={{fontSize:'11px',color:'#888'}}>{u}</div>
                  </div>
                ))}
              </div>

              {(!result.needsChoice || selected) && (
                <div style={{background:'#0b4358',borderRadius:'10px',padding:'16px 20px',marginBottom:'16px',display:'flex'}}>
                  {[['Costo total',fmtUSD(activeCost),'USD'],['Costo por m3',fmtUSD(activeCost/result.vol),'USD/m3'],['Dosis real',Math.round(activePpb).toLocaleString('es-AR'),'ppb']].map(([l,v,u]) => (
                    <div key={l} style={{flex:1,textAlign:'center',borderRight:'0.5px solid rgba(255,255,255,.15)',padding:'0 12px'}}>
                      <div style={{fontSize:'11px',color:'rgba(255,255,255,.6)',marginBottom:'4px',textTransform:'uppercase'}}>{l}</div>
                      <div style={{fontSize:'22px',fontWeight:700,color:'#b5cc2e'}}>{v}</div>
                      <div style={{fontSize:'11px',color:'rgba(255,255,255,.5)'}}>{u}</div>
                    </div>
                  ))}
                </div>
              )}

              <hr style={{border:'none',borderTop:'0.5px solid #e0e0d8',margin:'16px 0'}}/>

              {result.needsChoice && !selected && (
                <div>
                  <div style={{fontSize:'13px',fontWeight:700,color:'#c0392b',marginBottom:'10px'}}>El redondeo requiere un sobre adicional. Elegi una opcion:</div>
                  <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                    {[
                      {key:'exact', combo:result.exactC, g:result.exactG, label:'Opcion A - Dosis exacta', color:'#e8736a', excess:result.exactExcess},
                      {key:'adjusted', combo:result.adjC, g:result.adjG, label:'Opcion B - Dosis ajustada', color:'#3b6d11', excess:(result.adjG-result.grams)/result.grams*100},
                    ].map(opt => {
                      const optPpb  = actualPpb(opt.g, result.vol)
                      const optCost = calcCost(result.vol, optPpb)
                      return (
                        <div key={opt.key} onClick={() => setSelected(opt.key)} style={{flex:1,minWidth:'200px',borderRadius:'10px',border:selected===opt.key?'1.5px solid #0b4358':'1.5px solid #ddddd5',padding:'16px',cursor:'pointer',background:selected===opt.key?'#e8f4fc':'#fff'}}>
                          <div style={{fontSize:'11px',fontWeight:700,textTransform:'uppercase',color:opt.color,marginBottom:'4px'}}>{opt.label}</div>
                          <div style={{fontSize:'20px',fontWeight:700,color:'#0b4358'}}>{Math.round(optPpb).toLocaleString('es-AR')} ppb</div>
                          <div style={{fontSize:'12px',color:'#555',marginTop:'4px'}}>{comboLabel(opt.combo)}</div>
                          <div style={{fontSize:'13px',fontWeight:600,color:'#0b4358',marginTop:'4px'}}>Costo: {fmtUSD(optCost)}</div>
                          <button onClick={e => {e.stopPropagation(); setSelected(opt.key)}} style={{background:opt.color,color:'#fff',border:'none',borderRadius:'8px',padding:'7px 14px',fontSize:'12px',fontWeight:600,cursor:'pointer',marginTop:'10px',fontFamily:'inherit'}}>
                            Usar esta dosis
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {!result.needsChoice && (
                <div>
                  <div style={{fontSize:'13px',fontWeight:600,color:'#0b4358',marginBottom:'8px'}}>Combinacion de sobres</div>
                  {result.exactC.filter(p=>p.qty>0).map(p => (
                    <div key={p.size} style={pouchRow}>
                      <div style={{background:'#0b4358',color:'#fff',borderRadius:'6px',padding:'3px 10px',fontSize:'12px',fontWeight:700,minWidth:'48px',textAlign:'center'}}>{p.size}g</div>
                      <div style={{fontSize:'13px',color:'#333',flex:1}}>Sobre de {p.size} g</div>
                      <div style={{fontSize:'14px',fontWeight:700,color:'#e8736a'}}>x {p.qty}</div>
                    </div>
                  ))}
                </div>
              )}

              {selected && (
                <div style={{marginTop:'16px'}}>
                  <div style={{background:'#eaf7ee',border:'1px solid #a3d9b0',borderRadius:'10px',padding:'12px 16px',fontSize:'13px',color:'#1a6b30',fontWeight:500,marginBottom:'16px'}}>
                    Dosis confirmada: {Math.round(activePpb).toLocaleString('es-AR')} ppb - {fmtNum(activeG,0)} g - {comboLabel(activeCombo)} - Costo: {fmtUSD(activeCost)}
                  </div>
                  {activeCombo.filter(p=>p.qty>0).map(p => (
                    <div key={p.size} style={pouchRow}>
                      <div style={{background:'#0b4358',color:'#fff',borderRadius:'6px',padding:'3px 10px',fontSize:'12px',fontWeight:700,minWidth:'48px',textAlign:'center'}}>{p.size}g</div>
                      <div style={{fontSize:'13px',color:'#333',flex:1}}>Sobre de {p.size} g</div>
                      <div style={{fontSize:'14px',fontWeight:700,color:'#e8736a'}}>x {p.qty}</div>
                    </div>
                  ))}
                </div>
              )}

              {(selected || !result.needsChoice) && !orderSent && (
                <button onClick={() => setOrderSent(true)} style={{...calcBtn,marginTop:'16px',background:'#0b4358'}}>
                  Confirmar y agregar al pedido
                </button>
              )}

              {orderSent && (
                <div style={{background:'#0b4358',color:'#fff',borderRadius:'10px',padding:'14px 16px',marginTop:'16px',fontSize:'13px',fontWeight:500,textAlign:'center'}}>
                  Pedido iniciado - {roomName || 'Camara'} - {fmtNum(activeG,0)} g MatriPowder - {fmtUSD(activeCost)} USD
                  <div style={{fontSize:'11px',color:'rgba(255,255,255,.6)',marginTop:'4px'}}>Revisa el resumen en la seccion Pedidos</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {product === 'tablets' && (
        <div>
          <div style={card}>
            <div style={{fontSize:'15px',fontWeight:700,color:'#0b4358',marginBottom:'16px'}}>Datos de la camara</div>
            <div style={{marginBottom:'16px'}}>
              <label style={label}>Nombre de la camara</label>
              <input style={inp} type="text" value={roomNameT} onChange={e => setRoomNameT(e.target.value)} placeholder="Ej: Camara 2 - Manzanas"/>
            </div>
            <div style={{marginBottom:'16px'}}>
              <label style={label}>Volumen de la camara (m3)</label>
              <input style={inp} type="number" value={volumeT} onChange={e => setVolumeT(e.target.value)} placeholder="Ej: 300" min="1"/>
            </div>
            <div style={{fontSize:'11px',color:'#888',marginBottom:'16px'}}>Dosis estandar: 1.000 ppb - Tableta chica = 2,5 m3 - Tableta grande = 5 m3</div>
            <button style={calcBtn} onClick={calcTablets}>Calcular tabletas y costo</button>
          </div>

          {resultT && (
            <div style={{...card,border:'2px solid #b5cc2e'}}>
              <div style={{fontSize:'13px',fontWeight:700,color:'#0b4358',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:'16px'}}>Resultado - MatriTablets</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'16px'}}>
                {[['Volumen',fmtNum(resultT.vol,0),'m3'],['Total tabletas',resultT.large+resultT.small,'unidades']].map(([l,v,u]) => (
                  <div key={l} style={metricBox}>
                    <div style={{fontSize:'11px',color:'#666',marginBottom:'3px'}}>{l}</div>
                    <div style={{fontSize:'20px',fontWeight:700,color:'#0b4358'}}>{v}</div>
                    <div style={{fontSize:'11px',color:'#888'}}>{u}</div>
                  </div>
                ))}
              </div>
              <div style={{background:'#0b4358',borderRadius:'10px',padding:'16px 20px',marginBottom:'16px',display:'flex'}}>
                {[['Costo total',fmtUSD(resultT.cost),'USD'],['Costo por m3',fmtUSD(resultT.cost/resultT.vol),'USD/m3'],['Cobertura',fmtNum(resultT.covered,1),'m3']].map(([l,v,u]) => (
                  <div key={l} style={{flex:1,textAlign:'center',borderRight:'0.5px solid rgba(255,255,255,.15)',padding:'0 12px'}}>
                    <div style={{fontSize:'11px',color:'rgba(255,255,255,.6)',marginBottom:'4px',textTransform:'uppercase'}}>{l}</div>
                    <div style={{fontSize:'22px',fontWeight:700,color:'#b5cc2e'}}>{v}</div>
                    <div style={{fontSize:'11px',color:'rgba(255,255,255,.5)'}}>{u}</div>
                  </div>
                ))}
              </div>
              <hr style={{border:'none',borderTop:'0.5px solid #e0e0d8',margin:'16px 0'}}/>
              <div style={{fontSize:'13px',fontWeight:600,color:'#0b4358',marginBottom:'10px'}}>Combinacion optima</div>
              <div style={{display:'flex',gap:'10px',flexWrap:'wrap',marginBottom:'12px'}}>
                {[['Tableta grande (5 m3)',resultT.large],['Tableta chica (2,5 m3)',resultT.small]].map(([l,q]) => (
                  <div key={l} style={{flex:1,minWidth:'120px',background:'#f5f5ee',borderRadius:'10px',padding:'16px',textAlign:'center'}}>
                    <div style={{fontSize:'11px',color:'#666',marginBottom:'4px'}}>{l}</div>
                    <div style={{fontSize:'26px',fontWeight:700,color:'#0b4358'}}>{q}</div>
                    <div style={{fontSize:'11px',color:'#888'}}>unidades</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:'12px',color:'#888',fontStyle:'italic',marginBottom:'16px'}}>
                Cobertura total: {fmtNum(resultT.covered,1)} m3 - Excedente: {fmtNum(resultT.covered-resultT.vol,1)} m3
              </div>
              <button style={{...calcBtn,background:'#0b4358'}}>Confirmar y agregar al pedido</button>
            </div>
          )}
        </div>
      )}

      <div style={{textAlign:'center',fontSize:'11px',color:'#aaa',padding:'16px 0'}}>
        MaTri DoseRight Calculator - Argentina - FreshInset 2026
      </div>
    </div>
  )
}
