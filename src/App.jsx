import { useState } from 'react'
import Landing from './components/Landing/Landing'
import AuthModal from './components/Auth/AuthModal'
import './index.css'

export default function App() {
  const [view, setView]       = useState('landing')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab]   = useState('login')

  const openModal = (tab = 'login') => {
    setModalTab(tab)
    setModalOpen(true)
  }

  const handleLogin = () => {
    setModalOpen(false)
    setView('portal')
  }

  return (
    <>
      {view === 'landing' && (
        <Landing onOpenModal={openModal} />
      )}

      {view === 'portal' && (
        <div style={{textAlign:'center', marginTop:'100px'}}>
          <h1 style={{color:'#0b4358', fontSize:'28px', fontWeight:900}}>
            Portal — próximo paso ✅
          </h1>
          <button
            onClick={() => setView('landing')}
            style={{marginTop:'24px', background:'#0b4358', color:'white',
              border:'none', padding:'12px 28px', borderRadius:'8px',
              fontSize:'15px', fontWeight:700, cursor:'pointer'}}
          >
            Volver al inicio
          </button>
        </div>
      )}

      {modalOpen && (
        <AuthModal
          tab={modalTab}
          onSwitchTab={setModalTab}
          onLogin={handleLogin}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}