export default function Dashboard({ onNavigate, treatments = [] }) {
  // ── Real stats derived from shared treatments state ──────────────────
  const pending   = treatments.filter(t => t.status === 'submitted').length
  const approved  = treatments.filter(t => t.status === 'approved' || t.status === 'applied' || t.status === 'completed').length
  const totalUSD  = treatments
    .filter(t => t.status === 'approved' || t.status === 'applied' || t.status === 'completed')
    .reduce((s, t) => s + parseFloat(t.price_local || 0), 0)

  // Unique rooms that have been treated
  const activeRooms = [...new Set(treatments.map(t => t.cold_rooms?.name).filter(Boolean))].length

  const STATS = [
    { icon:'🏠', label:'Cámaras activas',        value:String(activeRooms), unit:'con tratamientos esta temporada' },
    { icon:'📦', label:'Tratamientos pendientes', value:String(pending),     unit:'esperando aprobación' },
    { icon:'✅', label:'Tratamientos aprobados',  value:String(approved),    unit:'esta temporada' },
    { icon:'💰', label:'Facturación (USD)',       value:`$${totalUSD.toFixed(0)}`, unit:'en tratamientos aprobados' },
  ]

  // Recent treatments — last 4
  const recentTreatments = [...treatments].slice(0, 4)

  // Rooms summary — unique rooms with last treatment status
  const roomMap = {}
  treatments.forEach(t => {
    const roomName = t.cold_rooms?.name
    if (!roomName) return
    if (!roomMap[roomName]) roomMap[roomName] = t
    else if (new Date(t.created_at) > new Date(roomMap[roomName].created_at)) roomMap[roomName] = t
  })
  const roomSummary = Object.values(roomMap).slice(0, 3)

  const statusConfig = {
    approved:  { cls:'approved',  label:'✓ Activa',      color:'var(--lime)' },
    submitted: { cls:'pending',   label:'⏳ Pendiente',   color:'var(--amber)' },
    applied:   { cls:'pending',   label:'🔧 Aplicado',    color:'var(--amber)' },
    completed: { cls:'confirmed', label:'📸 OK',          color:'var(--lime)' },
    rejected:  { cls:'rejected',  label:'✗ Rechazado',   color:'#e8736a' },
    cancelled: { cls:'rejected',  label:'– Cancelado',   color:'#e8736a' },
  }

  const productTag = (product) => (
    <span style={{
      background: product === 'powder' ? '#eef4c0' : '#e1f5ee',
      color: product === 'powder' ? '#4a6010' : '#0d7a5f',
      fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'100px'
    }}>{product === 'powder' ? 'MatriPowder' : 'MatriTablets'}</span>
  )

  return (
    <div>
      {/* Stats */}
      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'24px'}}>
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

      {/* Alert if pending treatments */}
      {pending > 0 && (
        <div className="alert warn" style={{marginBottom:'16px'}}>
          ⏳ Tenés <strong>{pending} tratamiento{pending > 1 ? 's' : ''} pendiente{pending > 1 ? 's' : ''}</strong> esperando aprobación de Wassington.
        </div>
      )}

      {/* Recent treatments */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Últimos tratamientos</span>
          <button className="btn-secondary btn-sm" onClick={() => onNavigate('treatments')}>Ver todos</button>
        </div>
        {recentTreatments.length === 0 ? (
          <div style={{padding:'40px', textAlign:'center', color:'var(--gray)', fontSize:'13px'}}>
            No hay tratamientos todavía.{' '}
            <span
              onClick={() => onNavigate('calculator')}
              style={{color:'var(--navy)', fontWeight:700, cursor:'pointer', textDecoration:'underline'}}
            >
              Crear el primer tratamiento
            </span>
          </div>
        ) : (
          <div style={{padding:0}} className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cámara</th><th>Producto</th><th>Precio</th>
                  <th>Fecha</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {recentTreatments.map((t, i) => {
                  const s = statusConfig[t.status] || statusConfig.submitted
                  return (
                    <tr key={i}>
                      <td style={{fontWeight:600}}>{t.cold_rooms?.name}</td>
                      <td>{productTag(t.product)}</td>
                      <td style={{fontWeight:700}}>{t.price_local != null ? `${t.price_currency || 'USD'} ${t.price_local}` : '—'}</td>
                      <td style={{color:'var(--gray)'}}>{new Date(t.created_at).toLocaleDateString('es-AR')}</td>
                      <td><span className={`status ${s.cls}`}>{s.label}</span></td>
                      <td>
                        <button className="btn-secondary btn-sm" onClick={() => onNavigate('treatments')}>Ver</button>
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
              No hay cámaras con tratamientos todavía.
            </div>
          ) : (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:'14px'}}>
              {roomSummary.map((t, i) => {
                const s = statusConfig[t.status] || statusConfig.submitted
                const pct = t.status === 'completed' ? 100 : t.status === 'approved' || t.status === 'applied' ? 75 : 40
                return (
                  <div key={i} style={{background:'var(--white)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'16px'}}>
                    <div style={{fontSize:'14px', fontWeight:800, color:'var(--navy)', marginBottom:'3px'}}>{t.cold_rooms?.name}</div>
                    <div style={{fontSize:'12px', color:'var(--gray)', marginBottom:'10px'}}>
                      {t.product === 'powder' ? 'MatriPowder' : 'MatriTablets'} · {t.service_fee_local != null ? 'Servicio' : 'Propio'}
                    </div>
                    <div style={{height:'3px', background:'var(--border)', borderRadius:'2px', margin:'8px 0'}}>
                      <div style={{height:'100%', width:`${pct}%`, background:s.color, borderRadius:'2px'}}/>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'11px', color:'var(--gray)'}}>
                      <span>{new Date(t.created_at).toLocaleDateString('es-AR')}</span>
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
                  <div style={{fontSize:'13px', fontWeight:700, marginTop:'4px'}}>Nuevo tratamiento</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px'}}>
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
