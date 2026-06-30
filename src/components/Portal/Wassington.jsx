import { useState } from 'react'

const CUSTOMERS = [
  { name:'Kleppe S.A.',        cuit:'30-12345678-9', tier:'T1', retailer:'Wassington',  region:'Río Negro',  status:'approved',  orders:12 },
  { name:'Tres Ases S.A.',     cuit:'30-98765432-1', tier:'T1', retailer:'Wassington',  region:'Mendoza',    status:'approved',  orders:8  },
  { name:'Frutícola Río Negro',cuit:'30-11223344-5', tier:'T2', retailer:'Podlesh',     region:'Río Negro',  status:'approved',  orders:5  },
  { name:'Kiwi Sur S.R.L.',    cuit:'30-55667788-2', tier:'T3', retailer:'RetailSur',   region:'Neuquén',    status:'approved',  orders:3  },
  { name:'Frutales del Sur',   cuit:'30-99887766-3', tier:'T2', retailer:'Podlesh',     region:'Río Negro',  status:'pending',   orders:0  },
]

const tierColor = (t) => t === 'T1' ? {bg:'#e8f4fc',color:'#0c447c'} : t === 'T2' ? {bg:'#f0f7e0',color:'#3b6d11'} : {bg:'#fff3cd',color:'#b06a00'}

export default function Wassington({ orders = [], onApprove, onReject }) {
  const [modal,     setModal]     = useState(null) // { order, action: 'approve'|'reject' }
  const [editPrice, setEditPrice] = useState('')
  const [reason,    setReason]    = useState('')

  const pending   = orders.filter(o => o.status === 'pending')
  const processed = orders.filter(o => o.status === 'approved' || o.status === 'rejected')

  const openApprove = (order) => { setEditPrice(order.price); setModal({ order, action: 'approve' }) }
  const openReject  = (order) => { setReason(''); setModal({ order, action: 'reject' }) }
  const closeModal  = () => setModal(null)

  const confirmApprove = () => {
    onApprove(modal.order.id, editPrice)
    closeModal()
  }
  const confirmReject = () => {
    onReject(modal.order.id, reason)
    closeModal()
  }

  const totalUSD = orders.filter(o => o.status==='approved'||o.status==='confirmed')
    .reduce((s,o) => s + parseFloat(o.price || 0), 0)

  const STATS = [
    { icon:'⏳', label:'Pedidos pendientes',  value:String(pending.length),  unit:'requieren aprobación',  bg:'#fff3cd' },
    { icon:'✅', label:'Pedidos aprobados',   value:String(orders.filter(o=>o.status==='approved'||o.status==='confirmed').length), unit:'esta temporada', bg:'#eaf7ee' },
    { icon:'👥', label:'Clientes activos',    value:'5',      unit:'en el portal',           bg:'#e8f4fc' },
    { icon:'💰', label:'Facturación USD',     value:`$${totalUSD.toFixed(2)}`, unit:'esta temporada',  bg:'#f0f7e0' },
  ]

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
          <span style={{background:'#fff3cd', color:'#b06a00', fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'100px'}}>{pending.length} pendientes</span>
        </div>

        {pending.length === 0 ? (
          <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
            ✓ No hay pedidos pendientes — todos procesados.
          </div>
        ) : (
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
            <thead>
              <tr>
                {['N° pedido','Cliente','Tier','Cámara','Producto','Sachets','Precio','Modelo','Fecha',''].map(h => (
                  <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pending.map((o,i) => {
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
                    <td style={{padding:'12px 16px', fontWeight:700}}>${o.price}</td>
                    <td style={{padding:'12px 16px'}}>
                      <span style={{background:'#f5f5ee', color:'#6b6b6b', fontSize:'11px', fontWeight:600, padding:'2px 8px', borderRadius:'100px'}}>{o.model}</span>
                    </td>
                    <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{o.date}</td>
                    <td style={{padding:'12px 16px'}}>
                      <div style={{display:'flex', gap:'6px'}}>
                        <button onClick={() => openApprove(o)} style={{background:'#eaf7ee', color:'#1a6b30', border:'0.5px solid #a3d9b0', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:700, cursor:'pointer'}}>✓ Aprobar</button>
                        <button onClick={() => openReject(o)} style={{background:'#fdeaea', color:'#8b2020', border:'0.5px solid #f5c1c1', borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:700, cursor:'pointer'}}>✗ Rechazar</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Recently processed */}
      {processed.length > 0 && (
        <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', marginBottom:'16px', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5'}}>
            <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Procesados recientemente</span>
          </div>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
            <thead>
              <tr>
                {['N° pedido','Cliente','Cámara','Precio final','Estado','Motivo'].map(h => (
                  <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {processed.map((o,i) => (
                <tr key={i} style={{borderBottom: i < processed.length-1 ? '0.5px solid #ddddd5' : 'none'}}>
                  <td style={{padding:'12px 16px', fontWeight:700}}># {o.id}</td>
                  <td style={{padding:'12px 16px'}}>{o.customer}</td>
                  <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{o.room}</td>
                  <td style={{padding:'12px 16px', fontWeight:700}}>${o.price}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span className={`status ${o.status}`}>{o.status === 'approved' ? '✓ Aprobado' : '✗ Rechazado'}</span>
                  </td>
                  <td style={{padding:'12px 16px', color:'#888', fontSize:'12px'}}>{o.rejectReason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

      {/* Approve/Reject Modal */}
      {modal && (
        <div
          onClick={(e) => e.target === e.currentTarget && closeModal()}
          style={{position:'fixed', inset:0, background:'rgba(7,46,61,.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center'}}
        >
          <div style={{background:'#fff', borderRadius:'14px', padding:'28px', width:'100%', maxWidth:'420px', boxShadow:'0 8px 32px rgba(11,67,88,.2)'}}>

            {modal.action === 'approve' ? (
              <>
                <div style={{fontSize:'18px', fontWeight:800, color:'#0b4358', marginBottom:'4px'}}>Aprobar pedido</div>
                <div style={{fontSize:'13px', color:'#888', marginBottom:'20px'}}>
                  #{modal.order.id} · {modal.order.customer} · {modal.order.room}
                </div>
                <div style={{marginBottom:'18px'}}>
                  <label style={{display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}}>
                    Precio final (USD)
                  </label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={e => setEditPrice(e.target.value)}
                    style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8'}}
                  />
                  <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>
                    Precio indicativo del cliente: ${modal.order.price}. Podés confirmarlo o ajustarlo.
                  </div>
                </div>
                <div style={{display:'flex', gap:'10px'}}>
                  <button onClick={confirmApprove} className="btn-primary" style={{flex:1, background:'#1a6b30'}}>
                    ✓ Confirmar aprobación
                  </button>
                  <button onClick={closeModal} className="btn-secondary">Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <div style={{fontSize:'18px', fontWeight:800, color:'#0b4358', marginBottom:'4px'}}>Rechazar pedido</div>
                <div style={{fontSize:'13px', color:'#888', marginBottom:'20px'}}>
                  #{modal.order.id} · {modal.order.customer} · {modal.order.room}
                </div>
                <div style={{marginBottom:'18px'}}>
                  <label style={{display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}}>
                    Motivo del rechazo
                  </label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={3}
                    placeholder="Ej: Stock insuficiente de MatriPowder 50g esta semana"
                    style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8', fontFamily:'inherit', resize:'vertical'}}
                  />
                  <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>
                    El cliente verá este motivo en su sección de Pedidos.
                  </div>
                </div>
                <div style={{display:'flex', gap:'10px'}}>
                  <button onClick={confirmReject} className="btn-primary" style={{flex:1, background:'#8b2020'}}>
                    ✗ Confirmar rechazo
                  </button>
                  <button onClick={closeModal} className="btn-secondary">Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}