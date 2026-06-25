import generatorImg from '../../assets/images/MatriGenerator.png'
import generatorLogo from '../../assets/logos/MatriGenerator_Logo.svg'

const PRODUCTS = [
  {
    title:'Generador MaTri',
    price:'$850 USD',
    desc:'Unidad profesional de aplicación 1-MCP. Incluye batería recargable. ID individual asignado al momento de la compra.',
    btn:'Comprar',
    style:'primary',
  },
  {
    title:'Batería recargable',
    price:'$95 USD',
    desc:'Batería de repuesto para el generador MaTri. Compatibilidad garantizada con todas las unidades.',
    btn:'Comprar',
    style:'primary',
  },
  {
    title:'Alquiler de generador',
    price:'$45 USD/día',
    desc:'Alquilá un generador por los días que necesitás. Wassington confirma disponibilidad. Checklist previo incluido.',
    btn:'Solicitar alquiler',
    style:'lime',
  },
]

const MY_GENERATORS = [
  { id:'GEN-012', type:'Generador MaTri', status:'approved', slabel:'✓ Disponible', review:'10 jun 2026', notes:'—' },
]

export default function Generators() {
  return (
    <div>
      <div className="alert warn">
        📞 Si un generador falla durante el alquiler, contactá a Wassington: <strong>+54 299 XXX-XXXX</strong>
      </div>

      {/* Product cards */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'24px'}}>
        {PRODUCTS.map((p,i) => (
          <div key={i} style={{
            background:'white', border:'1.5px solid var(--border)',
            borderRadius:'var(--radius)', padding:'24px 20px',
            display:'flex', flexDirection:'column', alignItems:'center',
            textAlign:'center'
          }}>
            <img src={generatorImg} alt="Generador"
              style={{height:'100px', objectFit:'contain', marginBottom:'12px',
                opacity: i === 1 ? .6 : 1}}
            />
            <img src={generatorLogo} alt="MaTri Generator"
              style={{height:'22px', objectFit:'contain', marginBottom:'10px'}}
            />
            <div style={{fontSize:'20px', fontWeight:900, color:'var(--coral)', marginBottom:'6px'}}>
              {p.price}
            </div>
            <div style={{fontSize:'12px', color:'var(--gray)', lineHeight:1.6, marginBottom:'16px', flex:1}}>
              {p.desc}
            </div>
            <button
              className={p.style === 'lime' ? 'btn-lime' : 'btn-primary'}
              style={{width:'100%'}}
            >
              {p.btn}
            </button>
          </div>
        ))}
      </div>

      {/* My generators */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Mis generadores</span>
          <span style={{fontSize:'12px', color:'var(--gray)'}}>ID individual por unidad</span>
        </div>
        <div style={{padding:0}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID unidad</th><th>Tipo</th><th>Estado</th>
                <th>Última revisión</th><th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {MY_GENERATORS.map((g,i) => (
                <tr key={i}>
                  <td style={{fontWeight:700, fontFamily:'monospace'}}>{g.id}</td>
                  <td>{g.type}</td>
                  <td><span className={`status ${g.status}`}>{g.slabel}</span></td>
                  <td style={{color:'var(--gray)'}}>{g.review}</td>
                  <td style={{color:'var(--gray)'}}>{g.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}