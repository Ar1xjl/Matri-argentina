import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import { POUCHES, DOSE_BASE, greedyCeiling, greedyFloor, comboGrams, actualPpb, tabletCombo } from '../../lib/dosing'
import { fetchOrgPricing, fetchCustomerOverride, fetchPouchCatalog, resolveProductPrice, resolveServiceFee } from '../../lib/orgPricing'
import { formatUSD as fmtUSD, formatNumber as fmtNum } from '../../lib/formatters'
import { CROP_OPTIONS } from '../../lib/crops'

// ── Styles ────────────────────────────────────────────────────────────────
const card    = {background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'24px', marginBottom:'16px'}
const lbl     = {display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}
const inp     = {width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8', fontFamily:'inherit'}
const calcBtn = {background:'#e8736a', color:'#fff', border:'none', borderRadius:'10px', padding:'13px 20px', fontSize:'15px', fontWeight:700, cursor:'pointer', width:'100%', marginTop:'8px', fontFamily:'inherit'}
const pouchRow = {display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', background:'#f5f5ee', borderRadius:'8px', marginBottom:'6px'}
const statBox  = {background:'#f5f5ee', borderRadius:'8px', padding:'8px 6px', textAlign:'center'}
const statLbl  = {fontSize:'9px', color:'#888', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:'3px'}
const statVal  = {fontSize:'15px', fontWeight:700, color:'#0b4358'}

export default function Calculator({ onTreatmentConfirmed, onNavigate, coldRooms = [], orgId = null, prefill = null, queueLength = 0, profile = null, onAddRoom = null }) {
  const { t } = useTranslation()
  const [pricing,    setPricing]    = useState({ brackets: [], product: [], serviceFee: [] })
  const [override,   setOverride]   = useState(null)
  const [pouchSizes, setPouchSizes] = useState(POUCHES) // real catalog replaces this fallback once loaded
  const [roomIdx,    setRoomIdx]    = useState(0)
  const [roomName,   setRoomName]   = useState('')
  const [ppb,        setPpb]        = useState('1000')
  const [doseSource, setDoseSource] = useState('manual') // 'manual' | 'doseright'
  const [results,    setResults]    = useState(null)   // { exact, adjusted, tablets }
  const [selected,   setSelected]   = useState(null)   // 'exact' | 'adjusted' | 'tablets'
  const [serviceModel, setServiceModel] = useState('self') // 'service' | 'self'
  const [treatmentSent, setTreatmentSent] = useState(false)

  // Fase L-1 (2026-08-11): a Distributor/Sub-distributor/Global sees every
  // Customer's rooms in `coldRooms` at once — Juan's real complaint was that
  // a flat list becomes unusable once there are many Customers with many
  // rooms each. Pick the Customer first, then the room dropdown narrows to
  // just theirs (or lets them add a new one inline, without a detour to the
  // Cámaras screen). A Customer's own view is untouched — one org, no filter
  // needed, same flat dropdown as always.
  const isDistributorView = profile?.organizations?.org_type !== 'customer'
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerOrgs, setCustomerOrgs] = useState([])
  const [showNewRoomForm, setShowNewRoomForm] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomVolume, setNewRoomVolume] = useState('')
  const [newRoomCrop, setNewRoomCrop] = useState('Manzana')
  const [newRoomError, setNewRoomError] = useState('')
  const [newRoomSaving, setNewRoomSaving] = useState(false)
  const [pendingSelectRoomId, setPendingSelectRoomId] = useState(null)

  useEffect(() => {
    if (!isDistributorView) return
    supabase.from('organizations').select('*').eq('org_type', 'customer').then(({ data }) => setCustomerOrgs(data || []))
  }, [isDistributorView])

  // Pricing applies to whoever actually owns the selected Cold Room — that's
  // usually the caller's own org, but when a Distributor/Sub-distributor is
  // creating a Treatment on behalf of a Customer (subtree-wide room list),
  // it's that Customer instead. fetchOrgPricing resolves the nearest ancestor
  // that has its own price list configured (Fase H, 2026-07-16 — fixes a real
  // ambiguity when both a Distributor and a Sub-distributor have one).
  const pricingOrgId = coldRooms[roomIdx]?.org_id || orgId
  useEffect(() => {
    fetchOrgPricing(pricingOrgId).then(setPricing)
  }, [pricingOrgId])

  // This Distributor's own editable pouch-size catalog (Fase E, 2026-07-12).
  useEffect(() => {
    fetchPouchCatalog().then(sizes => { if (sizes.length > 0) setPouchSizes(sizes) })
  }, [])

  // A negotiated price for this Customer, if one was set by their Distributor
  // (DOMAIN_MODEL.md Rule 36) — resolveProductPrice/resolveServiceFee below
  // fall back to standard list pricing automatically when this is null.
  useEffect(() => {
    if (!pricingOrgId) return
    fetchCustomerOverride(pricingOrgId).then(setOverride)
  }, [pricingOrgId])

  // Coming from Season Plan conversion — pre-fill room/dose, let the customer
  // review and adjust before actually sending, same as any other Treatment.
  // Adjusted during render (React's documented pattern for "sync state to a
  // changed prop") rather than in an effect, to avoid a cascade of separate
  // re-renders from several setState calls firing one after another.
  const [appliedPrefillId, setAppliedPrefillId] = useState(null)
  if (prefill && prefill.id !== appliedPrefillId && coldRooms.length > 0) {
    setAppliedPrefillId(prefill.id)
    const idx = coldRooms.findIndex(r => r.id === prefill.cold_room_id)
    if (idx >= 0) {
      setRoomIdx(idx)
      if (isDistributorView) setSelectedCustomerId(coldRooms[idx].org_id) // keep the Cliente selector in sync with the incoming room
    }
    if (prefill.planned_dose_ppb) setPpb(String(prefill.planned_dose_ppb))
    setDoseSource('manual')
    setResults(null)
    setSelected(null)
    setTreatmentSent(false)
  }

  // Default the Cliente selector to whichever Customer owns the currently
  // selected room, the first time there's enough data to know — same
  // adjust-during-render pattern as the prefill sync above.
  if (isDistributorView && !selectedCustomerId && coldRooms[roomIdx]?.org_id) {
    setSelectedCustomerId(coldRooms[roomIdx].org_id)
  }

  // Once a newly-added room shows up in the reloaded coldRooms prop, select
  // it automatically instead of leaving the customer to hunt for it again —
  // same adjust-during-render pattern (avoids react-hooks/set-state-in-effect).
  if (pendingSelectRoomId) {
    const idx = coldRooms.findIndex(r => r.id === pendingSelectRoomId)
    if (idx >= 0) {
      setRoomIdx(idx)
      setPendingSelectRoomId(null)
      setResults(null)
    }
  }

  // Listen for dose coming back from DoseRight module
  useEffect(() => {
    const handler = (e) => {
      if (e.data && e.data.type === 'MATRI_DOSE') {
        setPpb(String(e.data.ppb))
        setDoseSource('doseright')
        setResults(null)
        setSelected(null)
        setTreatmentSent(false)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  if (coldRooms.length === 0 && !isDistributorView) {
    return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>{t('calculator.loadingRooms')}</div>
  }

  // Fase L-1: narrowed to the selected Customer's own rooms for a Distributor/
  // Sub-distributor/Global view; identical to `coldRooms` for a Customer.
  const customerRooms = isDistributorView ? coldRooms.filter(r => r.org_id === selectedCustomerId) : coldRooms
  const currentRoom = coldRooms[roomIdx]
  const hasValidRoom = !!currentRoom
  const vol    = currentRoom?.volume_m3
  const ppbVal = parseFloat(ppb) || 1000

  const selectCustomer = (customerId) => {
    setSelectedCustomerId(customerId)
    const firstRoom = coldRooms.find(r => r.org_id === customerId)
    setRoomIdx(firstRoom ? coldRooms.indexOf(firstRoom) : -1)
    setResults(null); setSelected(null); setTreatmentSent(false)
  }

  const selectRoomById = (roomId) => {
    setRoomIdx(coldRooms.findIndex(r => r.id === roomId))
    setResults(null); setSelected(null); setTreatmentSent(false)
  }

  const openNewRoomForm = () => {
    setNewRoomName(''); setNewRoomVolume(''); setNewRoomCrop('Manzana'); setNewRoomError('')
    setShowNewRoomForm(true)
  }

  const saveNewRoom = async () => {
    setNewRoomError('')
    if (!newRoomName.trim()) { setNewRoomError(t('calculator.roomData.newRoomNameRequired')); return }
    if (!newRoomVolume || Number(newRoomVolume) <= 0) { setNewRoomError(t('calculator.roomData.newRoomVolumeRequired')); return }
    setNewRoomSaving(true)
    const res = await onAddRoom?.({ name: newRoomName.trim(), volume_m3: Number(newRoomVolume), primary_crop: newRoomCrop }, selectedCustomerId)
    setNewRoomSaving(false)
    if (res?.error) { setNewRoomError(res.error); return }
    setShowNewRoomForm(false)
    if (res?.data?.id) setPendingSelectRoomId(res.data.id)
  }

  const calculate = () => {
    const grams = vol * DOSE_BASE * (ppbVal / 1000)

    // Powder exact
    const exactC  = greedyCeiling(grams, pouchSizes)
    const exactG  = comboGrams(exactC)
    const exactPpb = actualPpb(exactG, vol)
    const powderPrice = resolveProductPrice(pricing, 'MatriPowder', vol, override)
    const exactCost = vol * powderPrice * (exactPpb / 1000)

    // Powder adjusted (floor)
    const adjC   = greedyFloor(grams, pouchSizes)
    const adjG   = comboGrams(adjC)
    const adjPpb = adjG > 0 ? actualPpb(adjG, vol) : 0
    const adjCost = vol * powderPrice * (adjPpb / 1000)

    // Service fee
    const serviceFee = resolveServiceFee(pricing, vol, override)

    // Tablets — count scales with target dose, same as powder grams
    const tabCombo  = tabletCombo(ppbVal, vol)
    const tabPrice  = resolveProductPrice(pricing, 'MatriTablets', vol, override)
    const tabCost   = vol * tabPrice * (tabCombo.ppb / 1000)

    setResults({
      exact:    { combo:exactC, grams:exactG, ppb:exactPpb, productCost:exactCost, serviceFee },
      adjusted: { combo:adjC,  grams:adjG,  ppb:adjPpb,  productCost:adjCost,  serviceFee, skip: adjG === exactG || adjG === 0 },
      tablets:  { ...tabCombo, productCost:tabCost },
      powderPrice, tabPrice, serviceFee,
    })
    setSelected(null)
    setTreatmentSent(false)
  }

  const sendTreatment = async () => {
    if (!selected || !results) return
    const r = selected === 'tablets' ? results.tablets : results[selected]
    const product = selected === 'tablets' ? 'tablets' : 'powder'
    const cost = selected === 'tablets'
      ? r.productCost
      : r.productCost + (serviceModel === 'service' ? r.serviceFee : 0)
    const targetDosePpb = results[selected].ppb

    setTreatmentSent(true)
    if (onTreatmentConfirmed) {
      await onTreatmentConfirmed({
        cold_room_id: coldRooms[roomIdx].id,
        product,
        target_dose_ppb: targetDosePpb,
        dose_source: doseSource,
        price_local: Number(cost.toFixed(2)),
        price_currency: 'USD', // simplification: single-currency demo data (see SYSTEM_ARCHITECTURE.md)
        service_fee_local: selected !== 'tablets' && serviceModel === 'service' ? r.serviceFee : null,
        plan_line_id: prefill?.origin === 'plan_line' ? prefill.id : null,
      })
    }
  }

  // ── Option card component ─────────────────────────────────────────────
  const OptionCard = ({ id, title, badge, children, cost, ppbVal: optPpb, productLabel, serviceFee }) => {
    const isSelected = selected === id
    return (
      <div
        onClick={() => { setSelected(id); setServiceModel('self'); setTreatmentSent(false) }}
        style={{
          borderRadius:'12px', border: isSelected ? '2px solid #0b4358' : '1.5px solid #ddddd5',
          padding:'18px', cursor:'pointer', background: isSelected ? '#f0f7ff' : '#fff',
          transition:'border-color .15s, background .15s', flex:1, minWidth:'200px'
        }}
      >
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px'}}>
          <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358'}}>{title}</div>
          {badge && <span style={{background:badge.bg, color:badge.color, fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'100px'}}>{badge.label}</span>}
        </div>
        {children}
        {cost !== undefined && (
          <div style={{borderTop:'0.5px solid #e0e0d8', marginTop:'12px', paddingTop:'12px'}}>
            {/* Itemized breakdown */}
            <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#555', marginBottom:'4px'}}>
              <span>{t('calculator.option.productCost', { product: productLabel })}</span>
              <span>{fmtUSD(cost)}</span>
            </div>
            {serviceFee !== undefined && (
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#888', marginBottom:'4px'}}>
                <span>{t('calculator.option.serviceFee')}</span>
                <span>{fmtUSD(serviceFee)}</span>
              </div>
            )}

            {/* Dosis / $ per m³ / Total — only Total in bold */}
            <div style={{display:'grid', gridTemplateColumns: optPpb !== undefined ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap:'8px', marginTop:'10px'}}>
              {optPpb !== undefined && (
                <div style={statBox}>
                  <div style={statLbl}>{t('calculator.option.dose')}</div>
                  <div style={{...statVal, fontWeight:400}}>{fmtNum(optPpb, 0)} ppb</div>
                </div>
              )}
              <div style={statBox}>
                <div style={statLbl}>{t('calculator.option.perM3')}</div>
                <div style={{...statVal, fontWeight:400}}>{fmtUSD(cost/vol)}</div>
              </div>
              <div style={statBox}>
                <div style={statLbl}>{t('calculator.option.total')}</div>
                <div style={statVal}>{fmtUSD(cost)}</div>
              </div>
            </div>

            {serviceFee !== undefined && (
              <div style={{fontSize:'10px', color:'#aaa', marginTop:'8px', textAlign:'center'}}>
                {t('calculator.option.totalWithService', { amount: fmtUSD(cost + serviceFee) })}
              </div>
            )}
          </div>
        )}
        {isSelected && (
          <div style={{marginTop:'10px', background:'#e8f4fc', borderRadius:'8px', padding:'8px 10px', fontSize:'11px', color:'#0c447c', fontWeight:600}}>
            {t('calculator.option.selected')}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{maxWidth:'800px', margin:'0 auto'}}>

      {prefill && (
        <div className="alert info" style={{marginBottom:'14px'}}>
          {prefill.origin === 'repeat'
            ? t('calculator.prefill.repeat')
            : `${t('calculator.prefill.seasonPlanPrefix')}${queueLength > 1 ? t('calculator.prefill.queueRemaining', { count: queueLength }) : ''}${t('calculator.prefill.seasonPlanSuffix')}`}
        </div>
      )}

      {/* Admin bar */}
      <div style={{background:'#0b4358', color:'#fff', padding:'8px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:'12px', borderRadius:'8px 8px 0 0'}}>
        <span>{override ? t('calculator.pricingBar.override') : t('calculator.pricingBar.standard')}</span>
      </div>

      {/* Inputs */}
      <div style={card}>
        <div style={{fontSize:'15px', fontWeight:700, color:'#0b4358', marginBottom:'16px'}}>{t('calculator.roomData.title')}</div>

        {isDistributorView ? (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px'}}>
            <div>
              <label style={lbl}>{t('calculator.roomData.customerLabel')}</label>
              <select style={inp} value={selectedCustomerId} onChange={e => selectCustomer(e.target.value)}>
                <option value="" disabled>{t('calculator.roomData.customerPlaceholder')}</option>
                {customerOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>{t('calculator.roomData.roomLabel')}</label>
              {customerRooms.length > 0 ? (
                <select style={inp} value={currentRoom?.id || ''} onChange={e => selectRoomById(e.target.value)}>
                  {customerRooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.volume_m3} m³)</option>)}
                </select>
              ) : (
                <div style={{...inp, display:'flex', alignItems:'center', color:'#888', fontSize:'12px'}}>
                  {selectedCustomerId ? t('calculator.roomData.noRoomsForCustomer') : t('calculator.roomData.customerPlaceholder')}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px'}}>
            <div>
              <label style={lbl}>{t('calculator.roomData.roomLabel')}</label>
              <select style={inp} value={roomIdx} onChange={e => { setRoomIdx(Number(e.target.value)); setResults(null) }}>
                {coldRooms.map((r,i) => <option key={r.id} value={i}>{r.name} ({r.volume_m3} m³)</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>{t('calculator.roomData.customNameLabel')}</label>
              <input style={inp} type="text" value={roomName} onChange={e => setRoomName(e.target.value)} placeholder={t('calculator.roomData.customNamePlaceholder')}/>
            </div>
          </div>
        )}

        {isDistributorView && selectedCustomerId && (
          <div style={{marginBottom:'14px'}}>
            {!showNewRoomForm ? (
              <button onClick={openNewRoomForm} style={{background:'none', border:'0.5px solid #b5cc2e', color:'#3b6d11', borderRadius:'8px', padding:'8px 12px', fontSize:'12px', cursor:'pointer'}}>
                {t('calculator.roomData.addNewRoom')}
              </button>
            ) : (
              <div style={{background:'#f5f5ee', borderRadius:'8px', padding:'14px'}}>
                {newRoomError && <div style={{color:'#8b2020', fontSize:'12px', marginBottom:'10px'}}>{newRoomError}</div>}
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'10px'}}>
                  <div>
                    <label style={lbl}>{t('calculator.roomData.newRoomName')}</label>
                    <input style={inp} value={newRoomName} onChange={e => setNewRoomName(e.target.value)}/>
                  </div>
                  <div>
                    <label style={lbl}>{t('calculator.roomData.newRoomVolume')}</label>
                    <input style={inp} type="number" value={newRoomVolume} onChange={e => setNewRoomVolume(e.target.value)}/>
                  </div>
                  <div>
                    <label style={lbl}>{t('calculator.roomData.newRoomCrop')}</label>
                    <input list="calculator-crop-options" style={inp} value={newRoomCrop} onChange={e => setNewRoomCrop(e.target.value)}/>
                    <datalist id="calculator-crop-options">
                      {CROP_OPTIONS.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                </div>
                <div style={{display:'flex', gap:'8px'}}>
                  <button className="btn-primary btn-sm" disabled={newRoomSaving} onClick={saveNewRoom}>
                    {newRoomSaving ? t('common.saving') : t('calculator.roomData.saveRoom')}
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => setShowNewRoomForm(false)}>{t('common.cancel')}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {hasValidRoom && (
          <>
            <div style={{marginBottom:'14px'}}>
              <label style={lbl}>{t('calculator.roomData.targetDoseLabel')}</label>
              <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                <input style={{...inp, flex:1}} type="number" value={ppb} onChange={e => { setPpb(e.target.value); setDoseSource('manual'); setResults(null) }} min="100" max="5000" step="50"/>
                <button onClick={() => { setPpb('1000'); setDoseSource('manual') }} style={{background:'none', border:'0.5px solid #b5cc2e', color:'#3b6d11', borderRadius:'8px', padding:'10px 12px', fontSize:'12px', cursor:'pointer', whiteSpace:'nowrap'}}>
                  {t('calculator.roomData.standardDose')}
                </button>
              </div>
              <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>
                {t('calculator.roomData.standardDoseHint')}
              </div>
            </div>

            <div style={{background:'#f0f7e0', border:'1px solid #b5cc2e', borderRadius:'8px', padding:'12px 14px', marginBottom:'14px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div style={{fontSize:'12px', fontWeight:700, color:'#3b6d11', marginBottom:'2px'}}>{t('calculator.roomData.doseRightPrompt')}</div>
                <div style={{fontSize:'11px', color:'#555'}}>{t('calculator.roomData.doseRightDesc')}</div>
              </div>
              <button
                onClick={() => window.open('https://ar1xjl.github.io/Matri-argentina/1mcp-dose-calculator.html', 'doseright', 'width=900,height=700,scrollbars=yes')}
                style={{background:'#0b4358', color:'#fff', border:'none', borderRadius:'8px', padding:'9px 14px', fontSize:'12px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', marginLeft:'12px', fontFamily:'inherit'}}
              >
                {t('calculator.roomData.openDoseRight')}
              </button>
            </div>

            <button style={calcBtn} onClick={calculate}>
              {t('calculator.roomData.calculate')}
            </button>
          </>
        )}
      </div>

      {/* Results — 3 alternatives */}
      {results && hasValidRoom && (
        <div>
          <div style={{fontSize:'15px', fontWeight:700, color:'#0b4358', marginBottom:'4px'}}>
            {t('calculator.results.compareTitle', { roomName: roomName || coldRooms[roomIdx].name, vol })}
          </div>
          <div style={{fontSize:'12px', color:'#888', marginBottom:'16px'}}>
            {t('calculator.results.targetDose', { ppb: fmtNum(ppbVal, 0) })}
          </div>

          <div style={{display:'flex', gap:'14px', flexWrap:'wrap', marginBottom:'20px'}}>

            {/* Option 1 — Powder exact */}
            <OptionCard
              id="exact"
              title={t('calculator.options.exact.title')}
              cost={results.exact.productCost}
              ppbVal={results.exact.ppb}
              productLabel="MatriPowder"
              serviceFee={results.exact.serviceFee}
            >
              <div style={{marginBottom:'8px'}}>
                {results.exact.combo.filter(p=>p.qty>0).map(p => (
                  <div key={p.size} style={pouchRow}>
                    <div style={{background:'#0b4358', color:'#fff', borderRadius:'6px', padding:'2px 8px', fontSize:'11px', fontWeight:700}}>{p.size}g</div>
                    <div style={{fontSize:'12px', color:'#333', flex:1}}>{t('calculator.option.sachet', { size: p.size })}</div>
                    <div style={{fontSize:'13px', fontWeight:700, color:'#e8736a'}}>×{p.qty}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:'11px', color:'#888'}}>{t('calculator.option.totalGrams', { grams: fmtNum(results.exact.grams, 1) })}</div>
            </OptionCard>

            {/* Option 2 — Powder adjusted */}
            {!results.adjusted.skip && (
              <OptionCard
                id="adjusted"
                title={t('calculator.options.adjusted.title')}
                cost={results.adjusted.productCost}
                ppbVal={results.adjusted.ppb}
                productLabel="MatriPowder"
                serviceFee={results.adjusted.serviceFee}
              >
                <div style={{marginBottom:'8px'}}>
                  {results.adjusted.combo.filter(p=>p.qty>0).map(p => (
                    <div key={p.size} style={pouchRow}>
                      <div style={{background:'#0b4358', color:'#fff', borderRadius:'6px', padding:'2px 8px', fontSize:'11px', fontWeight:700}}>{p.size}g</div>
                      <div style={{fontSize:'12px', color:'#333', flex:1}}>{t('calculator.option.sachet', { size: p.size })}</div>
                      <div style={{fontSize:'13px', fontWeight:700, color:'#e8736a'}}>×{p.qty}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:'11px', color:'#888'}}>{t('calculator.option.totalGrams', { grams: fmtNum(results.adjusted.grams, 1) })}</div>
              </OptionCard>
            )}

            {/* Option 3 — Tablets */}
            <OptionCard
              id="tablets"
              title="MatriTablets"
              badge={{label:t('calculator.options.tablets.badge'), bg:'#fff3cd', color:'#b06a00'}}
              cost={results.tablets.productCost}
              ppbVal={results.tablets.ppb}
              productLabel="MatriTablets"
            >
              <div style={{display:'flex', gap:'10px', marginBottom:'8px'}}>
                <div style={{flex:1, background:'#f5f5ee', borderRadius:'8px', padding:'10px', textAlign:'center'}}>
                  <div style={{fontSize:'11px', color:'#888', marginBottom:'2px'}}>{t('calculator.options.tablets.large')}</div>
                  <div style={{fontSize:'20px', fontWeight:700, color:'#0b4358'}}>{results.tablets.large}</div>
                </div>
                <div style={{flex:1, background:'#f5f5ee', borderRadius:'8px', padding:'10px', textAlign:'center'}}>
                  <div style={{fontSize:'11px', color:'#888', marginBottom:'2px'}}>{t('calculator.options.tablets.small')}</div>
                  <div style={{fontSize:'20px', fontWeight:700, color:'#0b4358'}}>{results.tablets.small}</div>
                </div>
              </div>
              <div style={{fontSize:'11px', color:'#888'}}>{t('calculator.options.tablets.coverage', { vol: fmtNum(vol, 1) })}</div>
            </OptionCard>
          </div>

          {/* Service model selector — only for Powder options */}
          {selected && selected !== 'tablets' && (
            <div style={card}>
              <div style={{fontSize:'14px', fontWeight:700, color:'#0b4358', marginBottom:'12px'}}>
                {t('calculator.serviceModel.title')}
              </div>
              <div style={{display:'flex', gap:'12px'}}>
                <div
                  onClick={() => setServiceModel('service')}
                  style={{flex:1, borderRadius:'10px', border: serviceModel==='service' ? '2px solid #0b4358' : '1.5px solid #ddddd5', padding:'14px', cursor:'pointer', background: serviceModel==='service' ? '#f0f7ff' : '#fff'}}
                >
                  <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358', marginBottom:'4px'}}>{t('calculator.serviceModel.service.title')}</div>
                  <div style={{fontSize:'12px', color:'#888', marginBottom:'8px'}}>{t('calculator.serviceModel.service.desc')}</div>
                  <div style={{fontSize:'16px', fontWeight:700, color:'#e8736a'}}>+{fmtUSD(results[selected].serviceFee)}</div>
                  <div style={{fontSize:'11px', color:'#888'}}>{t('calculator.serviceModel.service.perRoom')}</div>
                </div>
                <div
                  onClick={() => setServiceModel('self')}
                  style={{flex:1, borderRadius:'10px', border: serviceModel==='self' ? '2px solid #0b4358' : '1.5px solid #ddddd5', padding:'14px', cursor:'pointer', background: serviceModel==='self' ? '#f0f7ff' : '#fff'}}
                >
                  <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358', marginBottom:'4px'}}>{t('calculator.serviceModel.self.title')}</div>
                  <div style={{fontSize:'12px', color:'#888', marginBottom:'8px'}}>{t('calculator.serviceModel.self.desc')}</div>
                  <div style={{fontSize:'16px', fontWeight:700, color:'#1a6b30'}}>{t('calculator.serviceModel.self.noCharge')}</div>
                  <div style={{fontSize:'11px', color:'#888'}}>{t('calculator.serviceModel.self.needsGenerator')}</div>
                </div>
              </div>
            </div>
          )}

          {/* Cost summary */}
          {selected && (
            <div style={{background:'#0b4358', borderRadius:'12px', padding:'20px 24px', marginBottom:'16px'}}>
              <div style={{fontSize:'12px', fontWeight:700, color:'#b5cc2e', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'14px'}}>
                {t('calculator.summary.title')}
              </div>
              <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'14px'}}>
                {[
                  [t('calculator.summary.product'), selected === 'tablets' ? 'MatriTablets' : 'MatriPowder'],
                  [t('calculator.summary.room'), `${vol} m³`],
                  [t('calculator.summary.dose'), `${fmtNum(results[selected]?.ppb || 0, 0)} ppb`],
                ].map(([l,v]) => (
                  <div key={l} style={{background:'rgba(255,255,255,.08)', borderRadius:'8px', padding:'10px', textAlign:'center'}}>
                    <div style={{fontSize:'10px', color:'rgba(255,255,255,.5)', marginBottom:'3px', textTransform:'uppercase'}}>{l}</div>
                    <div style={{fontSize:'14px', fontWeight:700, color:'#fff'}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', borderTop:'0.5px solid rgba(255,255,255,.15)', paddingTop:'14px'}}>
                <div>
                  <div style={{fontSize:'13px', color:'rgba(255,255,255,.6)'}}>{t('calculator.summary.productCost')}</div>
                  <div style={{fontSize:'13px', color:'rgba(255,255,255,.6)', marginTop:'2px'}}>
                    {selected !== 'tablets' && serviceModel === 'service' && t('calculator.summary.applicationService')}
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'13px', color:'#fff'}}>{fmtUSD(selected === 'tablets' ? results.tablets.productCost : results[selected]?.productCost || 0)}</div>
                  <div style={{fontSize:'13px', color:'#fff'}}>
                    {selected !== 'tablets' && serviceModel === 'service' && fmtUSD(results[selected]?.serviceFee || 0)}
                  </div>
                </div>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', borderTop:'0.5px solid rgba(181,204,46,.3)', paddingTop:'12px', marginTop:'8px'}}>
                <span style={{fontSize:'15px', fontWeight:700, color:'#b5cc2e'}}>{t('calculator.summary.total')}</span>
                <span style={{fontSize:'24px', fontWeight:800, color:'#fff'}}>
                  {fmtUSD(
                    selected === 'tablets'
                      ? results.tablets.productCost
                      : (results[selected]?.productCost || 0) + (serviceModel === 'service' ? (results[selected]?.serviceFee || 0) : 0)
                  )}
                </span>
              </div>
              <div style={{fontSize:'11px', color:'rgba(255,255,255,.4)', marginTop:'4px', textAlign:'right'}}>
                {t('calculator.summary.priceNote')}
              </div>
            </div>
          )}

          {/* Confirm button */}
          {selected && !treatmentSent && (
            <button onClick={sendTreatment} style={{...calcBtn, background:'#0b4358', marginTop:'0'}}>
              {t('calculator.confirm')}
            </button>
          )}

          {treatmentSent && (
            <div style={{background:'#eaf7ee', border:'1px solid #a3d9b0', borderRadius:'10px', padding:'16px', textAlign:'center', fontSize:'13px', color:'#1a6b30', fontWeight:500}}>
              {t('calculator.sentMessage')}
              <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>{t('calculator.sentHint')}</div>
              <button onClick={() => onNavigate && onNavigate('treatments')} style={{marginTop:'10px', background:'#0b4358', color:'#fff', border:'none', borderRadius:'8px', padding:'8px 16px', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'inherit'}}>
                {t('calculator.viewTreatments')}
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{textAlign:'center', fontSize:'11px', color:'#aaa', padding:'16px 0'}}>
        {t('calculator.footer')}
      </div>
    </div>
  )
}
