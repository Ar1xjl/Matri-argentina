import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function AuthModal({ tab, onSwitchTab, onLogin, onClose }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

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
          {['login','register'].map(t => (
            <button
              key={t}
              onClick={() => onSwitchTab(t)}
              style={{
                flex:1, padding:'10px', textAlign:'center',
                fontSize:'14px', fontWeight:700, background:'none', border:'none',
                borderBottom: tab === t ? '3px solid #0b4358' : '3px solid transparent',
                color: tab === t ? '#0b4358' : '#6b7280',
                marginBottom:'-2px', cursor:'pointer'
              }}
            >
              {t === 'login' ? 'Ingresar' : 'Solicitar acceso'}
            </button>
          ))}
        </div>

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
            <p style={{fontSize:'13px', color:'#6b7280', textAlign:'center', marginTop:'16px'}}>
              ¿Olvidaste tu contraseña?{' '}
              <a href="#" style={{color:'#0b4358', fontWeight:700}}>Contactá a Wassington</a>
            </p>
          </div>
        )}

        {/* Register */}
        {tab === 'register' && (
          <div>
            <h2 style={{fontSize:'22px', fontWeight:900, color:'#0b4358', marginBottom:'6px'}}>
              Solicitar acceso
            </h2>
            <p style={{fontSize:'13px', color:'#6b7280', marginBottom:'24px'}}>
              Completá tus datos. Wassington validará tu cuenta en 24 hs.
            </p>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
              {[['Razón Social','Empresa S.A.'],['CUIT','XX-XXXXXXXX-X']].map(([label,ph]) => (
                <div key={label}>
                  <label style={{display:'block', fontSize:'12px', fontWeight:700,
                    color:'#0b4358', marginBottom:'5px', textTransform:'uppercase',
                    letterSpacing:'.04em'}}>{label}</label>
                  <input placeholder={ph} style={{
                    width:'100%', padding:'11px 14px', border:'1.5px solid #dde0d5',
                    borderRadius:'7px', fontSize:'14px', color:'#0b4358'
                  }}/>
                </div>
              ))}
            </div>
            {[['Situación Fiscal',['Responsable Inscripto','Monotributista','Exento']],
              ['Provincia / región',['Río Negro','Neuquén','Mendoza','Buenos Aires','Otra']]
            ].map(([label, opts]) => (
              <div key={label} style={{marginBottom:'14px', marginTop:'14px'}}>
                <label style={{display:'block', fontSize:'12px', fontWeight:700,
                  color:'#0b4358', marginBottom:'5px', textTransform:'uppercase',
                  letterSpacing:'.04em'}}>{label}</label>
                <select style={{width:'100%', padding:'11px 14px',
                  border:'1.5px solid #dde0d5', borderRadius:'7px',
                  fontSize:'14px', color:'#0b4358'}}>
                  {opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'14px'}}>
              {[['Email','email','email@empresa.com'],['Teléfono','tel','+54 XXX XXXX']].map(([label,type,ph]) => (
                <div key={label}>
                  <label style={{display:'block', fontSize:'12px', fontWeight:700,
                    color:'#0b4358', marginBottom:'5px', textTransform:'uppercase',
                    letterSpacing:'.04em'}}>{label}</label>
                  <input type={type} placeholder={ph} style={{
                    width:'100%', padding:'11px 14px', border:'1.5px solid #dde0d5',
                    borderRadius:'7px', fontSize:'14px', color:'#0b4358'
                  }}/>
                </div>
              ))}
            </div>
            <button
              className="btn-primary"
              style={{width:'100%', padding:'13px', fontSize:'15px', marginTop:'8px'}}
            >
              Enviar solicitud
            </button>
            <p style={{fontSize:'13px', color:'#6b7280', textAlign:'center', marginTop:'16px'}}>
              Recibirás un email cuando tu cuenta sea aprobada.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}