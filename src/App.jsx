import { useState, useEffect } from 'react'
import Landing from './components/Landing/Landing'
import Portal from './components/Portal/Portal'
import AuthModal from './components/Auth/AuthModal'
import { supabase } from './lib/supabaseClient'
import './index.css'

export default function App() {
  const [session,   setSession]   = useState(undefined) // undefined = still loading
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab,  setModalTab]  = useState('login')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const openModal = (tab = 'login') => {
    setModalTab(tab)
    setModalOpen(true)
  }

  const handleLogin = () => setModalOpen(false)
  const handleSignOut = () => supabase.auth.signOut()

  if (session === undefined) return null // avoid landing flash while session loads

  return (
    <>
      {!session && <Landing onOpenModal={openModal} />}
      {session  && <Portal onSignOut={handleSignOut} />}

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