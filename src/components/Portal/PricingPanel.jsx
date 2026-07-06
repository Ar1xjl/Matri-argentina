import { useState } from 'react'
import { BRACKETS, TIERS, PRODUCT_PRICES, SERVICE_FEES, GENERATOR_PRICES } from '../../data/pricing'

function PriceTable({ title, unit, data, onSave }) {
  const [editing, setEditing] = useState(false)
  const [values,  setValues]  = useState(data)

  const update = (tier, bracketId, val) => {
    setValues(prev => ({
      ...prev,
      [tier]: { ...prev[tier], [bracketId]: parseFloat(val) || 0 }
    }))
  }

  const handleSave = () => { onSave(values); setEditing(false) }

  return (
    <div style={{marginBottom:'24px'}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px'}}>
        <div>
          <div style={{fontSize:'14px', fontWeight:700, color:'#0b4358'}}>{title}</div>
          <div style={{fontSize:'11px', color:'#888'}}>{unit}</div>
        </div>
        <div style={{display:'flex', gap:'8px'}}>
          {editing ? (
            <>
              <button onClick={handleSave} style={{background:'#1a6b30', color:'#fff', border:'none', borderRadius:'6px', padding:'6px 14px', fontSize:'12px', fontWeight:700, cursor:'pointer'}}>
                Guardar
              </button>
              <button onClick={() => { setValues(data); setEditing(false) }} className="btn-secondary btn-sm">
                Cancelar
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary btn-sm">
              Editar
            </button>
          )}
        </div>
      </div>

      <div style={{background:'#fff', borderRadius:'10px', border:'0.5px solid #ddddd5', overflow:'hidden'}}>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
          <thead>
            <tr>
              <th style={{padding:'10px 16px', textAlign:'left', fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', background:'#f5f5ee', borderBottom:'0.5px solid #ddddd5'}}>
                Tier
              </th>
              {BRACKETS.map(b => (
                <th key={b.id} style={{padding:'10px 16px', textAlign:'center', fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', background:'#f5f5ee', borderBottom:'0.5px solid #ddddd5'}}>
                  {b.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIERS.map((tier, ti) => (
              <tr key={tier} style={{borderBottom: ti < TIERS.length-1 ? '0.5px solid #ddddd5' : 'none'}}>
                <td style={{padding:'12px 16px', fontWeight:700}}>
                  <span style={{
                    background: tier==='T1' ? '#e8f4fc' : tier==='T2' ? '#f0f7e0' : '#fff3cd',
                    color: tier==='T1' ? '#0c447c' : tier==='T2' ? '#3b6d11' : '#b06a00',
                    fontSize:'12px', fontWeight:700, padding:'3px 10px', borderRadius:'100px'
                  }}>{tier}</span>
                </td>
                {BRACKETS.map(b => (
                  <td key={b.id} style={{padding:'10px 16px', textAlign:'center'}}>
                    {editing ? (
                      <input
                        type="number"
                        value={values[tier]?.[b.id] ?? 0}
                        step="0.01"
                        onChange={e => update(tier, b.id, e.target.value)}
                        style={{width:'70px', padding:'5px 8px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'13px', textAlign:'center', fontFamily:'monospace'}}
                      />
                    ) : (
                      <span style={{fontFamily:'monospace', fontWeight:500}}>
                        ${(values[tier]?.[b.id] ?? 0).toFixed(2)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GeneratorTable({ data, onSave }) {
  const [editing, setEditing] = useState(false)
  const [values,  setValues]  = useState(data)

  const update = (type, tier, bracketId, val) => {
    setValues(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [tier]: { ...prev[type][tier], [bracketId]: parseFloat(val) || 0 }
      }
    }))
  }

  const handleSave = () => { onSave(values); setEditing(false) }

  const SubTable = ({ type, label }) => (
    <div style={{marginBottom:'20px'}}>
      <div style={{fontSize:'12px', fontWeight:700, color:'#0b4358', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.04em'}}>{label}</div>
      <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
        <thead>
          <tr>
            <th style={{padding:'8px 14px', textAlign:'left', fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', background:'#f5f5ee', borderBottom:'0.5px solid #ddddd5'}}>Tier</th>
            {BRACKETS.map(b => (
              <th key={b.id} style={{padding:'8px 14px', textAlign:'center', fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', background:'#f5f5ee', borderBottom:'0.5px solid #ddddd5'}}>{b.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIERS.map((tier, ti) => (
            <tr key={tier} style={{borderBottom: ti < TIERS.length-1 ? '0.5px solid #ddddd5' : 'none'}}>
              <td style={{padding:'10px 14px'}}>
                <span style={{
                  background: tier==='T1' ? '#e8f4fc' : tier==='T2' ? '#f0f7e0' : '#fff3cd',
                  color: tier==='T1' ? '#0c447c' : tier==='T2' ? '#3b6d11' : '#b06a00',
                  fontSize:'12px', fontWeight:700, padding:'3px 10px', borderRadius:'100px'
                }}>{tier}</span>
              </td>
              {BRACKETS.map(b => (
                <td key={b.id} style={{padding:'8px 14px', textAlign:'center'}}>
                  {editing ? (
                    <input
                      type="number"
                      value={values[type]?.[tier]?.[b.id] ?? 0}
                      step="1"
                      onChange={e => update(type, tier, b.id, e.target.value)}
                      style={{width:'65px', padding:'4px 6px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'12px', textAlign:'center', fontFamily:'monospace'}}
                    />
                  ) : (
                    <span style={{fontFamily:'monospace', fontWeight:500}}>
                      ${values[type]?.[tier]?.[b.id] ?? 0}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div style={{marginBottom:'24px'}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px'}}>
        <div>
          <div style={{fontSize:'14px', fontWeight:700, color:'#0b4358'}}>Generador MaTri</div>
          <div style={{fontSize:'11px', color:'#888'}}>Precios de compra y alquiler por Tier y volumen</div>
        </div>
        <div style={{display:'flex', gap:'8px'}}>
          {editing ? (
            <>
              <button onClick={handleSave} style={{background:'#1a6b30', color:'#fff', border:'none', borderRadius:'6px', padding:'6px 14px', fontSize:'12px', fontWeight:700, cursor:'pointer'}}>
                Guardar
              </button>
              <button onClick={() => { setValues(data); setEditing(false) }} className="btn-secondary btn-sm">
                Cancelar
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary btn-sm">
              Editar
            </button>
          )}
        </div>
      </div>
      <div style={{background:'#fff', borderRadius:'10px', border:'0.5px solid #ddddd5', padding:'16px'}}>
        <SubTable type="purchase" label="Precio de compra (USD / unidad)"/>
        <SubTable type="rental"   label="Precio de alquiler (USD / dia)"/>
      </div>
    </div>
  )
}

export default function PricingPanel() {
  const [activeTab,     setActiveTab]     = useState('powder')
  const [powderPrices,  setPowderPrices]  = useState(PRODUCT_PRICES.MatriPowder.prices)
  const [tabletPrices,  setTabletPrices]  = useState(PRODUCT_PRICES.MatriTablets.prices)
  const [servicePrices, setServicePrices] = useState(SERVICE_FEES.prices)
  const [genPrices,     setGenPrices]     = useState({ purchase: GENERATOR_PRICES.purchase, rental: GENERATOR_PRICES.rental })

  const TABS = [
    { id:'powder',  label:'MatriPowder' },
    { id:'tablets', label:'MatriTablets' },
    { id:'service', label:'Servicio de aplicacion' },
    { id:'gen',     label:'Generadores' },
  ]

  return (
    <div>
      <div className="alert info">
        Los precios configurados aqui se aplican automaticamente en la calculadora y en los tratamientos.
      </div>

      <div style={{display:'flex', marginBottom:'20px', borderRadius:'10px', overflow:'hidden', border:'0.5px solid #ddddd5', background:'#fff'}}>
        {TABS.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              flex:1, padding:'12px', border:'none',
              borderRight: i < TABS.length-1 ? '0.5px solid #ddddd5' : 'none',
              background: activeTab === t.id ? '#0b4358' : '#fff',
              color: activeTab === t.id ? '#fff' : '#0b4358',
              fontSize:'13px', fontWeight:600, cursor:'pointer', transition:'.15s'
            }}
          >{t.label}</button>
        ))}
      </div>

      {activeTab === 'powder' && (
        <PriceTable
          title="MatriPowder — precio de producto"
          unit="USD / m3 tratado"
          data={powderPrices}
          onSave={setPowderPrices}
        />
      )}
      {activeTab === 'tablets' && (
        <PriceTable
          title="MatriTablets — precio de producto"
          unit="USD / m3 tratado"
          data={tabletPrices}
          onSave={setTabletPrices}
        />
      )}
      {activeTab === 'service' && (
        <PriceTable
          title="Servicio de aplicacion — cargo fijo"
          unit="USD / camara / tratamiento (solo MatriPowder con servicio gestionado)"
          data={servicePrices}
          onSave={setServicePrices}
        />
      )}
      {activeTab === 'gen' && (
        <GeneratorTable
          data={genPrices}
          onSave={setGenPrices}
        />
      )}

      <div style={{background:'#f0f7e0', border:'0.5px solid #b5cc2e', borderRadius:'10px', padding:'14px 16px', fontSize:'12px', color:'#3b6d11', marginTop:'8px'}}>
        <strong>Nota:</strong> Estos son valores de referencia. Wassington puede ajustar el precio final en el proceso de aprobacion de cada tratamiento.
      </div>
    </div>
  )
}