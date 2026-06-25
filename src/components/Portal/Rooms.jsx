const STATS = [
  { icon:'🏠', label:'Cámaras activas',      value:'12',    unit:'ubicaciones registradas' },
  { icon:'📦', label:'Pedidos pendientes',    value:'3',     unit:'esperando aprobación' },
  { icon:'🌡️', label:'M³ tratados',          value:'8.400', unit:'esta temporada' },
  { icon:'✅', label:'MatriSure confirmados', value:'94%',   unit:'tasa de confirmación' },
]

const ORDERS = [
  { room:'Cámara Norte 1', product:'MatriPowder',  dose:'250g', date:'20 jun 2026', status:'approved',  label:'✓ Aprobado' },
  { room:'Cámara Sur 3',   product:'MatriPowder',  dose:'180g', date:'18 jun 2026', status:'pending',   label:'⏳ Pendiente' },
  { room:'Frigorífico A',  product:'MatriTablets', dose:'120g', date:'15 jun 2026', status:'approved',  label:'✓ Aprobado' },
  { room:'Cámara Norte 2', product:'MatriPowder',  dose:'310g', date:'12 jun 2026', status:'confirmed', label:'📸 MatriSure OK' },
]

const ROOMS = [
  { name:'Cámara Norte 1', vol:'500 m³ · Manzanas Fuji · Europa', pct:75, status:'approved',  slabel:'✓ Activa',    date:'20 jun', color:'var(--lime)' },
  { name:'Cámara Sur 3',   vol:'360 m³ · Peras Williams · Local', pct:50, status:'pending',   slabel:'⏳ Pendiente', date:'18 jun', color:'var(--amber)' },
  { name:'Frigorífico A',  vol:'240 m³ · Kiwi · USA',             pct:90, status:'confirmed', slabel:'📸 OK',        date:'15 jun', color:'var(--lime)' },
]

const productTag = (name) => (
  <span style={{
    background: name === 'MatriPowder' ? '#eef4c0' : '#e1f5ee',
    color: name === 'MatriPowder' ? '#4a6010' : '#0d7a5f',
    fontSize:'11px', fontWeight:700, padding:'3px 10px',
    borderRadius:'100px', letterSpacing:'.04em'
  }}>{name}</span>
)

export default function Dashboard({ onNavigate }) {
  return (
    <div>
      {/* Stats */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'24px'}}>
        {STATS.map((s,i) => (
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

      {/* Recent orders */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Últimos pedidos</span>
          <button className="btn-secondary btn-sm" onClick={() => onNavigate('orders')}>Ver todos</button>
        </div>
        <div style={{padding:0}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Cámara</th><th>Producto</th><th>Dosis</th>
                <th>Fecha</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {ORDERS.map((o,i) => (
                <tr key={i}>
                  <td style={{fontWeight:600}}>{o.room}</td>
                  <td>{productTag(o.product)}</td>
                  <td>{o.dose}</td>
                  <td style={{color:'var(--gray)'}}>{o.date}</td>
                  <td><span className={`status ${o.status}`}>{o.label}</span></td>
                  <td><button className="btn-secondary btn-sm">Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rooms */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Cámaras — resumen rápido</span>
          <button className="btn-secondary btn-sm" onClick={() => onNavigate('rooms')}>Ver todas</button>
        </div>
        <div className="card-body">
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:'14px'}}>
            {ROOMS.map((r,i) => (
              <div key={i} style={{
                background:'var(--white)', border:'1.5px solid var(--border)',
                borderRadius:'var(--radius)', padding:'16px'
              }}>
                <div style={{fontSize:'14px', fontWeight:800, color:'var(--navy)', marginBottom:'3px'}}>{r.name}</div>
                <div style={{fontSize:'12px', color:'var(--gray)', marginBottom:'10px'}}>{r.vol}</div>
                <div style={{height:'3px', background:'var(--border)', borderRadius:'2px', margin:'8px 0'}}>
                  <div style={{height:'100%', width:`${r.pct}%`, background:r.color, borderRadius:'2px'}}/>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'11px', color:'var(--gray)'}}>
                  <span>{r.date}</span>
                  <span className={`status ${r.status}`} style={{fontSize:'10px'}}>{r.slabel}</span>
                </div>
              </div>
            ))}
            <div
              onClick={() => onNavigate('rooms')}
              style={{
                background:'var(--gray-lt)', border:'2px dashed var(--border)',
                borderRadius:'var(--radius)', padding:'16px',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', minHeight:'100px'
              }}
            >
              <div style={{textAlign:'center', color:'var(--gray)'}}>
                <div style={{fontSize:'28px'}}>＋</div>
                <div style={{fontSize:'13px', fontWeight:700, marginTop:'4px'}}>Agregar cámara</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}