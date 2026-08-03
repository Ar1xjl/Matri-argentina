import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'

export default function ResetPassword({ onDone }) {
  const { t } = useTranslation()
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword]  = useState('')
  const [error,           setError]           = useState('')
  const [loading,         setLoading]         = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (password.length < 6) { setError(t('resetPassword.tooShort')); return }
    if (password !== confirmPassword) { setError(t('resetPassword.mismatch')); return }
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) { setError(updateError.message); return }
    onDone()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(7,46,61,.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'white', borderRadius: '14px', padding: '40px 36px',
        width: '100%', maxWidth: '420px',
        boxShadow: '0 8px 32px rgba(11,67,88,.15)'
      }}>
        <h2 style={{fontSize:'22px', fontWeight:900, color:'#0b4358', marginBottom:'6px'}}>
          {t('resetPassword.title')}
        </h2>
        <p style={{fontSize:'13px', color:'#6b7280', marginBottom:'24px'}}>
          {t('resetPassword.subtitle')}
        </p>
        {[
          [t('resetPassword.newPasswordLabel'), password, setPassword],
          [t('resetPassword.confirmPasswordLabel'), confirmPassword, setConfirmPassword],
        ].map(([label, value, setValue]) => (
          <div key={label} style={{marginBottom:'16px'}}>
            <label style={{display:'block', fontSize:'12px', fontWeight:700,
              color:'#0b4358', marginBottom:'5px', textTransform:'uppercase',
              letterSpacing:'.04em'}}>{label}</label>
            <input
              type="password" placeholder="••••••••" value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{
                width:'100%', padding:'11px 14px', border:'1.5px solid #dde0d5',
                borderRadius:'7px', fontSize:'14px', color:'#0b4358'
              }}/>
          </div>
        ))}
        {error && (
          <div style={{fontSize:'12px', color:'#8b2020', marginBottom:'12px'}}>{error}</div>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary"
          style={{width:'100%', padding:'13px', fontSize:'15px', marginTop:'8px', opacity: loading ? .6 : 1}}
        >
          {loading ? t('resetPassword.submitting') : t('resetPassword.submit')}
        </button>
      </div>
    </div>
  )
}
