import logoImg from '../../assets/logos/MatriPowder_Logo.svg'

const NAV_ITEMS = [
  { id: 'dashboard',   icon: '📊', label: 'Dashboard',               section: 'Principal' },
  { id: 'rooms',       icon: '🏠', label: 'Frigoríficos y Cámaras',  section: null },
  { id: 'seasonplan',  icon: '🗓️', label: 'Planificación de temporada', section: null },
  { id: 'calculator',  icon: '🧮', label: 'Calculadora de dosis',    section: null },
  { id: 'treatments',  icon: '📦', label: 'Tratamientos',            section: null },
  { id: 'applog',      icon: '📋', label: 'Registro de aplicaciones',section: null },
  { id: 'generators',  icon: '⚡', label: 'Generadores',             section: 'Equipamiento' },
  { id: 'documents',   icon: '📄', label: 'Documentos',              section: 'Información' },
  { id: 'knowledge-base', icon: '📚', label: 'MaTri Knowledge Base', section: null,
    href: 'https://ar1xjl.github.io/Matri-argentina/1mcp-references.html' },
  { id: 'wassington',  icon: '⚙️', label: null,                      section: 'Administración' },
  { id: 'profile',     icon: '👤', label: 'Mi perfil',               section: 'Cuenta' },
]

export default function Sidebar({ activePanel, onNavigate, onSignOut, orgName = '', canSeeWassingtonPanel = true, canApplyTreatments = true }) {
  const initials = orgName.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()
  const navItems = NAV_ITEMS.filter(item =>
    (item.id !== 'wassington' || canSeeWassingtonPanel) &&
    (item.id !== 'applog' || canApplyTreatments)
  )

  return (
    <aside style={{
      width:'230px', minWidth:'230px', background:'#0b4358',
      display:'flex', flexDirection:'column',
      position:'fixed', top:0, left:0, bottom:0, zIndex:50
    }}>
      {/* Logo */}
      <div style={{padding:'16px 20px 14px', borderBottom:'1px solid rgba(255,255,255,.1)'}}>
        <img src={logoImg} alt="MaTri" style={{height:'30px', filter:'brightness(0) invert(1)'}}/>
        <div style={{fontSize:'10px', color:'#607080', marginTop:'4px'}}>🇦🇷 Portal Argentina</div>
      </div>

      {/* Nav */}
      <nav style={{flex:1, padding:'8px 0', overflowY:'auto'}}>
        {navItems.map(item => (
          <div key={item.id}>
            {item.section && (
              <div style={{
                fontSize:'9px', fontWeight:700, letterSpacing:'.12em',
                textTransform:'uppercase', color:'#607080',
                padding:'14px 20px 5px'
              }}>
                {item.section}
              </div>
            )}
            {item.href ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display:'flex', alignItems:'center', gap:'10px',
                  padding:'10px 20px', fontSize:'13px', fontWeight:500,
                  color:'#90b8c8', textDecoration:'none',
                  borderLeft:'3px solid transparent',
                  cursor:'pointer', transition:'.15s'
                }}
              >
                <span style={{fontSize:'15px', width:'20px', textAlign:'center'}}>{item.icon}</span>
                {item.label}
              </a>
            ) : (
              <div
                onClick={() => onNavigate(item.id)}
                style={{
                  display:'flex', alignItems:'center', gap:'10px',
                  padding:'10px 20px', fontSize:'13px', fontWeight:500,
                  color: activePanel === item.id ? 'white' : '#90b8c8',
                  background: activePanel === item.id ? 'rgba(181,204,46,.15)' : 'transparent',
                  borderLeft: activePanel === item.id ? '3px solid #b5cc2e' : '3px solid transparent',
                  cursor:'pointer', transition:'.15s'
                }}
              >
                <span style={{fontSize:'15px', width:'20px', textAlign:'center'}}>{item.icon}</span>
                {item.label || `Panel ${orgName}`}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* User */}
      <div style={{
        padding:'14px 20px', borderTop:'1px solid rgba(255,255,255,.1)',
        display:'flex', alignItems:'center', gap:'10px'
      }}>
        <div style={{
          width:'32px', height:'32px', background:'#b5cc2e',
          borderRadius:'50%', display:'flex', alignItems:'center',
          justifyContent:'center', fontSize:'12px', fontWeight:800, color:'#0b4358'
        }}>{initials}</div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:'12px', fontWeight:700, color:'white',
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
            {orgName}
          </div>
        </div>
        <button onClick={onSignOut} title="Cerrar sesión"
          style={{background:'none', border:'none', color:'#607080', fontSize:'16px', cursor:'pointer'}}>
          ⎋
        </button>
      </div>
    </aside>
  )
}