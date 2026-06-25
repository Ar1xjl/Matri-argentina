const ORDERS = [
  { id:'ARG-0041', room:'Cámara Norte 1', product:'MatriPowder',  sachets:'5×50g',       price:'$215.00', model:'Servicio', status:'approved',  slabel:'✓ Aprobado' },
  { id:'ARG-0040', room:'Cámara Sur 3',   product:'MatriPowder',  sachets:'3×50g+1×25g', price:'$178.00', model:'Propio',   status:'pending',   slabel:'⏳ Pendiente' },
  { id:'ARG-0039', room:'Frigorífico A',  product:'MatriTablets', sachets:'2×50g+1×25g', price:'$143.50', model:'Propio',   status:'approved',  slabel:'✓ Aprobado' },
  { id:'ARG-0038', room:'Cámara Norte 2', product:'MatriPowder',  sachets:'6×50g+1×10g', price:'$262.00', model:'Servicio', status:'confirmed', slabel:'📸 MatriSure OK' },
]

const productTag = (name) => (
  <span style={{
    background: name === 'MatriPowder' ? '#eef4c0' : '#e1f5ee',
    color: name === 'MatriPowder' ? '#4a6010' : '#0d7a5f',
    fontSize:'11px', fontWeight:700, padding:'3px 10px',
    borderRadius:'100px'
  }}>{name}</span>
)

export default function Orders({ onNavigate }) {
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
          <span style={{fontSize:'12px', color:'var(--gray)'}}>4 pedidos esta temporada</span>
        </div>
        <div style={{padding:0}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>N° pedido</th><th>Cámara</th><th>Producto</th>
                <th>Sachets</th><th>Precio (USD)</th><th>Modelo</th>
                <th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {ORDERS.map(o => (
                <tr key={o.id}>
                  <td style={{fontWeight:700, color:'var(--navy)'}}># {o.id}</td>
                  <td>{o.room}</td>
                  <td>{productTag(o.product)}</td>
                  <td style={{fontFamily:'monospace', fontSize:'12px'}}>{o.sachets}</td>
                  <td style={{fontWeight:700}}>{o.price}</td>
                  <td>
                    <span style={{
                      background:'var(--cream-dark)', color:'var(--gray)',
                      fontSize:'11px', fontWeight:600, padding:'3px 10px',
                      borderRadius:'100px'
                    }}>{o.model}</span>
                  </td>
                  <td><span className={`status ${o.status}`}>{o.slabel}</span></td>
                  <td>
                    <button className="btn-secondary btn-sm">↺ Repetir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}