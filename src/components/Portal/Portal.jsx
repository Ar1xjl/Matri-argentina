import { useState, useEffect } from 'react'
import Sidebar from '../Shared/Sidebar'
import Dashboard from './Dashboard'
import Rooms from './Rooms'
import Orders from './Orders'
import Calculator from './Calculator'
import Generators from './Generators'
import Documents from './Documents'
import AppLog from './AppLog'
import Profile from './Profile'

const PANEL_TITLES = {
  dashboard:  'Dashboard',
  rooms:      'Cámaras y ubicaciones',
  orders:     'Pedidos',
  calculator: 'Calculadora de dosis',
  generators: 'Generadores',
  documents:  'Documentos',
  applog:     'Registro de aplicaciones',
  profile:    'Mi perfil',
}

export default function Portal({ onSignOut }) {
  const [activePanel, setActivePanel] = useState('dashboard')
  const [seconds, setSeconds] = useState(600)
  const [showWarning, setShowWarning] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(timer); onSignOut(); return 0 }
        if (s === 121) setShowWarning(true)
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const resetSession = () => {
    setSeconds(600)
    setShowWarning(false)
  }

  const navigate = (panel) => {
    setActivePanel(panel)
    resetSession()
  }

  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, '0')

  const panels = {
    dashboard:  <Dashboard onNavigate={navigate} />,
    rooms:      <Rooms />,
    orders:     <Orders onNavigate={navigate} />,
    calculator: <Calculator />,
    generators: <Generators />,
    documents:  <Documents />,
    applog:     <AppLog />,
    profile:    <Profile />,
  }

  return (
    <div style={{display:'flex', minHeight:'100vh', background:'var(--cream)'}}>
      <Sidebar
        activePanel={activePanel}
        onNavigate={navigate}
        onSignOut={onSignOut}
      />

      <main style={{marginLeft:'230px', flex:1, display:'flex', flexDirection:'column'}}>
        {/* Top bar */}
        <div style={{
          background:'white', borderBottom:'1px solid var(--border)',
          padding:'12px 28px', display:'flex', alignItems:'center',
          justifyContent:'space-between', position:'sticky', top:0, zIndex:40
        }}>
          <h1 style={{fontSize:'18px', fontWeight:800, color:'var(--navy)'}}>
            {PANEL_TITLES[activePanel]}
          </h1>
          <div style={{display:'flex', alignItems:'center', gap:'14px'}}>
            <div style={{
              background:'var(--lime-pale)', color:'var(--navy)',
              fontSize:'11px', fontWeight:700, padding:'4px 12px',
              borderRadius:'100px', letterSpacing:'.04em'
            }}>Temporada 2026</div>
            <div style={{fontSize:'11px', color:'var(--gray)', display:'flex', alignItems:'center', gap:'5px'}}>
              <div style={{width:'7px', height:'7px', background:'var(--teal)', borderRadius:'50%'}}/>
              {m}:{s}
            </div>
            <button
              className="btn-primary btn-sm"
              onClick={() => navigate('calculator')}
            >+ Nuevo pedido</button>
          </div>
        </div>

        {/* Panel content */}
        <div style={{padding:'24px', flex:1}}>
          {panels[activePanel]}
        </div>
      </main>

      {/* Session warning */}
      {showWarning && (
        <div style={{
          position:'fixed', bottom:'20px', right:'20px',
          background:'var(--navy)', color:'white',
          padding:'16px 20px', borderRadius:'10px',
          boxShadow:'var(--shadow-lg)', fontSize:'13px',
          zIndex:999, maxWidth:'300px',
          borderLeft:'4px solid var(--coral)'
        }}>
          <div style={{fontWeight:700, color:'var(--coral)', marginBottom:'6px'}}>
            ⚠️ Sesión por expirar
          </div>
          Tu sesión se cerrará en <strong>2 minutos</strong> por inactividad.
          <div style={{display:'flex', gap:'8px', marginTop:'10px'}}>
            <button
              onClick={resetSession}
              style={{background:'var(--lime)', color:'var(--navy)', border:'none',
                padding:'7px 14px', borderRadius:'6px', fontSize:'12px',
                fontWeight:700, cursor:'pointer'}}
            >Seguir conectado</button>
            <button
              onClick={onSignOut}
              style={{background:'transparent', color:'#90b8c8',
                border:'1px solid #607080', padding:'7px 14px',
                borderRadius:'6px', fontSize:'12px', cursor:'pointer'}}
            >Cerrar sesión</button>
          </div>
        </div>
      )}
    </div>
  )
}