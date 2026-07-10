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
import Users from './Users'
import Wassington from './Wassington'
import SeasonPlan from './SeasonPlan'
import SeasonPlanRollup from './SeasonPlanRollup'
import { supabase } from '../../lib/supabaseClient'
import { parsePlanFile } from '../../lib/excelImport'
import { DOSE_BASE, greedyCeiling, tabletCombo } from '../../lib/dosing'
import { fetchPouchCatalog } from '../../lib/orgPricing'

const PANEL_TITLES = {
  dashboard:   'Dashboard',
  rooms:       'Frigoríficos y Cámaras',
  treatments:  'Tratamientos',
  calculator:  'Calculadora de dosis',
  seasonplan:  'Planificación de temporada',
  generators:  'Generadores',
  documents:   'Documentos',
  applog:      'Registro de aplicaciones',
  users:       'Usuarios',
  profile:     'Mi perfil',
}

export default function Portal({ onSignOut }) {
  const [activePanel, setActivePanel] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false) // mobile drawer only — desktop sidebar is always visible
  const [seconds,     setSeconds]     = useState(600)
  const [showWarning, setShowWarning] = useState(false)
  const [profile,     setProfile]     = useState(null)   // { id, org_id, full_name, organizations: {...} }
  const [coldRooms,   setColdRooms]   = useState([])
  const [allRooms,    setAllRooms]    = useState([]) // subtree-wide — Cámaras screen only
  const [treatments,  setTreatments]  = useState([])
  const [seasonPlan,      setSeasonPlan]      = useState(null)
  const [seasonPlanLines, setSeasonPlanLines] = useState([])
  const [conversionQueue, setConversionQueue] = useState([]) // Plan Lines still to convert, in order
  const [loading,     setLoading]     = useState(true)
  const [notAssigned, setNotAssigned] = useState(false)

  const loadTreatments = useCallback(async () => {
    const { data, error } = await supabase
      .from('treatments')
      .select('*, cold_rooms(name, volume_m3), organizations(name), matrisure_verifications(photo_url, result, reviewed_at, assistance_requested)')
      .order('created_at', { ascending: false })
    if (error) { console.error(error); return }
    setTreatments(data)
  }, [])

  // One active Season Plan per Organization — auto-created on first visit.
  const loadSeasonPlan = useCallback(async (orgId, profileId) => {
    let { data: plan } = await supabase
      .from('season_plans')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!plan) {
      const { data: created, error } = await supabase
        .from('season_plans')
        .insert({ org_id: orgId, season_label: `Temporada ${new Date().getFullYear()}`, created_by: profileId })
        .select()
        .single()
      if (error) { console.error(error); return }
      plan = created
    }
    setSeasonPlan(plan)

    const { data: lines } = await supabase
      .from('season_plan_lines')
      .select('*')
      .eq('season_plan_id', plan.id)
      .order('planned_date', { ascending: true, nullsFirst: false })
    setSeasonPlanLines(lines || [])
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
      if (profileError) {
        // PGRST116 = no profile row yet — a self-registered account (see
        // AuthModal's "Crear cuenta") waiting for an Owner to assign it to
        // an Organization, not a real error.
        if (profileError.code === 'PGRST116') setNotAssigned(true)
        else console.error(profileError)
        setLoading(false)
        return
      }
      setProfile(profileData)

      const { data: rooms } = await supabase
        .from('cold_rooms')
        .select('*')
        .eq('org_id', profileData.org_id)
      setColdRooms(rooms || [])

      // Whatever the whole subtree can see — for a Customer this is identical
      // to the query above (their subtree is just themselves); for a
      // Distributor/Sub-distributor/Global it's every descendant Customer's
      // rooms too, which is what the Cámaras screen needs to show them.
      const { data: subtreeRooms } = await supabase
        .from('cold_rooms')
        .select('*, organizations(name)')
      setAllRooms(subtreeRooms || [])

      await loadTreatments()
      await loadSeasonPlan(profileData.org_id, profileData.id)
      setLoading(false)
    })()
  }, [loadTreatments, loadSeasonPlan])

  const reloadSeasonPlanLines = async () => {
    if (!seasonPlan) return
    const { data: lines } = await supabase
      .from('season_plan_lines')
      .select('*')
      .eq('season_plan_id', seasonPlan.id)
      .order('planned_date', { ascending: true, nullsFirst: false })
    setSeasonPlanLines(lines || [])
  }

  const addSeasonPlanLine = async () => {
    const { error } = await supabase.from('season_plan_lines').insert({
      season_plan_id: seasonPlan.id,
      cold_room_id: coldRooms[0]?.id || null,
      planned_dose_ppb: 1000,
      product_preference: 'undecided',
    })
    if (error) { console.error(error); return }
    await reloadSeasonPlanLines()
  }

  const updateSeasonPlanLine = async (id, patch) => {
    const { error } = await supabase.from('season_plan_lines').update(patch).eq('id', id)
    if (error) { console.error(error); return }
    await reloadSeasonPlanLines()
  }

  const deleteSeasonPlanLine = async (id) => {
    const { error } = await supabase.from('season_plan_lines').delete().eq('id', id)
    if (error) { console.error(error); return }
    await reloadSeasonPlanLines()
  }

  // Selected Plan Lines get converted one at a time, in sequence, through the
  // existing Calculator — the customer reviews/adjusts each before sending it.
  const startConversion = (selectedLines) => {
    setConversionQueue(selectedLines.map(l => ({ ...l, origin: 'plan_line' })))
    setActivePanel('calculator')
  }

  // "Repetir" on an existing Treatment — same room/dose prefilled into the
  // Calculator, customer still has to review and confirm before it sends.
  // Reuses the same prefill queue as Season Plan conversion (Calculator only
  // needs cold_room_id/planned_dose_ppb), tagged so it doesn't get mistaken
  // for a Plan Line and doesn't set plan_line_id on the new Treatment.
  const repeatTreatment = (treatment) => {
    setConversionQueue([{
      origin: 'repeat',
      id: treatment.id,
      cold_room_id: treatment.cold_room_id,
      planned_dose_ppb: treatment.target_dose_ppb,
    }])
    setActivePanel('calculator')
  }

  // Excel import (Season Plan Phase 1.5) — one consolidated template
  // (Frigorífico/Cámara/Volumen/Dosis/Fecha). Invalid rows are reported, not
  // fatal to the whole file. Product is never set from the file — that's a
  // deliberate bulk action in the table after upload (see bulkSetProduct).
  const importPlanExcel = async (file) => {
    const { valid, errors } = await parsePlanFile(file)
    const rowErrors = [...errors]
    const duplicates = []
    if (valid.length === 0) return { imported: 0, errors: rowErrors, duplicates }

    // Read current rooms/lines fresh from the database rather than trusting
    // React state — if the caller just cleared planned lines (see
    // clearPlannedLines) moments earlier, stale in-memory state here would
    // make every re-uploaded row look like a duplicate of rows that no
    // longer exist, silently dropping the whole import.
    const [{ data: currentRooms }, { data: currentLines }] = await Promise.all([
      supabase.from('cold_rooms').select('*').eq('org_id', profile.org_id),
      supabase.from('season_plan_lines').select('cold_room_id, planned_date').eq('season_plan_id', seasonPlan.id),
    ])

    // Resolve/auto-create rooms by name (case-insensitive), de-duplicated
    // within this batch so the same new room isn't created twice.
    const roomsByName = new Map((currentRooms || []).map(r => [r.name.trim().toLowerCase(), r]))
    const linesToInsert = []

    // Same Cámara + same Fecha (including "no date") = likely the same file
    // re-uploaded — skip it. Same Cámara with a *different* Fecha is a real,
    // separate application (different batch of fruit), not a duplicate.
    const existingSignatures = new Set(
      (currentLines || []).map(l => `${l.cold_room_id}|${l.planned_date || ''}`)
    )

    for (const row of valid) {
      const key = row.roomName.toLowerCase()
      let room = roomsByName.get(key)
      if (!room) {
        if (!row.roomVolume) {
          rowErrors.push({ row: '-', reason: `Cámara nueva "${row.roomName}" sin volumen — no se pudo crear` })
          continue
        }
        const { data: created, error } = await supabase
          .from('cold_rooms')
          .insert({ org_id: profile.org_id, name: row.roomName, volume_m3: row.roomVolume, location: row.location, primary_crop: row.primaryCrop })
          .select()
          .single()
        if (error) { rowErrors.push({ row: '-', reason: error.message }); continue }
        room = created
        roomsByName.set(key, room)
      } else if (row.primaryCrop && row.primaryCrop !== room.primary_crop) {
        // Cultivo lives on the Cold Room, not the Plan Line — the sheet may
        // be correcting/filling it in for a room that already existed.
        const { error } = await supabase.from('cold_rooms').update({ primary_crop: row.primaryCrop }).eq('id', room.id)
        if (!error) { room.primary_crop = row.primaryCrop; roomsByName.set(key, room) }
      }

      const signature = `${room.id}|${row.planned_date || ''}`
      if (existingSignatures.has(signature)) {
        duplicates.push({ room: row.roomName, date: row.planned_date })
        continue
      }
      existingSignatures.add(signature) // also catches repeats within this same file

      linesToInsert.push({
        season_plan_id: seasonPlan.id,
        cold_room_id: room.id,
        planned_date: row.planned_date,
        planned_dose_ppb: row.planned_dose_ppb,
      })
    }

    if (linesToInsert.length > 0) {
      const { error } = await supabase.from('season_plan_lines').insert(linesToInsert)
      if (error) rowErrors.push({ row: '-', reason: error.message })
    }

    await reloadRooms()
    await reloadSeasonPlanLines()

    return { imported: linesToInsert.length, errors: rowErrors, duplicates }
  }

  // Bulk-edit several selected Plan Lines at once — only the fields the
  // customer actually filled in the toolbar get applied, so leaving one
  // blank doesn't wipe it out on every selected row. `primary_crop` isn't a
  // Plan Line field — it belongs to the Cold Room, so it updates every
  // distinct room referenced by the selected lines instead.
  const bulkApplyToLines = async (lineIds, { planned_date, planned_dose_ppb, product_preference, primary_crop }) => {
    const linePatch = {}
    if (planned_date !== undefined)      linePatch.planned_date = planned_date
    if (planned_dose_ppb !== undefined)  linePatch.planned_dose_ppb = planned_dose_ppb
    if (product_preference !== undefined) linePatch.product_preference = product_preference

    if (Object.keys(linePatch).length > 0) {
      const { error } = await supabase.from('season_plan_lines').update(linePatch).in('id', lineIds)
      if (error) { console.error(error); return }
    }

    if (primary_crop) {
      const roomIds = [...new Set(
        seasonPlanLines.filter(l => lineIds.includes(l.id)).map(l => l.cold_room_id)
      )]
      if (roomIds.length > 0) {
        const { error } = await supabase.from('cold_rooms').update({ primary_crop }).in('id', roomIds)
        if (error) { console.error(error); return }
        await reloadRooms()
      }
    }

    await reloadSeasonPlanLines()
  }

  // "Start fresh" option before an Excel import — only clears `planned`
  // lines. Never touches `converted` ones: those are the historical record
  // of what actually became a real Treatment (see DOMAIN_MODEL.md Rule 22).
  const clearPlannedLines = async () => {
    const { error } = await supabase
      .from('season_plan_lines')
      .delete()
      .eq('season_plan_id', seasonPlan.id)
      .eq('status', 'planned')
    if (error) { console.error(error); return }
    await reloadSeasonPlanLines()
  }

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
  const navigate     = (panel) => { setActivePanel(panel); resetSession(); setSidebarOpen(false) }

  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, '0')

  const reloadRooms = async () => {
    const { data: rooms } = await supabase.from('cold_rooms').select('*').eq('org_id', profile.org_id)
    setColdRooms(rooms || [])
    const { data: subtreeRooms } = await supabase.from('cold_rooms').select('*, organizations(name)')
    setAllRooms(subtreeRooms || [])
  }

  // ── Treatment actions — shared across Calculator, Treatments, Wassington ──
  // targetOrgId lets a Distributor/Sub-distributor add a room on behalf of
  // one of its Customers (Cámaras screen); defaults to the caller's own org.
  const addColdRoom = async (newRoom, targetOrgId) => {
    const { error } = await supabase
      .from('cold_rooms')
      .insert({ ...newRoom, org_id: targetOrgId || profile.org_id })
    if (error) { console.error(error); return { error: error.message } }
    await reloadRooms()
    return { error: null }
  }

  // Postgres blocks this with a foreign-key violation if the room still has
  // Treatments or Season Plan Lines referencing it — surfaced as an error,
  // not silently swallowed, same as every other mutation in this file.
  const deleteColdRoom = async (id) => {
    const { error } = await supabase.from('cold_rooms').delete().eq('id', id)
    if (error) {
      console.error('[deleteColdRoom]', error)
      const friendly = error.code === '23503'
        ? 'No se puede eliminar: esta cámara tiene Tratamientos o líneas de Plan de Temporada asociadas.'
        : error.message
      return { error: friendly }
    }
    await reloadRooms()
    return { error: null }
  }

  const addTreatment = async (newTreatment) => {
    // A Treatment belongs to whoever's Cold Room it's for — normally that's
    // the caller's own org, but a Distributor/Sub-distributor can create one
    // on behalf of a Customer (e.g. a phone order), picking that Customer's
    // room from the subtree-wide list. Resolve the real owner from the room
    // rather than assuming it's always the person creating it.
    const room = allRooms.find(r => r.id === newTreatment.cold_room_id)
    const ownerOrgId = room?.org_id || profile.org_id
    const { data, error } = await supabase
      .from('treatments')
      .insert({ ...newTreatment, org_id: ownerOrgId, status: 'submitted', created_by: profile.id })
      .select()
      .single()
    if (error) { console.error(error); return null }
    await loadTreatments()

    // If this came from converting a Season Plan Line, mark it converted.
    if (newTreatment.plan_line_id) {
      await supabase.from('season_plan_lines').update({ status: 'converted' }).eq('id', newTreatment.plan_line_id)
      await reloadSeasonPlanLines()
    }

    // Advance whatever prefill queue triggered this Treatment (Season Plan
    // conversion, or a single "Repetir" item) so the next one shows up, or
    // we return to the screen that started it once the queue is empty.
    if (conversionQueue.length > 0) {
      const wasRepeat = conversionQueue[0]?.origin === 'repeat'
      setConversionQueue(prev => {
        const rest = prev.slice(1)
        if (rest.length === 0) setActivePanel(wasRepeat ? 'treatments' : 'seasonplan')
        return rest
      })
    }
    return data.id
  }

  // Freezes the sachet breakdown the same way price gets frozen (Rule 37) —
  // computed once, here, from whatever the catalog looks like right now;
  // never recomputed again even if the catalog changes later. Only
  // meaningful for MatriPowder — MatriTablets dosing doesn't depend on the
  // editable catalog at all.
  const approveTreatment = async (id, finalPrice) => {
    const t = treatments.find(tr => tr.id === id)
    let pouchBreakdown = null
    if (t?.product === 'powder' && t.cold_rooms?.volume_m3) {
      const pouchSizes = await fetchPouchCatalog()
      const grams = t.cold_rooms.volume_m3 * DOSE_BASE * (t.target_dose_ppb / 1000)
      pouchBreakdown = greedyCeiling(grams, pouchSizes.length > 0 ? pouchSizes : undefined)
    }
    const { error } = await supabase
      .from('treatments')
      .update({ status: 'approved', price_local: finalPrice, pouch_breakdown: pouchBreakdown, approved_by: profile.id, approved_at: new Date().toISOString() })
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
  // Best-effort — mirrors the same pouch/tablet breakdown already computed
  // for display (dosing.js) to decrement the owning Distributor's stock.
  // Never blocks the Apply action: inventory is an internal tracking aid,
  // not a gate on recording that a treatment was physically applied.
  const decrementInventoryForTreatment = async (treatmentId) => {
    const t = treatments.find(tr => tr.id === treatmentId)
    if (!t?.cold_rooms?.volume_m3) return
    try {
      if (t.product === 'powder') {
        const grams = t.cold_rooms.volume_m3 * DOSE_BASE * (t.target_dose_ppb / 1000)
        const pouchSizes = await fetchPouchCatalog()
        for (const { size, qty } of greedyCeiling(grams, pouchSizes.length > 0 ? pouchSizes : undefined)) {
          if (qty > 0) await supabase.rpc('decrement_inventory', { p_sku: 'MatriPowder', p_variant: `${size}g`, p_qty: qty })
        }
      } else if (t.product === 'tablets') {
        // Consumes from the loose-tablet pools (opened envelopes), not the
        // unopened envelope counts — opening a sobre is a separate, manual
        // Inventory action (see Inventory.jsx). Grande and chica are
        // tracked as two independent pools.
        const { large, small } = tabletCombo(t.target_dose_ppb, t.cold_rooms.volume_m3)
        if (large > 0) await supabase.rpc('decrement_inventory', { p_sku: 'MatriTablets', p_variant: 'suelta_grande', p_qty: large })
        if (small > 0) await supabase.rpc('decrement_inventory', { p_sku: 'MatriTablets', p_variant: 'suelta_chica', p_qty: small })
      }
    } catch (err) {
      console.error('[decrementInventoryForTreatment]', err)
    }
  }

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
    await decrementInventoryForTreatment(id)
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

  // Distributor/Global resolving a Customer's "not sure, please help" MatriSure
  // request — the Customer already uploaded the photo; this just settles the
  // result and completes the Treatment (Rule 32).
  const resolveMatriSureReview = async (treatmentId, result) => {
    const { error: reviewError } = await supabase
      .from('matrisure_verifications')
      .update({ result, reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
      .eq('treatment_id', treatmentId)
    if (reviewError) { console.error('[resolveMatriSureReview]', reviewError); return { error: reviewError.message } }

    const { error: statusError } = await supabase.from('treatments').update({ status: 'completed' }).eq('id', treatmentId)
    if (statusError) { console.error('[resolveMatriSureReview]', statusError); return { error: statusError.message } }

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

  if (notAssigned) {
    return (
      <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f5ee', padding:'20px'}}>
        <div style={{background:'#fff', borderRadius:'14px', padding:'32px', maxWidth:'420px', textAlign:'center', boxShadow:'0 4px 16px rgba(0,0,0,.08)'}}>
          <div style={{fontSize:'32px', marginBottom:'12px'}}>⏳</div>
          <div style={{fontSize:'17px', fontWeight:800, color:'#0b4358', marginBottom:'10px'}}>Tu cuenta todavía no está asignada</div>
          <div style={{fontSize:'13px', color:'#6b7280', lineHeight:1.6, marginBottom:'20px'}}>
            Tu login se creó correctamente, pero todavía nadie te asignó a una organización. Pedile a quien administre tu cuenta (por ejemplo, el dueño de la cuenta de tu distribuidor) que te agregue desde "Usuarios" en el portal.
          </div>
          <button className="btn-secondary" onClick={onSignOut}>Cerrar sesión</button>
        </div>
      </div>
    )
  }

  const currentUser = { name: profile?.organizations?.name || '', orgId: profile?.org_id }
  // "Panel Wassington" is a Distributor/Global admin view — Customers never see it,
  // regardless of which Business Roles they hold within their own Organization
  // (a demo Customer profile may hold Owner+Approver for convenience, but that
  // approver role only means anything for descendants, and Customers have none).
  const canSeeWassingtonPanel = profile?.organizations?.org_type !== 'customer'
  // Only Customers physically hold Cold Rooms and apply Treatments — a
  // Distributor/Sub-distributor/Global login should review MatriSure results
  // (see "wassington" panel), not record the application itself.
  const canApplyTreatments = profile?.organizations?.org_type === 'customer'

  const panels = {
    dashboard:  <Dashboard  onNavigate={navigate} treatments={treatments} />,
    rooms:      <Rooms coldRooms={allRooms} treatments={treatments} onAddRoom={addColdRoom} onDeleteRoom={deleteColdRoom} profile={profile} />,
    treatments: <Treatments onNavigate={navigate} treatments={treatments} onGetPhotoUrl={getMatriSurePhotoUrl} onRepeat={repeatTreatment} />,
    calculator: <Calculator onTreatmentConfirmed={addTreatment} onNavigate={navigate} coldRooms={canSeeWassingtonPanel ? allRooms : coldRooms} orgId={profile?.org_id}
                  prefill={conversionQueue[0] || null} queueLength={conversionQueue.length} />,
    seasonplan: canSeeWassingtonPanel
                  ? <SeasonPlanRollup />
                  : <SeasonPlan plan={seasonPlan} lines={seasonPlanLines} coldRooms={coldRooms} orgId={profile?.org_id}
                      onAddLine={addSeasonPlanLine} onUpdateLine={updateSeasonPlanLine}
                      onDeleteLine={deleteSeasonPlanLine} onConvert={startConversion}
                      onImportPlan={importPlanExcel} onBulkApply={bulkApplyToLines}
                      onClearPlannedLines={clearPlannedLines} onNavigate={navigate} />,
    generators: <Generators orgId={profile?.org_id} seasonPlanLines={seasonPlanLines} coldRooms={coldRooms} profile={profile} />,
    documents:  <Documents />,
    applog:     <AppLog treatments={treatments} operatorName={profile?.full_name} onApply={applyTreatment} onSubmitMatriSure={submitMatriSure} />,
    wassington: <Wassington treatments={treatments} onApprove={approveTreatment} onReject={rejectTreatment} onGetPhotoUrl={getMatriSurePhotoUrl} onResolveMatriSure={resolveMatriSureReview} profile={profile} />,
    users:      <Users profile={profile} />,
    profile:    <Profile />,
  }

  return (
    <div style={{display:'flex', minHeight:'100vh', background:'#f5f5ee'}}>
      <Sidebar
        activePanel={activePanel}
        onNavigate={navigate}
        onSignOut={onSignOut}
        orgName={currentUser.name}
        canSeeWassingtonPanel={canSeeWassingtonPanel}
        canApplyTreatments={canApplyTreatments}
        mobileOpen={sidebarOpen}
      />
      {sidebarOpen && (
        <div className="sidebar-backdrop open" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="main-content" style={{marginLeft:'230px', flex:1, display:'flex', flexDirection:'column', minHeight:'100vh'}}>
        <div style={{
          background:'white', borderBottom:'0.5px solid #ddddd5',
          padding:'12px 28px', display:'flex', alignItems:'center',
          justifyContent:'space-between', position:'sticky', top:0, zIndex:40,
          boxShadow:'0 1px 3px rgba(0,0,0,.06)', gap:'12px'
        }}>
          <div style={{display:'flex', alignItems:'center', gap:'12px', minWidth:0}}>
            <button
              className="sidebar-hamburger"
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="Abrir menú"
              style={{background:'none', border:'none', fontSize:'22px', color:'#0b4358', cursor:'pointer', flexShrink:0}}
            >☰</button>
            <h1 style={{fontSize:'17px', fontWeight:700, color:'#0b4358', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
              {activePanel === 'wassington' ? `Panel ${currentUser.name}` : PANEL_TITLES[activePanel]}
            </h1>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:'14px', flexShrink:0}}>
            <div className="header-season-badge" style={{
              background:'#f0f7e0', color:'#3b6d11',
              fontSize:'11px', fontWeight:700, padding:'4px 12px',
              borderRadius:'100px', letterSpacing:'.04em'
            }}>Temporada 2026</div>
            <div className="header-season-badge" style={{
              fontSize:'11px', color:'#6b6b6b',
              alignItems:'center', gap:'5px'
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
          {activePanel === 'wassington' && !canSeeWassingtonPanel
            ? <Dashboard onNavigate={navigate} treatments={treatments} />
            : activePanel === 'applog' && !canApplyTreatments
            ? <Dashboard onNavigate={navigate} treatments={treatments} />
            : panels[activePanel]}
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
