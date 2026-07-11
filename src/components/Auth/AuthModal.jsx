import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const ROLE_LABELS = { owner: 'Owner', approver: 'Aprobador', planner: 'Planificador', operator: 'Operador', viewer: 'Viewer' }

export default function AuthModal({ tab, onSwitchTab, onLogin, onClose, inviteInfo }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const [signupName,     setSignupName]     = useState('')
  const [signupEmail,    setSignupEmail]    = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupError,    setSignupError]    = useState('')
  const [signupLoading,  setSignupLoading]  = useState(false)
  const [signupDone,     setSignupDone]     = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState(false)

  const [resetLoading, setResetLoading] = useState(false)
  const [resetError,   setResetError]   = useState('')
  const [resetSent,    setResetSent]    = useState(false)

  const [companyName, setCompanyName] = useState('')
  const [taxId,        setTaxId]        = useState('')
  const [taxStatus,    setTaxStatus]    = useState('Responsable Inscripto')
  const [region,       setRegion]       = useState('Río Negro')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [registerError,   setRegisterError]   = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerDone,    setRegisterDone]    = useState(false)

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) {
      setError(signInError.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos.'
        : signInError.message)
      return
    }
    onLogin()
  }

  // Sends a real recovery email — no admin/service_role needed, same as any
  // public "forgot password" flow. App.jsx listens for the PASSWORD_RECOVERY
  // auth event and shows ResetPassword.jsx when the user comes back via the
  // emailed link.
  const handleForgotPassword = async () => {
    setResetError('')
    if (!email.trim()) { setResetError('Escribí tu email arriba primero.'); return }
    setResetLoading(true)
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    setResetLoading(false)
    if (resetErr) { setResetError(resetErr.message); return }
    setResetSent(true)
  }

  // Creates the Auth account only — no Organization/role yet. An Owner
  // assigns it afterward from "Usuarios" (Rule 19: self-service by the
  // Organization's own Owner, not an automatic email invite — see
  // DOMAIN_MODEL.md's note on why this app has no privileged invite flow).
  const handleSignup = async () => {
    setSignupError('')
    if (!signupName.trim()) { setSignupError('Completá tu nombre.'); return }
    setSignupLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: { data: { full_name: signupName.trim() } },
    })
    setSignupLoading(false)
    if (signUpError) { setSignupError(signUpError.message); return }
    if (data.session) { onLogin(); return }
    setPendingConfirm(true)
    setSignupDone(true)
  }

  // No account needed yet — this is a public intake form (anon insert,
  // see migration 0011). A Distributor/Sub-distributor/Global staff member
  // reviews it later from Organizaciones and creates the real Organization.
  const handleRegister = async () => {
    setRegisterError('')
    if (!companyName.trim()) { setRegisterError('Completá la Razón Social.'); return }
    if (!companyEmail.trim()) { setRegisterError('Completá un email de contacto.'); return }
    setRegisterLoading(true)
    const { error: insertError } = await supabase.from('organization_access_requests').insert({
      company_name: companyName.trim(),
      tax_id: taxId.trim() || null,
      tax_status: taxStatus,
      region,
      contact_email: companyEmail.trim(),
      contact_phone: companyPhone.trim() || null,
    })
    setRegisterLoading(false)
    if (insertError) { setRegisterError(insertError.message); return }
    setRegisterDone(true)
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(7,46,61,.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      <div style={{
        background: 'white', borderRadius: '14px', padding: '40px 36px',
        width: '100%', maxWidth: '420px', position: 'relative',
        boxShadow: '0 8px 32px rgba(11,67,88,.15)'
      }}>
        <button
          onClick={onClose}
          style={{position:'absolute', top:16, right:18, background:'none',
            border:'none', fontSize:'22px', color:'#6b7280', cursor:'pointer'}}
        >✕</button>

        {/* Tabs */}
        <div style={{display:'flex', borderBottom:'2px solid #dde0d5', marginBottom:'24px'}}>
          {['login','signup','register'].map(t => (
            <button
              key={t}
              onClick={() => onSwitchTab(t)}
              style={{
                flex:1, padding:'10px', textAlign:'center',
                fontSize:'13px', fontWeight:700, background:'none', border:'none',
                borderBottom: tab === t ? '3px solid #0b4358' : '3px solid transparent',
                color: tab === t ? '#0b4358' : '#6b7280',
                marginBottom:'-2px', cursor:'pointer'
              }}
            >
              {t === 'login' ? 'Ingresar' : t === 'signup' ? 'Crear usuario' : 'Nueva empresa'}
            </button>
          ))}
        </div>

        {inviteInfo && (tab === 'login' || tab === 'signup') && (
          <div style={{fontSize:'12.5px', color:'#0b4358', background:'#eef3ea', border:'1px solid #d3e0c8', borderRadius:'8px', padding:'11px 14px', marginBottom:'20px'}}>
            🔗 Te invitaron a unirte a <strong>{inviteInfo.org_name}</strong> como {inviteInfo.roles.map(r => ROLE_LABELS[r] || r).join(', ')}.
            {tab === 'login' ? ' Ingresá para asignarte automáticamente.' : ' Creá tu usuario para asignarte automáticamente.'}
          </div>
        )}

        {/* Login */}
        {tab === 'login' && (
          <div>
            <h2 style={{fontSize:'22px', fontWeight:900, color:'#0b4358', marginBottom:'6px'}}>
              Bienvenido
            </h2>
            <p style={{fontSize:'13px', color:'#6b7280', marginBottom:'24px'}}>
              Ingresá con tu email y contraseña.
            </p>
            {[
              ['Email','email','empresa@correo.com', email, setEmail],
              ['Contraseña','password','••••••••', password, setPassword],
            ].map(([label,type,ph,value,setValue]) => (
              <div key={label} style={{marginBottom:'16px'}}>
                <label style={{display:'block', fontSize:'12px', fontWeight:700,
                  color:'#0b4358', marginBottom:'5px', textTransform:'uppercase',
                  letterSpacing:'.04em'}}>{label}</label>
                <input
                  type={type} placeholder={ph} value={value}
                  onChange={e => setValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
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
              onClick={handleLogin}
              disabled={loading}
              className="btn-primary"
              style={{width:'100%', padding:'13px', fontSize:'15px', marginTop:'8px', opacity: loading ? .6 : 1}}
            >
              {loading ? 'Ingresando…' : 'Ingresar al portal'}
            </button>
            {resetSent ? (
              <div style={{fontSize:'12px', color:'#1a6b30', background:'#eaf7ee', border:'1px solid #a3d9b0', borderRadius:'8px', padding:'10px', textAlign:'center', marginTop:'16px'}}>
                ✓ Te enviamos un email a {email} con un link para elegir una nueva contraseña.
              </div>
            ) : (
              <>
                <p style={{fontSize:'13px', color:'#6b7280', textAlign:'center', marginTop:'16px', marginBottom:0}}>
                  ¿Olvidaste tu contraseña?{' '}
                  <a href="#" onClick={(e) => { e.preventDefault(); handleForgotPassword() }} style={{color:'#0b4358', fontWeight:700}}>
                    {resetLoading ? 'Enviando…' : 'Recuperarla por email'}
                  </a>
                </p>
                {resetError && (
                  <div style={{fontSize:'12px', color:'#8b2020', textAlign:'center', marginTop:'8px'}}>{resetError}</div>
                )}
              </>
            )}
          </div>
        )}

        {/* Signup — creates a login only; a Distributor/Customer Owner
            assigns it to their Organization afterward from "Usuarios". */}
        {tab === 'signup' && (
          <div>
            <h2 style={{fontSize:'22px', fontWeight:900, color:'#0b4358', marginBottom:'6px'}}>
              Crear usuario
            </h2>
            <p style={{fontSize:'13px', color:'#6b7280', marginBottom:'24px'}}>
              Creá tu login personal. Después, quien administre tu empresa en el portal te va a asignar a la cuenta correspondiente.
            </p>
            {signupDone ? (
              <div style={{fontSize:'13px', color:'#1a6b30', background:'#eaf7ee', border:'1px solid #a3d9b0', borderRadius:'8px', padding:'14px'}}>
                {pendingConfirm
                  ? '✓ Usuario creado. Revisá tu email para confirmarlo antes de ingresar.'
                  : '✓ Usuario creado. Ya podés ingresar.'}
              </div>
            ) : (
              <>
                {[
                  ['Nombre completo','text','Tu nombre y apellido', signupName, setSignupName],
                  ['Email','email','vos@empresa.com', signupEmail, setSignupEmail],
                  ['Contraseña','password','••••••••', signupPassword, setSignupPassword],
                ].map(([label,type,ph,value,setValue]) => (
                  <div key={label} style={{marginBottom:'16px'}}>
                    <label style={{display:'block', fontSize:'12px', fontWeight:700,
                      color:'#0b4358', marginBottom:'5px', textTransform:'uppercase',
                      letterSpacing:'.04em'}}>{label}</label>
                    <input
                      type={type} placeholder={ph} value={value}
                      onChange={e => setValue(e.target.value)}
                      style={{
                        width:'100%', padding:'11px 14px', border:'1.5px solid #dde0d5',
                        borderRadius:'7px', fontSize:'14px', color:'#0b4358'
                      }}/>
                  </div>
                ))}
                {signupError && (
                  <div style={{fontSize:'12px', color:'#8b2020', marginBottom:'12px'}}>{signupError}</div>
                )}
                <button
                  onClick={handleSignup}
                  disabled={signupLoading}
                  className="btn-primary"
                  style={{width:'100%', padding:'13px', fontSize:'15px', marginTop:'8px', opacity: signupLoading ? .6 : 1}}
                >
                  {signupLoading ? 'Creando…' : 'Crear usuario'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Register */}
        {tab === 'register' && (
          <div>
            <h2 style={{fontSize:'22px', fontWeight:900, color:'#0b4358', marginBottom:'6px'}}>
              Solicitar acceso — nueva empresa
            </h2>
            <p style={{fontSize:'13px', color:'#6b7280', marginBottom:'24px'}}>
              Completá tus datos. Tu distribuidor validará tu cuenta.
            </p>
            {registerDone ? (
              <div style={{fontSize:'13px', color:'#1a6b30', background:'#eaf7ee', border:'1px solid #a3d9b0', borderRadius:'8px', padding:'14px'}}>
                ✓ Solicitud enviada. Te van a contactar por email cuando tu cuenta esté habilitada.
              </div>
            ) : (
              <>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                  {[['Razón Social','text','Empresa S.A.', companyName, setCompanyName],
                    ['CUIT','text','XX-XXXXXXXX-X', taxId, setTaxId]].map(([label,type,ph,value,setValue]) => (
                    <div key={label}>
                      <label style={{display:'block', fontSize:'12px', fontWeight:700,
                        color:'#0b4358', marginBottom:'5px', textTransform:'uppercase',
                        letterSpacing:'.04em'}}>{label}</label>
                      <input type={type} placeholder={ph} value={value} onChange={e => setValue(e.target.value)} style={{
                        width:'100%', padding:'11px 14px', border:'1.5px solid #dde0d5',
                        borderRadius:'7px', fontSize:'14px', color:'#0b4358'
                      }}/>
                    </div>
                  ))}
                </div>
                {[['Situación Fiscal',['Responsable Inscripto','Monotributista','Exento'], taxStatus, setTaxStatus],
                  ['Provincia / región',['Río Negro','Neuquén','Mendoza','Buenos Aires','Otra'], region, setRegion]
                ].map(([label, opts, value, setValue]) => (
                  <div key={label} style={{marginBottom:'14px', marginTop:'14px'}}>
                    <label style={{display:'block', fontSize:'12px', fontWeight:700,
                      color:'#0b4358', marginBottom:'5px', textTransform:'uppercase',
                      letterSpacing:'.04em'}}>{label}</label>
                    <select value={value} onChange={e => setValue(e.target.value)} style={{width:'100%', padding:'11px 14px',
                      border:'1.5px solid #dde0d5', borderRadius:'7px',
                      fontSize:'14px', color:'#0b4358'}}>
                      {opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'14px'}}>
                  {[['Email','email','email@empresa.com', companyEmail, setCompanyEmail],
                    ['Teléfono','tel','+54 XXX XXXX', companyPhone, setCompanyPhone]].map(([label,type,ph,value,setValue]) => (
                    <div key={label}>
                      <label style={{display:'block', fontSize:'12px', fontWeight:700,
                        color:'#0b4358', marginBottom:'5px', textTransform:'uppercase',
                        letterSpacing:'.04em'}}>{label}</label>
                      <input type={type} placeholder={ph} value={value} onChange={e => setValue(e.target.value)} style={{
                        width:'100%', padding:'11px 14px', border:'1.5px solid #dde0d5',
                        borderRadius:'7px', fontSize:'14px', color:'#0b4358'
                      }}/>
                    </div>
                  ))}
                </div>
                {registerError && (
                  <div style={{fontSize:'12px', color:'#8b2020', marginBottom:'12px'}}>{registerError}</div>
                )}
                <button
                  onClick={handleRegister}
                  disabled={registerLoading}
                  className="btn-primary"
                  style={{width:'100%', padding:'13px', fontSize:'15px', marginTop:'8px', opacity: registerLoading ? .6 : 1}}
                >
                  {registerLoading ? 'Enviando…' : 'Enviar solicitud'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}