import { useState } from 'react'
import Landing from './components/Landing/Landing'
import Portal from './components/Portal/Portal'
import AuthModal from './components/Auth/AuthModal'
import './index.css'

export default function App() {
  const [view, setView]           = useState('landing')
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
      {view === 'landing' && <Landing onOpenModal={openModal} />}
      {view === 'portal'  && <Portal onSignOut={() => setView('landing')} />}

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