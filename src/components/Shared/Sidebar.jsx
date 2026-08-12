import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import logoImg from '../../assets/logos/MatriPowder_Logo.svg'
import { ABOUT_PAGES } from '../../lib/aboutPages'
import LanguageSwitcher from './LanguageSwitcher'

const NAV_ITEMS = [
  { id: 'dashboard',   icon: '📊', labelKey: 'sidebar.nav.dashboard',   section: 'main' },
  { id: 'rooms',       icon: '🏠', labelKey: 'sidebar.nav.rooms',       section: null },
  { id: 'seasonplan',  icon: '🗓️', labelKey: 'sidebar.nav.seasonplan',  section: null },
  { id: 'calculator',  icon: '🧮', labelKey: 'sidebar.nav.calculator',  section: null },
  { id: 'treatments',  icon: '📦', labelKey: 'sidebar.nav.treatments',  section: null },
  { id: 'applog',      icon: '📋', labelKey: 'sidebar.nav.applog',      section: null },
  { id: 'myapplications', icon: '👷', labelKey: 'sidebar.nav.myApplications', section: null },
  { id: 'generators',  icon: '⚡', labelKey: 'sidebar.nav.generators',  section: 'equipment' },
  { id: 'documents',   icon: '📄', labelKey: 'sidebar.nav.documents',   section: 'info' },
  { id: 'knowledge-base', icon: '📚', labelKey: 'sidebar.nav.knowledgeBase', section: null,
    href: 'https://ar1xjl.github.io/Matri-argentina/1mcp-references.html' },
  { id: 'wassington',  icon: '⚙️', labelKey: 'sidebar.nav.controlPanel', section: 'admin' },
  { id: 'users',       icon: '👥', labelKey: 'sidebar.nav.users',       section: 'account' },
  { id: 'profile',     icon: '👤', labelKey: 'sidebar.nav.profile',     section: null },
]

export default function Sidebar({ activePanel, onNavigate, onSignOut, orgName = '', canSeeWassingtonPanel = true, canApplyTreatments = true, canSeeMyApplications = false, mobileOpen = false }) {
  const { t } = useTranslation()
  const initials = orgName.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()
  const navItems = NAV_ITEMS.filter(item =>
    (item.id !== 'wassington' || canSeeWassingtonPanel) &&
    (item.id !== 'applog' || canApplyTreatments) &&
    (item.id !== 'myapplications' || canSeeMyApplications)
  )

  // "Acerca del Portal" — manual de uso. Visible a todos, pero el contenido
  // que despliega está acotado: Global/Distribuidor/Sub-distribuidor ven las
  // 13 secciones, un Cliente solo ve "Calculadora, DoseRight y Knowledge
  // Base" (documenta su propia herramienta de uso diario).
  const aboutItems = ABOUT_PAGES.filter(p => canSeeWassingtonPanel || p.customerVisible)
  const [aboutOpen, setAboutOpen] = useState(activePanel.startsWith('about-'))
  // Anchor the group right after "Panel {orgName}" when it's visible; a
  // Customer never sees that item (filtered out above), so anchor to
  // whatever now renders last in that same slot — Knowledge Base — instead,
  // keeping the group in the same relative position either way.
  const aboutAnchorId = canSeeWassingtonPanel ? 'wassington' : 'knowledge-base'

  return (
    <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`} style={{
      width:'230px', minWidth:'230px', background:'#0b4358',
      display:'flex', flexDirection:'column',
      position:'fixed', top:0, left:0, bottom:0
    }}>
      {/* Logo */}
      <div style={{padding:'16px 20px 14px', borderBottom:'1px solid rgba(255,255,255,.1)'}}>
        <img src={logoImg} alt="MaTri" style={{height:'30px', filter:'brightness(0) invert(1)'}}/>
        <div style={{fontSize:'10px', color:'#607080', marginTop:'4px'}}>{t('sidebar.tagline')}</div>
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
                {t(`sidebar.sections.${item.section}`)}
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
                {t(item.labelKey)}
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
                {item.labelKey ? t(item.labelKey) : t('sidebar.panelOf', { orgName })}
              </div>
            )}

            {item.id === aboutAnchorId && (
              <div>
                <div
                  onClick={() => setAboutOpen(v => !v)}
                  style={{
                    display:'flex', alignItems:'center', gap:'10px',
                    padding:'10px 20px', fontSize:'13px', fontWeight:500,
                    color: aboutOpen ? 'white' : '#90b8c8',
                    cursor:'pointer', transition:'.15s'
                  }}
                >
                  <span style={{fontSize:'15px', width:'20px', textAlign:'center'}}>📘</span>
                  <span style={{flex:1}}>{t('sidebar.aboutPortal')}</span>
                  <span style={{fontSize:'10px', transform: aboutOpen ? 'rotate(180deg)' : 'none', transition:'.15s'}}>▾</span>
                </div>
                {aboutOpen && aboutItems.map(page => {
                  const panelId = `about-${page.id}`
                  return (
                    <div
                      key={page.id}
                      onClick={() => onNavigate(panelId)}
                      style={{
                        display:'flex', alignItems:'center', gap:'10px',
                        padding:'8px 20px 8px 40px', fontSize:'12.5px', fontWeight:500,
                        color: activePanel === panelId ? 'white' : '#7fa3ac',
                        background: activePanel === panelId ? 'rgba(181,204,46,.15)' : 'transparent',
                        borderLeft: activePanel === panelId ? '3px solid #b5cc2e' : '3px solid transparent',
                        cursor:'pointer', transition:'.15s'
                      }}
                    >
                      <span style={{fontSize:'13px', width:'16px', textAlign:'center'}}>{page.icon}</span>
                      {page.label}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Language */}
      <div style={{padding:'10px 20px', borderTop:'1px solid rgba(255,255,255,.1)'}}>
        <LanguageSwitcher dark />
      </div>

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
        <button onClick={onSignOut} title={t('sidebar.signOut')}
          style={{background:'none', border:'none', color:'#607080', fontSize:'16px', cursor:'pointer'}}>
          ⎋
        </button>
      </div>
    </aside>
  )
}
