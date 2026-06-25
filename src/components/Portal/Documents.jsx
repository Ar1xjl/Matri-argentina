import powderLogo    from '../../assets/logos/MatriPowder_Logo.svg'
import tabletsLogo   from '../../assets/logos/MatriTablets_Logo.svg'
import generatorLogo from '../../assets/logos/MatriGenerator_Logo.svg'
import sureLogo      from '../../assets/logos/MatriSure_Logo.png'

const DOCS = [
  { logo: powderLogo,    name:'Etiqueta MatriPowder',          meta:'Versión 3 · 15 mar 2026 · Registro SENASA' },
  { logo: tabletsLogo,   name:'Etiqueta MatriTablets',         meta:'Versión 2 · 10 ene 2026 · Registro SENASA' },
  { logo: generatorLogo, name:'Manual del generador MaTri',    meta:'Versión 1 · 5 feb 2026' },
  { logo: sureLogo,      name:'Guía de uso — Kit MatriSure',   meta:'Versión 2 · 20 feb 2026' },
  { logo: powderLogo,    name:'Instrucciones de autoaplicación', meta:'Versión 1 · 1 mar 2026' },
]

export default function Documents() {
  return (
    <div>
      <div className="alert info">
        📄 Todos los documentos están actualizados. Wassington publica nuevas versiones cuando hay cambios regulatorios o de producto.
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Biblioteca de documentos</span>
          <span style={{fontSize:'12px', color:'var(--gray)'}}>5 documentos vigentes</span>
        </div>
        <div className="card-body" style={{padding:'8px 0'}}>
          {DOCS.map((d,i) => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:'16px',
              padding:'14px 18px',
              borderBottom: i < DOCS.length-1 ? '1px solid var(--border)' : 'none',
            }}>
              <img src={d.logo} alt="" style={{height:'28px', objectFit:'contain', flexShrink:0, width:'80px'}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px', fontWeight:700, color:'var(--navy)'}}>{d.name}</div>
                <div style={{fontSize:'11px', color:'var(--gray)', marginTop:'2px'}}>{d.meta}</div>
              </div>
              <span style={{
                background:'var(--teal-lt)', color:'var(--teal)',
                fontSize:'10px', fontWeight:700, padding:'3px 10px',
                borderRadius:'100px', whiteSpace:'nowrap'
              }}>Vigente</span>
              <button className="btn-secondary btn-sm">⬇ Descargar</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}