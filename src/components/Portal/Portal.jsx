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
import Wassington from './Wassington'

const PANEL_TITLES = {
  dashboard:  'Dashboard',
  rooms:      'Cámaras y ubicaciones',
  orders:     'Pedidos',
  calculator: 'Calculadora de dosis',
  generators: 'Generadores',
  documents:  'Documentos',
  applog:     'Registro de aplicaciones',
  wassington: 'Panel Wassington',
  profile:    'Mi perfil',
}

// ── Initial shared order data — this simulates the database for now ──
const INITIAL_ORDERS = [
  { id:'ARG-0041', customer:'Kleppe S.A.', tier:'T1', room:'Cámara Norte 1', product:'MatriPowder',  sachets:'5×50g',       price:'215.00', model:'Servicio', status:'approved',  date:'20 jun 2026' },
  { id:'ARG-0040', customer:'Kleppe S.A.', tier:'T1', room:'Cámara Sur 3',   product:'MatriPowder',  sachets:'3×50g+1×25g', price:'178.00', model:'Propio',   status:'pending',   date:'18 jun 2026' },
  { id:'ARG-0039', customer:'Kleppe S.A.', tier:'T1', room:'Frigorífico A',  product:'MatriTablets', sachets:'2×50g+1×25g', price:'143.50', model:'Propio',   status:'approved',  date:'15 jun 2026' },
  { id:'ARG-0038', customer:'Kleppe S.A.', tier:'T1', room:'Cámara Norte 2', product:'MatriPowder',  sachets:'6×50g+1×10g', price:'262.00', model:'Servicio', status:'confirmed', date:'12 jun 2026' },
]

let orderCounter = 42

export default function Portal({ onSignOut }) {
  const [activePanel, setActivePanel] = useState('dashboard')
  const [seconds,     setSeconds]     = useState(600)
  const [showWarning, setShowWarning] = useState(false)
  const [orders,      setOrders]      = useState(INITIAL_ORDERS)
  const currentUser = { name:'Kleppe S.A.', tier:'T1', customer:'Kleppe S.A.' }

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => {
        if (s <= 1)   { clearInterval(timer); onSignOut(); return 0 }
        if (s === 121) setShowWarning(true)
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const resetSession = () => { setSeconds(600); setShowWarning(false) }
  const navigate     = (panel) => { setActivePanel(panel); resetSession() }

  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, '0')

  // ── Order actions — shared across Calculator, Orders, Wassington ──
  const addOrder = (newOrder) => {
    const id = `ARG-00${orderCounter++}`
    setOrders(prev => [{ ...newOrder, id, status:'pending', customer:'Kleppe S.A.', tier:'T1' }, ...prev])
    return id
  }

  const approveOrder = (id, finalPrice) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status:'approved', price: finalPrice ?? o.price } : o))
  }

  const rejectOrder = (id, reason) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status:'rejected', rejectReason: reason } : o))
  }

  const panels = {
    dashboard:  <Dashboard  onNavigate={navigate} orders={orders} />,
    rooms:      <Rooms />,
    orders:     <Orders     onNavigate={navigate} orders={orders} />,
calculator: <Calculator onOrderConfirmed={addOrder} onNavigate={navigate} userTier={currentUser.tier} />,    generators: <Generators />,
    documents:  <Documents />,
    applog:     <AppLog />,
    wassington: <Wassington orders={orders} onApprove={approveOrder} onReject={rejectOrder} />,
    profile:    <Profile />,
  }

  return (
    <div style={{display:'flex', minHeight:'100vh', background:'#f5f5ee'}}>
      <Sidebar
        activePanel={activePanel}
        onNavigate={navigate}
        onSignOut={onSignOut}
      />

      <main style={{marginLeft:'230px', flex:1, display:'flex', flexDirection:'column', minHeight:'100vh'}}>
        <div style={{
          background:'white', borderBottom:'0.5px solid #ddddd5',
          padding:'12px 28px', display:'flex', alignItems:'center',
          justifyContent:'space-between', position:'sticky', top:0, zIndex:40,
          boxShadow:'0 1px 3px rgba(0,0,0,.06)'
        }}>
          <h1 style={{fontSize:'17px', fontWeight:700, color:'#0b4358'}}>
            {PANEL_TITLES[activePanel]}
          </h1>
          <div style={{display:'flex', alignItems:'center', gap:'14px'}}>
            <div style={{
              background:'#f0f7e0', color:'#3b6d11',
              fontSize:'11px', fontWeight:700, padding:'4px 12px',
              borderRadius:'100px', letterSpacing:'.04em'
            }}>Temporada 2026</div>
            <div style={{
              fontSize:'11px', color:'#6b6b6b',
              display:'flex', alignItems:'center', gap:'5px'
            }}>
              <div style={{width:'7px', height:'7px', background:'#b5cc2e', borderRadius:'50%'}}/>
              {m}:{s}
            </div>
            <button className="btn-primary btn-sm" onClick={() => navigate('calculator')}>
              + Nuevo pedido
            </button>
          </div>
        </div>

        <div style={{padding:'24px', flex:1}}>
          {panels[activePanel]}
        </div>
      </main>

      {showWarning && (
        <div style={{
          position:'fixed', bottom:'20px', right:'20px',
          background:'#0b4358', color:'white',
          padding:'16px 20px', borderRadius:'12px',
          boxShadow:'0 4px 16px rgba(0,0,0,.15)',
          fontSize:'13px', zIndex:999, maxWidth:'300px',
          borderLeft:'4px solid #e8736a'
        }}>
          <div style={{fontWeight:700, color:'#e8736a', marginBottom:'6px'}}>
            ⚠️ Sesión por expirar
          </div>
          Tu sesión se cerrará en <strong>2 minutos</strong> por inactividad.
          <div style={{display:'flex', gap:'8px', marginTop:'10px'}}>
            <button onClick={resetSession} style={{
              background:'#b5cc2e', color:'#0b4358', border:'none',
              padding:'7px 14px', borderRadius:'6px',
              fontSize:'12px', fontWeight:700, cursor:'pointer'
            }}>Seguir conectado</button>
            <button onClick={onSignOut} style={{
              background:'transparent', color:'#90b8c8',
              border:'1px solid #607080', padding:'7px 14px',
              borderRadius:'6px', fontSize:'12px', cursor:'pointer'
            }}>Cerrar sesión</button>
          </div>
        </div>
      )}
    </div>
  )
}