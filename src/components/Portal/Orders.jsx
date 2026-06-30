const productTag = (name) => (
  <span style={{
    background: name === 'MatriPowder' ? '#eef4c0' : '#e1f5ee',
    color: name === 'MatriPowder' ? '#4a6010' : '#0d7a5f',
    fontSize:'11px', fontWeight:700, padding:'3px 10px',
    borderRadius:'100px'
  }}>{name}</span>
)

const statusLabel = (status) => ({
  approved:  { cls:'approved',  label:'✓ Aprobado' },
  pending:   { cls:'pending',   label:'⏳ Pendiente' },
  confirmed: { cls:'confirmed', label:'📸 MatriSure OK' },
  rejected:  { cls:'rejected',  label:'✗ Rechazado' },
}[status] || { cls:'pending', label:status })

export default function Orders({ onNavigate, orders = [] }) {
  return (
    <div>
      <div style={{display:'flex', gap:'10px', marginBottom:'16px'}}>
        <button className="btn-primary" onClick={() => onNavigate('calculator')}>
          + Nuevo pedido
        </button>
        <button className="btn-secondary">Filtrar</button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Todos los pedidos</span>
          <span style={{fontSize:'12px', color:'var(--gray)'}}>{orders.length} pedidos esta temporada</span>
        </div>
        <div style={{padding:0}}>
          {orders.length === 0 ? (
            <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
              No hay pedidos todavía. Hacé click en "+ Nuevo pedido" para crear el primero.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>N° pedido</th><th>Cámara</th><th>Producto</th>
                  <th>Sachets</th><th>Precio (USD)</th><th>Modelo</th>
                  <th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const s = statusLabel(o.status)
                  return (
                    <tr key={o.id}>
                      <td style={{fontWeight:700, color:'var(--navy)'}}># {o.id}</td>
                      <td>{o.room}</td>
                      <td>{productTag(o.product)}</td>
                      <td style={{fontFamily:'monospace', fontSize:'12px'}}>{o.sachets}</td>
                      <td style={{fontWeight:700}}>${o.price}</td>
                      <td>
                        <span style={{
                          background:'var(--cream-dark)', color:'var(--gray)',
                          fontSize:'11px', fontWeight:600, padding:'3px 10px',
                          borderRadius:'100px'
                        }}>{o.model}</span>
                      </td>
                      <td>
                        <span className={`status ${s.cls}`}>{s.label}</span>
                        {o.status === 'rejected' && o.rejectReason && (
                          <div style={{fontSize:'11px', color:'#8b2020', marginTop:'4px', maxWidth:'180px'}}>
                            {o.rejectReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <button className="btn-secondary btn-sm">↺ Repetir</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}