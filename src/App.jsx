import { useState, useEffect } from 'react'
import Landing from './components/Landing/Landing'
import Portal from './components/Portal/Portal'
import AuthModal from './components/Auth/AuthModal'
import ResetPassword from './components/Auth/ResetPassword'
import { supabase } from './lib/supabaseClient'
import './index.css'

export default function App() {
  const [session,   setSession]   = useState(undefined) // undefined = still loading
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab,  setModalTab]  = useState('login')
  const [recovering, setRecovering] = useState(false) // came in via a "reset password" email link

  // Invitation link (?invite=<token>) — see migration 0014. inviteToken stays
  // set until redeemed (or found invalid), so a page refresh doesn't lose it.
  const [inviteToken, setInviteToken] = useState(() => new URLSearchParams(window.location.search).get('invite'))
  const [inviteInfo, setInviteInfo] = useState(null) // { org_name, roles } | null
  const [inviteChecked, setInviteChecked] = useState(false)
  const [autoOpenedInvite, setAutoOpenedInvite] = useState(null) // last inviteInfo we already auto-opened the modal for
  const [inviteRedeemError, setInviteRedeemError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Look up the invite's Organization/roles as soon as we see the token —
  // works for a fully anonymous visitor (get_invite_info is a public RPC).
  useEffect(() => {
    const lookup = inviteToken
      ? supabase.rpc('get_invite_info', { p_token: inviteToken })
      : Promise.resolve({ data: null, error: null })
    lookup.then(({ data, error }) => {
      setInviteInfo(!error && data && data.length > 0 ? data[0] : null)
      setInviteChecked(true)
    })
  }, [inviteToken])

  // Once a valid invite resolves and there's no session yet, jump straight
  // into signup so the visitor doesn't have to hunt for it themselves. This
  // adjusts state during render (React's recommended pattern for "react to a
  // prop/state change once") rather than in an effect, so re-opening the
  // modal after the visitor manually closes it doesn't happen.
  if (inviteChecked && inviteInfo && inviteInfo !== autoOpenedInvite && session === null) {
    setAutoOpenedInvite(inviteInfo)
    setModalTab('signup')
    setModalOpen(true)
  }

  // As soon as a session exists (just signed up, just logged in, or was
  // already logged in when the link was opened), redeem it — assigns
  // profiles/user_roles for the org_id/roles baked into the invite.
  useEffect(() => {
    if (!session || !inviteToken || !inviteInfo) return
    supabase.rpc('redeem_invite', { p_token: inviteToken }).then(({ error }) => {
      if (error) setInviteRedeemError(error.message)
      const url = new URL(window.location.href)
      url.searchParams.delete('invite')
      window.history.replaceState({}, '', url)
      setInviteToken(null)
      setInviteInfo(null)
    })
  }, [session, inviteToken, inviteInfo])

  const openModal = (tab = 'login') => {
    setModalTab(tab)
    setModalOpen(true)
  }

  const handleLogin = () => setModalOpen(false)
  const handleSignOut = () => supabase.auth.signOut()

  if (session === undefined) return null // avoid landing flash while session loads

  if (recovering) {
    return <ResetPassword onDone={() => setRecovering(false)} />
  }

  return (
    <>
      {!session && <Landing onOpenModal={openModal} />}
      {session  && <Portal onSignOut={handleSignOut} />}

      {inviteRedeemError && (
        <div style={{
          position:'fixed', top:'16px', left:'50%', transform:'translateX(-50%)', zIndex:300,
          background:'#fdeaea', color:'#8b2020', border:'1px solid #f0c7c7', borderRadius:'10px',
          padding:'12px 20px', fontSize:'13px', boxShadow:'0 4px 16px rgba(0,0,0,.15)',
          display:'flex', alignItems:'center', gap:'14px', maxWidth:'90vw'
        }}>
          ⚠️ {inviteRedeemError}
          <button onClick={() => setInviteRedeemError('')} style={{background:'none', border:'none', color:'#8b2020', fontSize:'16px', cursor:'pointer'}}>✕</button>
        </div>
      )}

      {modalOpen && (
        <AuthModal
          tab={modalTab}
          onSwitchTab={setModalTab}
          onLogin={handleLogin}
          onClose={() => setModalOpen(false)}
          inviteInfo={inviteInfo}
        />
      )}
    </>
  )
}