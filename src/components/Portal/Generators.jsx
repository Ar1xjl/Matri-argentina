import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import generatorImg  from '../../assets/images/MatriGenerator.png'
import generatorLogo from '../../assets/logos/MatriGenerator_Logo.svg'
import { supabase } from '../../lib/supabaseClient'
import { fetchOrgPricing, getGeneratorPrice, getServiceFee } from '../../lib/orgPricing'
import { exportToExcel, filterRows } from '../../lib/tableTools'
import { formatUSD as fmtUSD } from '../../lib/formatters'
import { generateSequence } from '../../lib/sequence'
import GeneratorTransferModal from './GeneratorTransferModal'

const GENERATOR_STATUS_KEYS = {
  available: 'available', dispatched: 'dispatched', on_rent: 'onRent',
  returned: 'returned', in_service: 'inService', repaired: 'repaired', out_of_service: 'outOfService',
}

export default function Generators({ orgId, seasonPlanLines = [], coldRooms = [], profile }) {
  const { t } = useTranslation()
  const statusLabel = (status) => t(`generators.status.${GENERATOR_STATUS_KEYS[status] || status}`, status)
  const [pricing,      setPricing]      = useState({ brackets: [], product: [], serviceFee: [], generator: [] })
  const [myGenerators, setMyGenerators] = useState([])
  const [showFleetFilters, setShowFleetFilters] = useState(false)
  const [fleetFilters, setFleetFilters] = useState({})

  const isDistributorView = profile?.organizations?.org_type !== 'customer'
  const canRegisterNew = ['global', 'distributor'].includes(profile?.organizations?.org_type)

  const FLEET_COLUMNS = [
    { header: t('generators.columns.unitId'),      get: g => g.unit_code || '' },
    { header: t('generators.columns.serialNumber'), get: g => g.serial_number || '' },
    { header: t('generators.columns.status'),       get: g => statusLabel(g.status) },
    { header: t('generators.columns.lastService'),  get: g => g.last_service_date || '' },
    { header: t('generators.columns.notes'),        get: g => g.notes || '' },
  ]

  const filteredFleet = filterRows(myGenerators, FLEET_COLUMNS, fleetFilters)
  const [rooms,      setRooms]      = useState(3)
  const [treatments, setTreatments] = useState(2)
  const [vol,        setVol]        = useState(500)
  const [showRoi,    setShowRoi]    = useState(false)
  const [usedPlanData, setUsedPlanData] = useState(false)

  const [showAddForm, setShowAddForm] = useState(false)
  const [newGen, setNewGen] = useState({ quantity: '1', unit_code: '', serial_number: '', purchase_date: '', notes: '' })
  const [addError, setAddError] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [transferTarget, setTransferTarget] = useState(null) // generator row being transferred, or null
  const [editingId, setEditingId] = useState(null) // generator id being edited, or null
  const [editBuffer, setEditBuffer] = useState({ unit_code: '', serial_number: '', purchase_date: '', notes: '' })
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Nearest ancestor with its own price list configured (Fase H, 2026-07-16)
  // — for the viewer's own org, so a Sub-distributor's own generator pricing
  // (if it's set one) is never shadowed by a descendant Customer's, and vice
  // versa never picks up an unrelated descendant Sub-distributor's rows.
  useEffect(() => { fetchOrgPricing(orgId).then(setPricing) }, [orgId])

  const loadGenerators = () => {
    if (!orgId) return
    supabase.from('generators').select('*').eq('org_id', orgId)
      .then(({ data }) => setMyGenerators(data || []))
  }

  useEffect(loadGenerators, [orgId])

  const handleAddGenerator = async () => {
    setAddError('')
    const quantity = Number(newGen.quantity)
    if (!newGen.unit_code.trim()) { setAddError(t('generators.form.unitIdRequired')); return }
    if (!quantity || quantity < 1) { setAddError(t('generators.form.quantityMin')); return }
    setAddSaving(true)

    const unitCodes = generateSequence(newGen.unit_code.trim(), quantity)
    const serialBase = newGen.serial_number.trim()
    const serials = serialBase ? generateSequence(serialBase, quantity) : []

    const rows = unitCodes.map((unit_code, i) => ({
      org_id: orgId,
      unit_code,
      serial_number: serials[i] || null,
      purchase_date: newGen.purchase_date || null,
      notes: newGen.notes.trim() || null,
    }))

    const { error } = await supabase.from('generators').insert(rows)
    setAddSaving(false)
    if (error) {
      setAddError(error.code === '23505' ? t('generators.form.duplicateUnitId') : error.message)
      return
    }
    setNewGen({ quantity: '1', unit_code: '', serial_number: '', purchase_date: '', notes: '' })
    setShowAddForm(false)
    loadGenerators()
  }

  const startEdit = (g) => {
    setEditingId(g.id)
    setEditBuffer({
      unit_code: g.unit_code || '', serial_number: g.serial_number || '',
      purchase_date: g.purchase_date || '', notes: g.notes || '',
    })
    setEditError('')
  }

  const handleSaveEdit = async () => {
    setEditError('')
    if (!editBuffer.unit_code.trim()) { setEditError(t('generators.form.unitIdEmpty')); return }
    setEditSaving(true)
    const { error } = await supabase.from('generators').update({
      unit_code: editBuffer.unit_code.trim(),
      serial_number: editBuffer.serial_number.trim() || null,
      purchase_date: editBuffer.purchase_date || null,
      notes: editBuffer.notes.trim() || null,
    }).eq('id', editingId)
    setEditSaving(false)
    if (error) {
      setEditError(error.code === '23505' ? t('generators.form.duplicateUnitIdEdit') : error.message)
      return
    }
    setEditingId(null)
    loadGenerators()
  }

  const handleReturn = async (generatorId) => {
    const { data: dispatch } = await supabase.from('generator_dispatches').select('id')
      .eq('generator_id', generatorId).is('returned_at', null)
      .order('dispatched_at', { ascending: false }).limit(1).maybeSingle()
    if (dispatch) {
      await supabase.from('generator_dispatches').update({ returned_at: new Date().toISOString() }).eq('id', dispatch.id)
    }
    await supabase.from('generators').update({ status: 'available' }).eq('id', generatorId)
    loadGenerators()
  }

  // Only MatriPowder lines represent real generator demand — Tablets need no
  // generator, and "sin decidir" is too speculative to plan a fleet around.
  const planSummary = useMemo(() => {
    const powderLines = seasonPlanLines.filter(l => l.product_preference === 'powder')
    const roomVolumeById = new Map(coldRooms.map(r => [r.id, r.volume_m3]))
    const uniqueRoomIds = new Set(powderLines.map(l => l.cold_room_id))
    const totalTreatments = powderLines.length
    const avgVolume = totalTreatments > 0
      ? Math.round(powderLines.reduce((s, l) => s + (roomVolumeById.get(l.cold_room_id) || 0), 0) / totalTreatments)
      : 0

    // Concurrency: how many Powder rooms share the exact same planned date —
    // that's how many generators would be needed at once that day.
    const countByDate = {}
    powderLines.forEach(l => {
      if (!l.planned_date) return
      countByDate[l.planned_date] = (countByDate[l.planned_date] || 0) + 1
    })
    const maxSimultaneous = Object.values(countByDate).length > 0 ? Math.max(...Object.values(countByDate)) : 0

    return { totalTreatments, uniqueRooms: uniqueRoomIds.size, avgVolume, maxSimultaneous }
  }, [seasonPlanLines, coldRooms])

  const applyPlanData = () => {
    const { uniqueRooms, totalTreatments, avgVolume } = planSummary
    if (uniqueRooms === 0) return
    setRooms(uniqueRooms)
    setTreatments(Math.max(1, Math.round(totalTreatments / uniqueRooms)))
    setVol(avgVolume)
    setUsedPlanData(true)
    setShowRoi(true)
  }

  // Prices from the real pricing engine (this Organization's Distributor's tables)
  const { purchase_price: genPurchase } = getGeneratorPrice(pricing, vol)
  const serviceFee = getServiceFee(pricing, vol)

  // ROI calculation — Comprar vs. Servicio gestionado only (rental por día
  // discontinued, DOMAIN_MODEL.md Rule 39 update — too much support/upkeep
  // overhead relative to its actual use).
  const totalRooms       = rooms * treatments          // total treatments per season
  const serviceCostTotal = totalRooms * serviceFee     // cost of managed service
  const breakEvenTreatments = serviceFee > 0 ? Math.ceil(genPurchase / serviceFee) : 0 // treatments to break even vs service
  const unitsToBuy = Math.max(1, planSummary.maxSimultaneous)

  // `type` drives both logic (which row/branch to highlight) and display
  // (translated via t() below) — keep them decoupled so this doesn't break
  // when the UI language changes.
  const recommendation = () => {
    if (totalRooms >= breakEvenTreatments && breakEvenTreatments > 0) {
      return {
        type: 'buy', color:'#1a6b30', bg:'#eaf7ee', icon:'🏆',
        desc: usedPlanData && planSummary.maxSimultaneous > 1
          ? t('generators.roi.recommendation.buyWithConcurrency', { total: totalRooms, breakEven: breakEvenTreatments, units: unitsToBuy })
          : t('generators.roi.recommendation.buy', { total: totalRooms, breakEven: breakEvenTreatments }),
      }
    } else {
      return { type: 'service', color:'#0c447c', bg:'#e8f4fc', icon:'👷', desc: t('generators.roi.recommendation.service', { total: totalRooms }) }
    }
  }

  const rec = recommendation()
  const recLabel = rec.type === 'buy' ? t('generators.roi.recommendation.buyLabel') : t('generators.roi.recommendation.serviceLabel')

  const PRODUCTS = [
    { title:t('generators.products.buy.title'), price: fmtUSD(genPurchase), desc:t('generators.products.buy.desc'), btn:t('generators.products.requestPurchase'), style:'primary' },
    { title:t('generators.products.battery.title'), price:'$95 USD', desc:t('generators.products.battery.desc'), btn:t('generators.products.requestPurchase'), style:'primary' },
  ]

  const fleetSection = (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{t('generators.myGenerators')}</span>
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <span style={{fontSize:'12px', color:'var(--gray)'}}>{t('generators.individualId')}</span>
          <button className="btn-secondary btn-sm" onClick={() => setShowFleetFilters(!showFleetFilters)}>{showFleetFilters ? t('common.closeFilters') : t('common.filter')}</button>
          <button className="btn-secondary btn-sm" onClick={() => exportToExcel('generadores.xlsx', FLEET_COLUMNS, filteredFleet)}>{t('generators.export')}</button>
          {canRegisterNew && (
            <button className="btn-lime btn-sm" onClick={() => setShowAddForm(!showAddForm)}>{showAddForm ? t('common.cancel') : t('generators.addGenerator')}</button>
          )}
        </div>
      </div>

      {showAddForm && (
        <div style={{padding:'16px 20px', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>
          <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'0.7fr 1.3fr 1.3fr 1fr 1fr', gap:'10px', marginBottom:'10px'}}>
            <div>
              <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>{t('generators.form.quantity')}</label>
              <input type="number" min="1" style={{width:'100%', padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'13px'}} value={newGen.quantity} onChange={e => setNewGen(prev => ({ ...prev, quantity: e.target.value }))}/>
            </div>
            <div>
              <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>{t('generators.form.unitId')} {Number(newGen.quantity) > 1 ? t('generators.form.firstOfBatch') : ''}</label>
              <input style={{width:'100%', padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'13px'}} value={newGen.unit_code} onChange={e => setNewGen(prev => ({ ...prev, unit_code: e.target.value }))} placeholder="Ej: GEN-001"/>
            </div>
            <div>
              <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>{t('generators.columns.serialNumber')} {Number(newGen.quantity) > 1 ? t('generators.form.firstOfBatch') : ''}</label>
              <input style={{width:'100%', padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'13px'}} value={newGen.serial_number} onChange={e => setNewGen(prev => ({ ...prev, serial_number: e.target.value }))} placeholder={t('generators.form.optional')}/>
            </div>
            <div>
              <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>{t('generators.form.purchaseDate')}</label>
              <input type="date" style={{width:'100%', padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'13px'}} value={newGen.purchase_date} onChange={e => setNewGen(prev => ({ ...prev, purchase_date: e.target.value }))}/>
            </div>
            <div>
              <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>{t('generators.columns.notes')}</label>
              <input style={{width:'100%', padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'13px'}} value={newGen.notes} onChange={e => setNewGen(prev => ({ ...prev, notes: e.target.value }))} placeholder={t('generators.form.notesPlaceholder')}/>
            </div>
          </div>
          {Number(newGen.quantity) > 1 && newGen.unit_code.trim() && (
            <div style={{fontSize:'12px', color:'#0b4358', marginBottom:'10px'}}>
              {t('generators.form.willCreate', { count: Number(newGen.quantity) })} <strong>{generateSequence(newGen.unit_code.trim(), Number(newGen.quantity))[0]}</strong> {t('generators.form.to')}{' '}
              <strong>{generateSequence(newGen.unit_code.trim(), Number(newGen.quantity)).slice(-1)[0]}</strong>
              {newGen.serial_number.trim() && <> — {t('generators.columns.serialNumber')} <strong>{generateSequence(newGen.serial_number.trim(), Number(newGen.quantity))[0]}</strong> {t('generators.form.to')} <strong>{generateSequence(newGen.serial_number.trim(), Number(newGen.quantity)).slice(-1)[0]}</strong></>}
            </div>
          )}
          {addError && <div style={{color:'#8b2020', fontSize:'12px', marginBottom:'10px'}}>{addError}</div>}
          <button className="btn-primary btn-sm" disabled={addSaving} onClick={handleAddGenerator}>{addSaving ? t('common.saving') : t('generators.form.save')}</button>
        </div>
      )}

      <div style={{padding:0}}>
        {myGenerators.length === 0 ? (
          <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>
            {canRegisterNew ? t('generators.emptyCanRegister') : t('generators.emptyReadonly')}
          </div>
        ) : filteredFleet.length === 0 ? (
          <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>
            {t('generators.noFilterMatches')}
          </div>
        ) : (
          <div className="table-scroll"><table className="data-table">
            <thead>
              <tr>
                <th>{t('generators.columns.unitId')}</th><th>{t('generators.columns.serialNumber')}</th><th>{t('generators.columns.status')}</th><th>{t('generators.columns.lastService')}</th><th>{t('generators.columns.notes')}</th>{isDistributorView && <th></th>}
              </tr>
              {showFleetFilters && (
                <tr>
                  {FLEET_COLUMNS.map(c => (
                    <th key={c.header} style={{padding:'4px 8px'}}>
                      <input
                        value={fleetFilters[c.header] || ''}
                        onChange={e => setFleetFilters(prev => ({ ...prev, [c.header]: e.target.value }))}
                        placeholder={t('common.filterPlaceholder')}
                        style={{width:'100%', padding:'5px 7px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'12px', fontWeight:400}}
                      />
                    </th>
                  ))}
                  {isDistributorView && <th/>}
                </tr>
              )}
            </thead>
            <tbody>
              {filteredFleet.map(g => editingId === g.id ? (
                <tr key={g.id} style={{background:'#f5f5ee'}}>
                  <td><input style={{width:'100%', padding:'5px 7px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'12px'}} value={editBuffer.unit_code} onChange={e => setEditBuffer(prev => ({ ...prev, unit_code: e.target.value }))}/></td>
                  <td><input style={{width:'100%', padding:'5px 7px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'12px'}} value={editBuffer.serial_number} onChange={e => setEditBuffer(prev => ({ ...prev, serial_number: e.target.value }))}/></td>
                  <td><span className={`status ${g.status === 'available' ? 'approved' : 'pending'}`}>{statusLabel(g.status)}</span></td>
                  <td><input type="date" style={{width:'100%', padding:'5px 7px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'12px'}} value={editBuffer.purchase_date} onChange={e => setEditBuffer(prev => ({ ...prev, purchase_date: e.target.value }))}/></td>
                  <td><input style={{width:'100%', padding:'5px 7px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'12px'}} value={editBuffer.notes} onChange={e => setEditBuffer(prev => ({ ...prev, notes: e.target.value }))}/></td>
                  {isDistributorView && (
                    <td>
                      <div style={{display:'flex', gap:'6px'}}>
                        <button className="btn-primary btn-sm" disabled={editSaving} onClick={handleSaveEdit}>{editSaving ? t('common.saving') : t('generators.form.save')}</button>
                        <button className="btn-secondary btn-sm" onClick={() => setEditingId(null)}>{t('common.cancel')}</button>
                      </div>
                      {editError && <div style={{color:'#8b2020', fontSize:'11px', marginTop:'4px'}}>{editError}</div>}
                    </td>
                  )}
                </tr>
              ) : (
                <tr key={g.id}>
                  <td style={{fontWeight:700, fontFamily:'monospace'}}>{g.unit_code}</td>
                  <td style={{fontFamily:'monospace', color:'var(--gray)'}}>{g.serial_number || '—'}</td>
                  <td><span className={`status ${g.status === 'available' ? 'approved' : 'pending'}`}>{statusLabel(g.status)}</span></td>
                  <td style={{color:'var(--gray)'}}>{g.last_service_date || '—'}</td>
                  <td style={{color:'var(--gray)'}}>{g.notes || '—'}</td>
                  {isDistributorView && (
                    <td>
                      <div style={{display:'flex', gap:'6px'}}>
                        <button className="btn-secondary btn-sm" onClick={() => startEdit(g)}>{t('generators.edit')}</button>
                        {g.status === 'available' && (
                          <button className="btn-secondary btn-sm" onClick={() => setTransferTarget(g)}>{t('generators.transfer')}</button>
                        )}
                        {(g.status === 'dispatched' || g.status === 'on_rent') && (
                          <button className="btn-secondary btn-sm" onClick={() => handleReturn(g.id)}>{t('generators.markReturned')}</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {transferTarget && (
        <GeneratorTransferModal
          generator={transferTarget}
          profile={profile}
          onClose={() => setTransferTarget(null)}
          onDone={() => { setTransferTarget(null); loadGenerators() }}
        />
      )}
    </div>
  )

  // Distributor/Sub-distributor/Global owns the fleet, not the buy-vs-rent
  // decision — lead with fleet status, skip the Customer-facing ROI
  // calculator and purchase cards entirely.
  if (isDistributorView) {
    return (
      <div>
        <div className="alert info">
          {t('generators.fleetStatusNotice')}
        </div>
        {fleetSection}
      </div>
    )
  }

  return (
    <div>
      <div className="alert warn">
        {t('generators.contactDistributor')}
      </div>

      {/* ROI Calculator */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('generators.roi.title')}</span>
          <div style={{display:'flex', gap:'8px'}}>
            {planSummary.uniqueRooms > 0 && (
              <button className="btn-lime btn-sm" onClick={applyPlanData}>{t('generators.roi.usePlan')}</button>
            )}
            <button className="btn-secondary btn-sm" onClick={() => setShowRoi(!showRoi)}>
              {showRoi ? t('generators.roi.hide') : t('generators.roi.show')}
            </button>
          </div>
        </div>

        {showRoi && (
          <div className="card-body">
            {usedPlanData && (
              <div className="alert info" style={{marginBottom:'16px'}}>
                {t('generators.roi.planDataNotice')}
              </div>
            )}
            <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'20px'}}>
              <div>
                <label style={{display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}}>
                  {t('generators.roi.roomsWithPowder')}
                </label>
                <input
                  type="number" min="1" max="50"
                  value={rooms}
                  onChange={e => { setRooms(Number(e.target.value)); setUsedPlanData(false) }}
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8'}}
                />
              </div>
              <div>
                <label style={{display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}}>
                  {t('generators.roi.treatmentsPerRoom')}
                </label>
                <input
                  type="number" min="1" max="10"
                  value={treatments}
                  onChange={e => { setTreatments(Number(e.target.value)); setUsedPlanData(false) }}
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8'}}
                />
              </div>
              <div>
                <label style={{display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}}>
                  {t('generators.roi.avgVolume')}
                </label>
                <input
                  type="number" min="50" step="50"
                  value={vol}
                  onChange={e => { setVol(Number(e.target.value)); setUsedPlanData(false) }}
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8'}}
                />
              </div>
            </div>

            {usedPlanData && (
              <div style={{display:'grid', gridTemplateColumns:'1fr', gap:'8px', marginBottom:'20px'}}>
                <div style={{background:'#f5f5ee', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'#0b4358'}}>
                  <strong>{t('generators.roi.peakDay')}:</strong> {planSummary.maxSimultaneous || 0}
                </div>
              </div>
            )}

            {/* Recommendation */}
            <div style={{background:rec.bg, border:`1px solid ${rec.color}`, borderRadius:'10px', padding:'16px 20px', marginBottom:'20px', display:'flex', alignItems:'flex-start', gap:'14px'}}>
              <div style={{fontSize:'28px'}}>{rec.icon}</div>
              <div>
                <div style={{fontSize:'14px', fontWeight:700, color:rec.color, marginBottom:'4px'}}>{recLabel}</div>
                <div style={{fontSize:'13px', color:'#444'}}>{rec.desc}</div>
              </div>
            </div>

            {/* Comparison table */}
            <div style={{background:'#fff', borderRadius:'10px', border:'0.5px solid #ddddd5', overflow:'hidden'}}>
              <div className="table-scroll">
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
                <thead>
                  <tr>
                    {[t('generators.roi.table.option'), t('generators.roi.table.costPerTreatment'), t('generators.roi.table.total', { total: totalRooms }), t('generators.roi.table.breakEven')].map(h => (
                      <th key={h} style={{padding:'10px 16px', textAlign:'left', fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', background:'#f5f5ee', borderBottom:'0.5px solid #ddddd5'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      option: t('generators.roi.recommendation.serviceLabel'),
                      perTreatment: fmtUSD(serviceFee),
                      total: fmtUSD(serviceCostTotal),
                      breakeven: t('generators.roi.table.alwaysAvailable'),
                      highlight: rec.type === 'service',
                    },
                    {
                      option: t('generators.roi.recommendation.buyLabel'),
                      perTreatment: fmtUSD(genPurchase / Math.max(totalRooms, 1)) + t('generators.roi.table.perTreatmentSuffix'),
                      total: fmtUSD(genPurchase * unitsToBuy) + (unitsToBuy > 1 ? t('generators.roi.table.units', { count: unitsToBuy }) : t('generators.roi.table.singlePayment')),
                      breakeven: breakEvenTreatments > 0 ? t('generators.roi.table.treatmentsCount', { count: breakEvenTreatments }) : '—',
                      highlight: rec.type === 'buy',
                    },
                  ].map((r, i) => (
                    <tr key={i} style={{
                      borderBottom: i < 1 ? '0.5px solid #ddddd5' : 'none',
                      background: r.highlight ? '#f0f7e0' : '#fff',
                    }}>
                      <td style={{padding:'12px 16px', fontWeight: r.highlight ? 700 : 400}}>
                        {r.highlight && '✓ '}{r.option}
                      </td>
                      <td style={{padding:'12px 16px', fontFamily:'monospace'}}>{r.perTreatment}</td>
                      <td style={{padding:'12px 16px', fontWeight:700, fontFamily:'monospace'}}>{r.total}</td>
                      <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{r.breakeven}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            <div style={{fontSize:'11px', color:'#888', marginTop:'10px'}}>
              {t('generators.roi.footnote', { vol })}
            </div>
          </div>
        )}
      </div>

      {/* Product cards */}
      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'16px', marginBottom:'20px'}}>
        {PRODUCTS.map((p, i) => (
          <div key={i} style={{background:'white', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'22px 18px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center'}}>
            <img src={generatorImg} alt="Generador" style={{height:'90px', objectFit:'contain', marginBottom:'12px', opacity: i===1 ? .6 : 1}}/>
            <img src={generatorLogo} alt="MaTri Generator" style={{height:'22px', objectFit:'contain', marginBottom:'10px'}}/>
            <div style={{fontSize:'20px', fontWeight:900, color:'var(--coral)', marginBottom:'6px'}}>{p.price}</div>
            <div style={{fontSize:'12px', color:'var(--gray)', marginBottom:'16px', lineHeight:1.6, flex:1}}>{p.desc}</div>
            <button className={p.style === 'lime' ? 'btn-lime' : 'btn-primary'} style={{width:'100%'}}>{p.btn}</button>
          </div>
        ))}
      </div>

      {fleetSection}
    </div>
  )
}
