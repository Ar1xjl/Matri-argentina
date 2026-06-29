const PENDING_ORDERS = [
  { id:'ARG-0042', customer:'Kleppe S.A.',        tier:'T1', room:'Cámara Norte 3', product:'MatriPowder',  sachets:'4×50g',       price:'$172.00', model:'Servicio', date:'29 jun 2026' },
  { id:'ARG-0043', customer:'Tres Ases S.A.',      tier:'T1', room:'Frigorífico B',  product:'MatriPowder',  sachets:'6×50g+1×20g', price:'$238.00', model:'Propio',   date:'29 jun 2026' },
  { id:'ARG-0044', customer:'Frutícola Río Negro', tier:'T2', room:'Cámara 2',       product:'MatriTablets', sachets:'3×50g',        price:'$115.00', model:'Servicio', date:'28 jun 2026' },
  { id:'ARG-0045', customer:'Kiwi Sur S.R.L.',     tier:'T3', room:'Sala Kiwi A',    product:'MatriTablets', sachets:'2×50g+1×25g',  price:'$98.50',  model:'Propio',   date:'28 jun 2026' },
]

const CUSTOMERS = [
  { name:'Kleppe S.A.',        cuit:'30-12345678-9', tier:'T1', retailer:'Wassington',  region:'Río Negro',  status:'approved',  orders:12 },
  { name:'Tres Ases S.A.',     cuit:'30-98765432-1', tier:'T1', retailer:'Wassington',  region:'Mendoza',    status:'approved',  orders:8  },
  { name:'Frutícola Río Negro',cuit:'30-11223344-5', tier:'T2', retailer:'Podlesh',     region:'Río Negro',  status:'approved',  orders:5  },
  { name:'Kiwi Sur S.R.L.',    cuit:'30-55667788-2', tier:'T3', retailer:'RetailSur',   region:'Neuquén',    status:'approved',  orders:3  },
  { name:'Frutales del Sur',   cuit:'30-99887766-3', tier:'T2', retailer:'Podlesh',     region:'Río Negro',  status:'pending',   orders:0  },
]

const STATS = [
  { icon:'⏳', label:'Pedidos pendientes',  value:'4',      unit:'requieren aprobación',  color:'#b06a00', bg:'#fff3cd' },
  { icon:'✅', label:'Pedidos aprobados',   value:'28',     unit:'esta temporada',         color:'#1a6b30', bg:'#eaf7ee' },
  { icon:'👥', label:'Clientes activos',    value:'5',      unit:'en el portal',           color:'#0b4358', bg:'#e8f4fc' },
  { icon:'💰', label:'Facturación USD',     value:'$4.820', unit:'esta temporada',         color:'#0b4358', bg:'#f0f7e0' },
]

const tierColor = (t) => t === 'T1' ? {bg:'#e8f4fc',color:'#0c447c'} : t === 'T2' ? {bg:'#f0f7e0',color:'#3b6d11'} : {bg:'#fff3cd',color:'#b06a00'}

export default function Wassington() {
  return (
    <div>
      {/* Stats */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px'}}>
        {STATS.map((s,i) => (
          <div key={i} style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'18px', position:'relative', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
            <div style={{position:'absolute', top:0, left:0, right:0, height:'3px', background:'#b5cc2e'}}/>
            <div style={{position:'absolute', right:'14px', top:'16px', width:'36px', height:'36px', borderRadius:'8px', background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px'}}>{s.icon}</div>
            <div style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'6px'}}>{s.label}</div>
            <div style={{fontSize:'26px', fontWeight:800, color:'#0b4358', lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:'11px', color:'#6b6b6b', marginTop:'4px'}}>{s.unit}</div>
          </div>
        ))}
      </div>

      {/* Pending orders */}
      <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', marginBottom:'16px', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Pedidos pendientes de aprobación</span>
          <span style={{background:'#fff3cd', color:'#b06a00', fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'100px'}}>4 pendientes</span>
        </div>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
          <thead>
            <tr>
              {['N° pedido','Cliente','Tier','Cámara','Producto','Sachets','Precio','Modelo','Fecha',''].map(h => (
                <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PENDING_ORDERS.map((o,i) => {
              const tc = tierColor(o.tier)
              return (
                <tr key={i} style={{borderBottom:'0.5px solid #ddddd5'}}>
                  <td style={{padding:'12px 16px', fontWeight:700}}># {o.id}</td>
                  <td style={{padding:'12px 16px'}}>{o.customer}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{background:tc.bg, color:tc.color, fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'100px'}}>{o.tier}</span>
                  </td>
                  <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{o.room}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{background:o.product==='MatriPowder'?'#f0f7e0':'#eaf7ee', color:o.product==='MatriPowder'?'#3b6d11':'#1a6b30', fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'100px'}}>{o.product}</span>
                  </td>
                  <td style={{padding:'12px 16px', fontFamily:'monospace', fontSize:'12px'}}>{o.sachets}</td>
                  <td style={{padding:'12px 16px', fontWeight:700}}>{o.price}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{background:'#f5f5ee', color:'#6b6b6b', fontSize:'11px', fontWeight:600, padding:'2px 8px', borderRadius:'100px'}}>{o.model}</span>
                  </td>
                  <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{o.date}</td>
                  <td style={{padding:'12px 16px'}}>
                    <div style={{display:'flex', gap:'6px'}}>
                      <button style={{background:'#eaf7ee', color:'#1a6b30', border:'0.5px solid #a3d9b0', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:700, cursor:'pointer'}}>✓ Aprobar</button>
                      <button style={{background:'#fdeaea', color:'#8b2020', border:'0.5px solid #f5c1c1', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:700, cursor:'pointer'}}>✗ Rechazar</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Customer CRM */}
      <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>CRM — Clientes</span>
          <button style={{background:'#b5cc2e', color:'#0b4358', border:'none', borderRadius:'6px', padding:'6px 14px', fontSize:'12px', fontWeight:700, cursor:'pointer'}}>+ Nuevo cliente</button>
        </div>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
          <thead>
            <tr>
              {['Razón Social','CUIT','Tier','Distribuidor','Región','Pedidos','Estado',''].map(h => (
                <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CUSTOMERS.map((c,i) => {
              const tc = tierColor(c.tier)
              return (
                <tr key={i} style={{borderBottom: i < CUSTOMERS.length-1 ? '0.5px solid #ddddd5' : 'none'}}>
                  <td style={{padding:'12px 16px', fontWeight:600}}>{c.name}</td>
                  <td style={{padding:'12px 16px', fontFamily:'monospace', fontSize:'12px', color:'#6b6b6b'}}>{c.cuit}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{background:tc.bg, color:tc.color, fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'100px'}}>{c.tier}</span>
                  </td>
                  <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{c.retailer}</td>
                  <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{c.region}</td>
                  <td style={{padding:'12px 16px', fontWeight:700, textAlign:'center'}}>{c.orders}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{
                      background: c.status==='approved' ? '#eaf7ee' : '#fff3cd',
                      color: c.status==='approved' ? '#1a6b30' : '#b06a00',
                      fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'100px'
                    }}>{c.status==='approved' ? '✓ Activo' : '⏳ Pendiente'}</span>
                  </td>
                  <td style={{padding:'12px 16px'}}>
                    <button style={{background:'#f5f5ee', color:'#0b4358', border:'0.5px solid #ddddd5', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:600, cursor:'pointer'}}>Ver</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}