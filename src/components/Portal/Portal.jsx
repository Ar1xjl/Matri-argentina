import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../Shared/Sidebar'
import Dashboard from './Dashboard'
import Rooms from './Rooms'
import Treatments from './Treatments'
import Calculator from './Calculator'
import Generators from './Generators'
import Documents from './Documents'
import AppLog from './AppLog'
import Profile from './Profile'
import Wassington from './Wassington'
import { supabase } from '../../lib/supabaseClient'

const PANEL_TITLES = {
  dashboard:  'Dashboard',
  rooms:      'Cámaras y ubicaciones',
  treatments: 'Tratamientos',
  calculator: 'Calculadora de dosis',
  generators: 'Generadores',
  documents:  'Documentos',
  applog:     'Registro de aplicaciones',
  wassington: 'Panel Wassington',
  profile:    'Mi perfil',
}

export default function Portal({ onSignOut }) {
  const [activePanel, setActivePanel] = useState('dashboard')
  const [seconds,     setSeconds]     = useState(600)
  const [showWarning, setShowWarning] = useState(false)
  const [profile,     setProfile]     = useState(null)   // { id, org_id, full_name, organizations: {...} }
  const [coldRooms,   setColdRooms]   = useState([])
  const [treatments,  setTreatments]  = useState([])
  const [loading,     setLoading]     = useState(true)

  const loadTreatments = useCallback(async () => {
    const { data, error } = await supabase
      .from('treatments')
      .select('*, cold_rooms(name, volume_m3), organizations(name), matrisure_verifications(photo_url, result, reviewed_at, assistance_requested)')
      .order('created_at', { ascending: false })
    if (error) { console.error(error); return }
    setTreatments(data)
  }, [])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, organizations(*)')
        .eq('id', user.id)
        .single()
      if (profileError) { console.error(profileError); setLoading(false); return }
      setProfile(profileData)

      const { data: rooms } = await supabase
        .from('cold_rooms')
        .select('*')
        .eq('org_id', profileData.org_id)
      setColdRooms(rooms || [])

      await loadTreatments()
      setLoading(false)
    })()
  }, [loadTreatments])

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

  // ── Treatment actions — shared across Calculator, Treatments, Wassington ──
  const addColdRoom = async (newRoom) => {
    const { error } = await supabase
      .from('cold_rooms')
      .insert({ ...newRoom, org_id: profile.org_id })
    if (error) { console.error(error); return }
    const { data: rooms } = await supabase.from('cold_rooms').select('*').eq('org_id', profile.org_id)
    setColdRooms(rooms || [])
  }

  const addTreatment = async (newTreatment) => {
    const { data, error } = await supabase
      .from('treatments')
      .insert({ ...newTreatment, org_id: profile.org_id, status: 'submitted', created_by: profile.id })
      .select()
      .single()
    if (error) { console.error(error); return null }
    await loadTreatments()
    return data.id
  }

  const approveTreatment = async (id, finalPrice) => {
    const { error } = await supabase
      .from('treatments')
      .update({ status: 'approved', price_local: finalPrice, approved_by: profile.id, approved_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { console.error(error); return }
    await loadTreatments()
  }

  const rejectTreatment = async (id, reason) => {
    const { error } = await supabase
      .from('treatments')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', id)
    if (error) { console.error(error); return }
    await loadTreatments()
  }

  // Approved → Applied: Operator records execution details
  // Returns { error: string|null } instead of swallowing failures — the UI
  // must be able to tell the user something went wrong instead of silently
  // acting as if it succeeded.
  const applyTreatment = async (id, { startTime, endTime }) => {
    // startTime/endTime come from <input type="datetime-local"> as full
    // "YYYY-MM-DDTHH:MM" values — each carries its own date, since many
    // treatments start one afternoon and finish the next day.
    const { error } = await supabase
      .from('treatments')
      .update({
        status: 'applied',
        operator_id: profile.id,
        applied_at: new Date().toISOString(),
        application_start_time: startTime || null,
        application_end_time: endTime || null,
      })
      .eq('id', id)
    if (error) { console.error('[applyTreatment]', error); return { error: error.message } }
    await loadTreatments()
    return { error: null }
  }

  // Applied → Completed: upload MatriSure photo, self-confirm or escalate for assistance
  const submitMatriSure = async (treatmentId, photoBlob, { result, assistanceRequested }) => {
    const path = `${profile.org_id}/${treatmentId}/${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('matrisure-photos')
      .upload(path, photoBlob, { contentType: 'image/jpeg' })
    if (uploadError) { console.error('[submitMatriSure upload]', uploadError); return { error: uploadError.message } }

    const isReviewed = result !== 'pending_review'
    const { error: insertError } = await supabase.from('matrisure_verifications').insert({
      treatment_id: treatmentId,
      photo_url: path,
      result,
      assistance_requested: assistanceRequested,
      reviewed_by: isReviewed ? profile.id : null,
      reviewed_at: isReviewed ? new Date().toISOString() : null,
    })
    if (insertError) { console.error('[submitMatriSure insert]', insertError); return { error: insertError.message } }

    if (isReviewed) {
      const { error: updateError } = await supabase.from('treatments').update({ status: 'completed' }).eq('id', treatmentId)
      if (updateError) { console.error('[submitMatriSure update]', updateError); return { error: updateError.message } }
    }
    await loadTreatments()
    return { error: null }
  }

  // Bucket is private — every view needs a fresh signed URL, not a stored public link.
  const getMatriSurePhotoUrl = async (path) => {
    const { data, error } = await supabase.storage
      .from('matrisure-photos')
      .createSignedUrl(path, 60 * 5)
    if (error) { console.error(error); return null }
    return data.signedUrl
  }

  if (loading) {
    return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>Cargando...</div>
  }

  const currentUser = { name: profile?.organizations?.name || '', orgId: profile?.org_id }

  const panels = {
    dashboard:  <Dashboard  onNavigate={navigate} treatments={treatments} />,
    rooms:      <Rooms coldRooms={coldRooms} treatments={treatments} onAddRoom={addColdRoom} />,
    treatments: <Treatments onNavigate={navigate} treatments={treatments} onGetPhotoUrl={getMatriSurePhotoUrl} />,
    calculator: <Calculator onTreatmentConfirmed={addTreatment} onNavigate={navigate} coldRooms={coldRooms} orgId={profile?.org_id} />,
    generators: <Generators />,
    documents:  <Documents />,
    applog:     <AppLog treatments={treatments} operatorName={profile?.full_name} onApply={applyTreatment} onSubmitMatriSure={submitMatriSure} />,
    wassington: <Wassington treatments={treatments} onApprove={approveTreatment} onReject={rejectTreatment} onGetPhotoUrl={getMatriSurePhotoUrl} />,
    profile:    <Profile />,
  }

  return (
    <div style={{display:'flex', minHeight:'100vh', background:'#f5f5ee'}}>
      <Sidebar
        activePanel={activePanel}
        onNavigate={navigate}
        onSignOut={onSignOut}
        orgName={currentUser.name}
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
              + Nuevo tratamiento
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
