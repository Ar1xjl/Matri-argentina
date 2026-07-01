import powderLogo  from '../../assets/logos/MatriPowder_Logo.svg'
import tabletsLogo from '../../assets/logos/MatriTablets_Logo.svg'

export default function Dashboard({ onNavigate, orders = [] }) {
  // ── Real stats derived from shared orders state ──────────────────────
  const pending   = orders.filter(o => o.status === 'pending').length
  const approved  = orders.filter(o => o.status === 'approved' || o.status === 'confirmed').length
  const rejected  = orders.filter(o => o.status === 'rejected').length
  const totalUSD  = orders
    .filter(o => o.status === 'approved' || o.status === 'confirmed')
    .reduce((s, o) => s + parseFloat(o.price || 0), 0)

  // Unique rooms that have been treated
  const activeRooms = [...new Set(orders.map(o => o.room))].length

  const STATS = [
    { icon:'🏠', label:'Cámaras activas',      value:String(activeRooms), unit:'con pedidos esta temporada' },
    { icon:'📦', label:'Pedidos pendientes',    value:String(pending),     unit:'esperando aprobación' },
    { icon:'✅', label:'Pedidos aprobados',     value:String(approved),    unit:'esta temporada' },
    { icon:'💰', label:'Facturación (USD)',     value:`$${totalUSD.toFixed(0)}`, unit:'en pedidos aprobados' },
  ]

  // Recent orders — last 4
  const recentOrders = [...orders].slice(0, 4)

  // Rooms summary — unique rooms with last order status
  const roomMap = {}
  orders.forEach(o => {
    if (!roomMap[o.room]) roomMap[o.room] = o
    else if (new Date(o.date) > new Date(roomMap[o.room].date)) roomMap[o.room] = o
  })
  const roomSummary = Object.values(roomMap).slice(0, 3)

  const statusConfig = {
    approved:  { cls:'approved',  label:'✓ Activa',      color:'var(--lime)' },
    pending:   { cls:'pending',   label:'⏳ Pendiente',   color:'var(--amber)' },
    confirmed: { cls:'confirmed', label:'📸 OK',          color:'var(--lime)' },
    rejected:  { cls:'rejected',  label:'✗ Rechazado',   color:'#e8736a' },
  }

  const productTag = (name) => (
    <span style={{
      background: name === 'MatriPowder' ? '#eef4c0' : '#e1f5ee',
      color: name === 'MatriPowder' ? '#4a6010' : '#0d7a5f',
      fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'100px'
    }}>{name}</span>
  )

  return (
    <div>
      {/* Stats */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'24px'}}>
        {STATS.map((s, i) => (
          <div key={i} className="card" style={{marginBottom:0, position:'relative', overflow:'hidden'}}>
            <div style={{position:'absolute', top:0, left:0, right:0, height:'3px', background:'var(--lime)'}}/>
            <div style={{padding:'18px', position:'relative'}}>
              <div style={{position:'absolute', right:'14px', top:'14px', fontSize:'20px', opacity:.25}}>{s.icon}</div>
              <div style={{fontSize:'11px', fontWeight:700, color:'var(--gray)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'6px'}}>{s.label}</div>
              <div style={{fontSize:'26px', fontWeight:900, color:'var(--navy)', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:'11px', color:'var(--gray)', marginTop:'4px'}}>{s.unit}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Alert if pending orders */}
      {pending > 0 && (
        <div className="alert warn" style={{marginBottom:'16px'}}>
          ⏳ Tenés <strong>{pending} pedido{pending > 1 ? 's' : ''} pendiente{pending > 1 ? 's' : ''}</strong> esperando aprobación de Wassington.
        </div>
      )}

      {/* Recent orders */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Últimos pedidos</span>
          <button className="btn-secondary btn-sm" onClick={() => onNavigate('orders')}>Ver todos</button>
        </div>
        {recentOrders.length === 0 ? (
          <div style={{padding:'40px', textAlign:'center', color:'var(--gray)', fontSize:'13px'}}>
            No hay pedidos todavía.{' '}
            <span
              onClick={() => onNavigate('calculator')}
              style={{color:'var(--navy)', fontWeight:700, cursor:'pointer', textDecoration:'underline'}}
            >
              Crear el primer pedido
            </span>
          </div>
        ) : (
          <div style={{padding:0}}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cámara</th><th>Producto</th><th>Precio (USD)</th>
                  <th>Fecha</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o, i) => {
                  const s = statusConfig[o.status] || statusConfig.pending
                  return (
                    <tr key={i}>
                      <td style={{fontWeight:600}}>{o.room}</td>
                      <td>{productTag(o.product)}</td>
                      <td style={{fontWeight:700}}>${o.price}</td>
                      <td style={{color:'var(--gray)'}}>{o.date}</td>
                      <td><span className={`status ${s.cls}`}>{s.label}</span></td>
                      <td>
                        <button className="btn-secondary btn-sm" onClick={() => onNavigate('orders')}>Ver</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rooms summary */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Cámaras — resumen rápido</span>
          <button className="btn-secondary btn-sm" onClick={() => onNavigate('rooms')}>Ver todas</button>
        </div>
        <div className="card-body">
          {roomSummary.length === 0 ? (
            <div style={{textAlign:'center', color:'var(--gray)', fontSize:'13px', padding:'20px 0'}}>
              No hay cámaras con pedidos todavía.
            </div>
          ) : (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:'14px'}}>
              {roomSummary.map((o, i) => {
                const s = statusConfig[o.status] || statusConfig.pending
                const pct = o.status === 'confirmed' ? 100 : o.status === 'approved' ? 75 : 40
                return (
                  <div key={i} style={{background:'var(--white)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'16px'}}>
                    <div style={{fontSize:'14px', fontWeight:800, color:'var(--navy)', marginBottom:'3px'}}>{o.room}</div>
                    <div style={{fontSize:'12px', color:'var(--gray)', marginBottom:'10px'}}>{o.product} · {o.model}</div>
                    <div style={{height:'3px', background:'var(--border)', borderRadius:'2px', margin:'8px 0'}}>
                      <div style={{height:'100%', width:`${pct}%`, background:s.color, borderRadius:'2px'}}/>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'11px', color:'var(--gray)'}}>
                      <span>{o.date}</span>
                      <span className={`status ${s.cls}`} style={{fontSize:'10px'}}>{s.label}</span>
                    </div>
                  </div>
                )
              })}

              <div
                onClick={() => onNavigate('calculator')}
                style={{background:'var(--gray-lt)', border:'2px dashed var(--border)', borderRadius:'var(--radius)', padding:'16px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', minHeight:'100px'}}
              >
                <div style={{textAlign:'center', color:'var(--gray)'}}>
                  <div style={{fontSize:'28px'}}>＋</div>
                  <div style={{fontSize:'13px', fontWeight:700, marginTop:'4px'}}>Nuevo pedido</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px'}}>
        {[
          { icon:'🧮', label:'Nueva calculadora', desc:'Calculá dosis y compará alternativas', action:'calculator' },
          { icon:'📋', label:'Registro MatriSure', desc:'Subí foto de verificación de dosis', action:'applog' },
          { icon:'⚡', label:'Generadores', desc:'Comprá o alquilá un generador MaTri', action:'generators' },
        ].map((item, i) => (
          <div
            key={i}
            onClick={() => onNavigate(item.action)}
            style={{background:'var(--white)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'18px', cursor:'pointer', transition:'box-shadow .2s'}}
            onMouseEnter={e => e.currentTarget.style.boxShadow='var(--shadow-md)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
          >
            <div style={{fontSize:'24px', marginBottom:'8px'}}>{item.icon}</div>
            <div style={{fontSize:'13px', fontWeight:700, color:'var(--navy)', marginBottom:'4px'}}>{item.label}</div>
            <div style={{fontSize:'12px', color:'var(--gray)'}}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}