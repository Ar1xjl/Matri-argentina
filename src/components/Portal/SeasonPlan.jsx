import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchOrgPricing, fetchCustomerOverride, fetchPouchCatalog, resolveProductPrice } from '../../lib/orgPricing'
import { POUCHES, DOSE_BASE, greedyCeiling, comboGrams, actualPpb, tabletCombo } from '../../lib/dosing'
import { downloadPlanTemplate } from '../../lib/excelImport'
import { exportToExcel, filterRows } from '../../lib/tableTools'
import { formatUSD as fmtUSD } from '../../lib/formatters'
import CampaignCostSimulator from './CampaignCostSimulator'

// Same "indicative cost" math as the Calculator — exact-dose Powder cost, or
// scaled Tablets cost. Undecided product has no indicative cost yet. Applies
// this Customer's negotiated price override, if any (DOMAIN_MODEL.md Rule 36).
function computeIndicativeCost(pricing, product, targetDosePpb, volumeM3, override, pouchSizes) {
  if (!volumeM3 || !targetDosePpb || product === 'undecided') return null
  if (product === 'tablets') {
    const { ppb } = tabletCombo(targetDosePpb, volumeM3)
    const price = resolveProductPrice(pricing, 'MatriTablets', volumeM3, override)
    return volumeM3 * price * (ppb / 1000)
  }
  const grams = volumeM3 * DOSE_BASE * (targetDosePpb / 1000)
  const combo = greedyCeiling(grams, pouchSizes)
  const actualG = comboGrams(combo)
  const realPpb = actualPpb(actualG, volumeM3)
  const price = resolveProductPrice(pricing, 'MatriPowder', volumeM3, override)
  return volumeM3 * price * (realPpb / 1000)
}

const card = {background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'20px', marginBottom:'16px'}
const cell = {padding:'8px 10px', border:'0.5px solid #ddddd5', fontSize:'13px'}
const inp  = {width:'100%', padding:'6px 8px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'13px', color:'#0b4358', fontFamily:'inherit'}

export default function SeasonPlan({
  plan, plans = [], lines = [], coldRooms = [], orgId = null, onAddLine, onUpdateLine, onDeleteLine, onConvert,
  onImportPlan, onBulkApply, onClearPlannedLines, onNavigate, myRoles = [], onSelectPlan, onCreatePlan,
}) {
  const { t } = useTranslation()
  // Role-visibility backlog item (flagged 2026-08-11, scoped and built
  // 2026-08-25) — a "pure" Operador (has the role but not Owner/Aprobador
  // too) shouldn't see cost/price figures here. Someone who holds Operador
  // *alongside* Owner/Aprobador still sees everything, same as today.
  const isPureOperator = myRoles.includes('operator') && !myRoles.includes('owner') && !myRoles.includes('approver')
  // An archived campaign is read-only in this table — its only intended
  // write path is uploading an Excel "tal cual" into it (see Portal.jsx's
  // importPlanExcel). Editing here is reserved for the active campaign, or a
  // new one created via "Nueva campaña basada en..." (2026-08-26).
  const isArchived = plan?.status === 'archived'
  const PRODUCT_LABEL = { powder: 'MatriPowder', tablets: 'MatriTablets', undecided: t('seasonPlan.productUndecided') }
  const [pricing, setPricing] = useState({ brackets: [], product: [], serviceFee: [] })
  const [override, setOverride] = useState(null)
  const [pouchSizes, setPouchSizes] = useState(POUCHES)
  const [selected, setSelected] = useState(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({})
  const [showSimulator, setShowSimulator] = useState(false)
  const [bulkDate,    setBulkDate]    = useState('')
  const [bulkDose,    setBulkDose]    = useState('')
  const [bulkCrop,    setBulkCrop]    = useState('')
  const [bulkVariety, setBulkVariety] = useState('')
  const [bulkProduct, setBulkProduct] = useState('')
  const [importResult, setImportResult] = useState(null) // { imported, errors, duplicates, campaignMismatch } | null
  const [importing, setImporting] = useState(false)
  const [pendingFile, setPendingFile] = useState(null) // file waiting on the replace/add choice
  const planFileInput = useRef(null)
  // 'blank' | 'basedOn' | 'historical' | null — the three ways to create a
  // campaign: empty & active, cloned from an archived one & active, or an
  // empty archived shell meant to receive a historical Excel upload.
  const [planModal,      setPlanModal]      = useState(null)
  const [newPlanLabel,   setNewPlanLabel]   = useState('')
  const [newPlanSource,  setNewPlanSource]  = useState('')
  const [creatingPlan,   setCreatingPlan]   = useState(false)

  const archivedPlans = plans.filter(p => p.status === 'archived')
  const sortedPlans = [...plans].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const openPlanModal = (kind) => {
    // Best-guess default label, not a locked-in one — the input stays fully
    // editable before confirming.
    setNewPlanLabel(kind === 'blank' ? `Temporada ${new Date().getFullYear() + 1}` : '')
    setNewPlanSource('')
    setPlanModal(kind)
  }

  const confirmPlanModal = async () => {
    if (!newPlanLabel.trim()) return
    if (planModal === 'basedOn' && !newPlanSource) return
    setCreatingPlan(true)
    await onCreatePlan({
      label: newPlanLabel.trim(),
      makeActive: planModal !== 'historical',
      cloneFromPlanId: planModal === 'basedOn' ? newPlanSource : null,
    })
    setCreatingPlan(false)
    setPlanModal(null)
  }

  // `financial: true` columns are dropped entirely for a pure Operador (role
  // gate above) — same filter drives the header, the Excel export, and the
  // filter-row inputs, since all three read off this one array.
  const SEASON_PLAN_COLUMNS = [
    { header: t('seasonPlan.columns.room'),      get: l => l.room?.name || '' },
    // `l.crop` is the snapshot taken when the line was created/imported
    // (migration 0036); the room fallback only matters for lines that
    // predate the snapshot.
    { header: t('seasonPlan.columns.crop'),       get: l => l.crop || l.room?.primary_crop || '' },
    { header: t('seasonPlan.columns.variety'),    get: l => l.variety || '' },
    { header: t('seasonPlan.columns.volume'),     get: l => l.room?.volume_m3 ?? '' },
    { header: t('seasonPlan.columns.estDate'),    get: l => l.planned_date || '' },
    { header: t('seasonPlan.columns.dose'),       get: l => l.planned_dose_ppb ?? '' },
    { header: t('seasonPlan.columns.product'),    get: l => PRODUCT_LABEL[l.product_preference] || l.product_preference },
    { header: t('seasonPlan.columns.cost'),       get: l => l.cost != null ? l.cost.toFixed(2) : '', financial: true },
    { header: t('seasonPlan.columns.costPerM3'),  get: l => (l.cost != null && l.room?.volume_m3) ? (l.cost / l.room.volume_m3).toFixed(2) : '', financial: true },
    { header: t('seasonPlan.columns.notes'),      get: l => l.notes || '' },
    { header: t('seasonPlan.columns.status'),     get: l => l.status === 'converted' ? t('seasonPlan.status.converted') : t('seasonPlan.status.planned') },
  ].filter(c => !c.financial || !isPureOperator)

  // Nearest ancestor with its own price list configured (Fase H, 2026-07-16).
  useEffect(() => { fetchOrgPricing(orgId).then(setPricing) }, [orgId])
  // Negotiated price for this Customer, if any (DOMAIN_MODEL.md Rule 36).
  useEffect(() => { if (orgId) fetchCustomerOverride(orgId).then(setOverride) }, [orgId])
  // This Distributor's own editable pouch-size catalog (Fase E, 2026-07-12).
  useEffect(() => { fetchPouchCatalog().then(sizes => { if (sizes.length > 0) setPouchSizes(sizes) }) }, [])

  const handleImport = async (file) => {
    if (!file) return
    setImporting(true)
    setImportResult(null)
    const result = await onImportPlan(file)
    setImporting(false)
    setImportResult(result)
  }

  // If there's already a planned line, ask whether this upload should
  // replace them or just add to them — re-uploading a similar file with no
  // warning is exactly how duplicates happen.
  const handleFileSelected = (file) => {
    if (!file) return
    const hasPlannedLines = lines.some(l => l.status === 'planned')
    if (hasPlannedLines) {
      setPendingFile(file)
    } else {
      handleImport(file)
    }
  }

  const resolvePendingImport = async (shouldClearFirst) => {
    const file = pendingFile
    setPendingFile(null)
    if (shouldClearFirst) await onClearPlannedLines()
    await handleImport(file)
  }

  const enriched = useMemo(() => lines.map(l => {
    const room = coldRooms.find(r => r.id === l.cold_room_id)
    const cost = computeIndicativeCost(pricing, l.product_preference, l.planned_dose_ppb, room?.volume_m3, override, pouchSizes)
    return { ...l, room, cost }
  }), [lines, coldRooms, pricing, override, pouchSizes])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- SEASON_PLAN_COLUMNS is rebuilt every render (it closes over `t`), memoizing on it would defeat the memo
  const filtered = useMemo(() => filterRows(enriched, SEASON_PLAN_COLUMNS, filters), [enriched, filters])
  const setFilter = (header, value) => setFilters(prev => ({ ...prev, [header]: value }))

  const totals = useMemo(() => {
    const uniqueRooms = new Set(filtered.map(l => l.cold_room_id).filter(Boolean))
    const totalM3 = filtered.reduce((s, l) => s + (l.room?.volume_m3 || 0), 0)
    const totalCost = filtered.reduce((s, l) => s + (l.cost || 0), 0)
    return {
      rooms: uniqueRooms.size,
      applications: filtered.length,
      m3: totalM3,
      cost: totalCost,
      avgPerM3: totalM3 > 0 ? totalCost / totalM3 : 0,
    }
  }, [filtered])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const plannedIds = filtered.filter(l => l.status === 'planned').map(l => l.id)
  const allSelected = plannedIds.length > 0 && plannedIds.every(id => selected.has(id))
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(plannedIds))

  const selectedPlannedLines = enriched.filter(l => selected.has(l.id) && l.status === 'planned')

  const handleConvert = () => {
    if (selectedPlannedLines.length === 0) return
    onConvert(selectedPlannedLines)
    setSelected(new Set())
  }

  // Only fields the customer actually filled in get applied — leaving one
  // blank means "don't touch this" for every selected row, not "clear it".
  const handleBulkApply = async () => {
    if (selectedPlannedLines.length === 0) return
    const patch = {}
    if (bulkDate)    patch.planned_date = bulkDate
    if (bulkDose)    patch.planned_dose_ppb = Number(bulkDose)
    if (bulkProduct) patch.product_preference = bulkProduct
    if (bulkCrop)    patch.crop = bulkCrop
    if (bulkVariety) patch.variety = bulkVariety
    if (Object.keys(patch).length === 0) return
    await onBulkApply(selectedPlannedLines.map(l => l.id), patch)
    setBulkDate(''); setBulkDose(''); setBulkCrop(''); setBulkVariety(''); setBulkProduct('')
  }

  return (
    <div>
      <div className="alert info" style={{marginBottom:'16px'}}>
        {t('seasonPlan.intro')}
      </div>

      {/* Campaign picker — second step after landing on this screen: which
          campaign (active or archived) is currently shown below. */}
      <div style={{...card, display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap'}}>
        <div style={{flex:'1 1 220px', minWidth:'200px'}}>
          <label style={{fontSize:'10px', color:'#888', display:'block', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'.04em'}}>
            {t('seasonPlan.campaignPicker.label')}
          </label>
          <select style={inp} value={plan?.id || ''} onChange={e => onSelectPlan(e.target.value)}>
            {sortedPlans.map(p => (
              <option key={p.id} value={p.id}>
                {p.status === 'active'
                  ? t('seasonPlan.campaignPicker.active', { label: p.season_label })
                  : t('seasonPlan.campaignPicker.archived', { label: p.season_label })}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => openPlanModal('blank')}>{t('seasonPlan.campaignPicker.new')}</button>
        <button className="btn-secondary btn-sm" disabled={archivedPlans.length === 0} style={{opacity: archivedPlans.length === 0 ? .5 : 1}} onClick={() => openPlanModal('basedOn')}>
          {t('seasonPlan.campaignPicker.newBasedOn')}
        </button>
        <button className="btn-secondary btn-sm" onClick={() => openPlanModal('historical')}>{t('seasonPlan.campaignPicker.uploadHistorical')}</button>
      </div>

      {isArchived && (
        <div className="alert" style={{marginBottom:'16px', background:'#fff7e6', color:'#8a5a00', border:'1px solid #f0d9a0'}}>
          {t('seasonPlan.archivedBanner')}
        </div>
      )}

      {/* Excel import */}
      <div style={{...card, background:'#f9faf5'}}>
        <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358', marginBottom:'10px'}}>
          {t('seasonPlan.excelImport.title')}
        </div>
        <div style={{display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'center'}}>
          <button className="btn-secondary btn-sm" onClick={downloadPlanTemplate}>{t('seasonPlan.excelImport.downloadTemplate')}</button>
          <button className="btn-lime btn-sm" disabled={importing} onClick={() => planFileInput.current?.click()}>{t('seasonPlan.excelImport.uploadPlan')}</button>
          <input ref={planFileInput} type="file" accept=".xlsx,.xls" style={{display:'none'}}
            onChange={e => { handleFileSelected(e.target.files[0]); e.target.value = '' }}/>
          {importing && <span style={{fontSize:'12px', color:'#888'}}>{t('seasonPlan.excelImport.importing')}</span>}
        </div>
        <div style={{fontSize:'11px', color:'#888', marginTop:'6px'}}>
          {t('seasonPlan.excelImport.hint')}
        </div>

        {importResult && (
          <div style={{marginTop:'12px', fontSize:'12px'}}>
            <div style={{color:'#1a6b30', fontWeight:600}}>
              {t('seasonPlan.excelImport.imported', { count: importResult.imported })}
            </div>
            {importResult.campaignMismatch?.length > 0 && (
              <div style={{marginTop:'6px', color:'#8a5a00'}}>
                {t('seasonPlan.excelImport.campaignMismatch', { labels: importResult.campaignMismatch.join(', ') })}
              </div>
            )}
            {importResult.duplicates?.length > 0 && (
              <div style={{marginTop:'6px', color:'#b06a00'}}>
                {t('seasonPlan.excelImport.duplicates', { count: importResult.duplicates.length })}
                <ul style={{margin:'4px 0 0', paddingLeft:'18px'}}>
                  {importResult.duplicates.map((d, i) => (
                    <li key={i}>{d.room}{d.date ? ` — ${d.date}` : ` — ${t('seasonPlan.excelImport.noDate')}`}</li>
                  ))}
                </ul>
              </div>
            )}
            {importResult.errors.length > 0 && (
              <div style={{marginTop:'6px', color:'#8b2020'}}>
                {t('seasonPlan.excelImport.errors', { count: importResult.errors.length })}
                <ul style={{margin:'4px 0 0', paddingLeft:'18px'}}>
                  {importResult.errors.map((e, i) => (
                    <li key={i}>{e.row !== '-' ? t('seasonPlan.excelImport.rowPrefix', { row: e.row }) : ''}{e.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary panel — cost tiles dropped entirely for a pure Operador */}
      <div style={{display:'grid', gridTemplateColumns:`repeat(${isPureOperator ? 3 : 5},1fr)`, gap:'14px', marginBottom:'16px'}}>
        {[
          [t('seasonPlan.summary.rooms'), totals.rooms],
          [t('seasonPlan.summary.applications'), totals.applications],
          [t('seasonPlan.summary.totalM3'), totals.m3.toLocaleString()],
          ...(isPureOperator ? [] : [
            [t('seasonPlan.summary.totalCost'), fmtUSD(totals.cost)],
            [t('seasonPlan.summary.avgCostPerM3'), fmtUSD(totals.avgPerM3)],
          ]),
        ].map(([label, value]) => (
          <div key={label} style={{background:'#0b4358', borderRadius:'12px', padding:'14px', textAlign:'center'}}>
            <div style={{fontSize:'10px', color:'rgba(255,255,255,.6)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:'4px'}}>{label}</div>
            <div style={{fontSize:'18px', fontWeight:800, color:'#fff'}}>{value}</div>
          </div>
        ))}
      </div>
      {!isPureOperator && (
        <div style={{fontSize:'11px', color:'#888', marginBottom:'16px', textAlign:'right'}}>
          {t('seasonPlan.summary.disclaimer1')}
          <br/>{t('seasonPlan.summary.disclaimer2')}
        </div>
      )}

      {!isPureOperator && enriched.some(l => l.product_preference !== 'undecided') && (
        <div style={{
          ...card, background:'#0b4358', display:'flex', alignItems:'center',
          justifyContent:'space-between', flexWrap:'wrap', gap:'12px',
        }}>
          <div>
            <div style={{fontSize:'14px', fontWeight:700, color:'#fff', marginBottom:'2px'}}>
              {t('seasonPlan.simulator.title')}
            </div>
            <div style={{fontSize:'12px', color:'rgba(255,255,255,.7)'}}>
              {selected.size > 0
                ? t('seasonPlan.simulator.descSelected', { count: selected.size })
                : t('seasonPlan.simulator.descAll')}
            </div>
          </div>
          <button className="btn-lime btn-sm" onClick={() => setShowSimulator(true)}>
            {t('seasonPlan.simulator.open')}
          </button>
        </div>
      )}

      {!isPureOperator && showSimulator && (
        <CampaignCostSimulator
          lines={selected.size > 0 ? enriched.filter(l => selected.has(l.id)) : enriched}
          pricing={pricing}
          override={override}
          pouchSizes={pouchSizes}
          onClose={() => setShowSimulator(false)}
          onNavigate={onNavigate}
        />
      )}

      {/* Table */}
      <div style={card}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'10px'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>
            {plan?.season_label || t('seasonPlan.defaultLabel')}
            {isArchived && <span style={{marginLeft:'8px', fontSize:'11px', fontWeight:700, color:'#8a5a00', background:'#fff2d1', padding:'2px 8px', borderRadius:'100px'}}>{t('seasonPlan.archivedBadge')}</span>}
          </span>
          <div style={{display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap'}}>
            {!isArchived && <button className="btn-secondary btn-sm" onClick={onAddLine}>{t('seasonPlan.addLine')}</button>}
            <button className="btn-secondary btn-sm" onClick={() => setShowFilters(!showFilters)}>{showFilters ? t('common.closeFilters') : t('common.filter')}</button>
            <button className="btn-secondary btn-sm" onClick={() => exportToExcel('plan_de_temporada.xlsx', SEASON_PLAN_COLUMNS, filtered)}>{t('common.exportExcel')}</button>
            {!isArchived && (
              <button
                className="btn-primary btn-sm"
                disabled={selectedPlannedLines.length === 0}
                style={{opacity: selectedPlannedLines.length === 0 ? .5 : 1}}
                onClick={handleConvert}
              >
                {t('seasonPlan.convert')}{selectedPlannedLines.length > 0 ? ` (${selectedPlannedLines.length})` : ''}
              </button>
            )}
          </div>
        </div>

        {!isArchived && selectedPlannedLines.length > 0 && (
          <div style={{background:'#f0f7ff', border:'1px solid #cfe3f7', borderRadius:'10px', padding:'12px 14px', marginBottom:'14px'}}>
            <div style={{fontSize:'12px', fontWeight:700, color:'#0b4358', marginBottom:'8px'}}>
              {t('seasonPlan.bulkEdit.title', { count: selectedPlannedLines.length })}
            </div>
            <div style={{display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'flex-end'}}>
              <div>
                <label style={{fontSize:'10px', color:'#888', display:'block', marginBottom:'3px'}}>{t('seasonPlan.bulkEdit.date')}</label>
                <input style={inp} type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)}/>
              </div>
              <div>
                <label style={{fontSize:'10px', color:'#888', display:'block', marginBottom:'3px'}}>{t('seasonPlan.columns.dose')}</label>
                <input style={{...inp, width:'100px'}} type="number" value={bulkDose} onChange={e => setBulkDose(e.target.value)}/>
              </div>
              <div>
                <label style={{fontSize:'10px', color:'#888', display:'block', marginBottom:'3px'}}>{t('seasonPlan.bulkEdit.crop')}</label>
                <input style={inp} type="text" value={bulkCrop} onChange={e => setBulkCrop(e.target.value)} placeholder="Ej: Pera"/>
              </div>
              <div>
                <label style={{fontSize:'10px', color:'#888', display:'block', marginBottom:'3px'}}>{t('seasonPlan.bulkEdit.variety')}</label>
                <input style={inp} type="text" value={bulkVariety} onChange={e => setBulkVariety(e.target.value)} placeholder="Ej: Williams"/>
              </div>
              <div>
                <label style={{fontSize:'10px', color:'#888', display:'block', marginBottom:'3px'}}>{t('seasonPlan.columns.product')}</label>
                <select style={inp} value={bulkProduct} onChange={e => setBulkProduct(e.target.value)}>
                  <option value="">{t('seasonPlan.bulkEdit.noChange')}</option>
                  <option value="powder">MatriPowder</option>
                  <option value="tablets">MatriTablets</option>
                </select>
              </div>
              <button className="btn-secondary btn-sm" onClick={handleBulkApply}>
                {t('seasonPlan.bulkEdit.apply')}
              </button>
            </div>
          </div>
        )}

        {enriched.length === 0 ? (
          <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>
            {isArchived ? t('seasonPlan.emptyArchived') : t('seasonPlan.empty')}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>
            {t('seasonPlan.noFilterMatches')}
          </div>
        ) : (
          <div className="table-scroll"><table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{...cell, background:'#f5f5ee'}}>
                  <input type="checkbox" checked={allSelected} disabled={plannedIds.length === 0} onChange={toggleSelectAll}/>
                </th>
                {SEASON_PLAN_COLUMNS.map(c => (
                  <th key={c.header} style={{...cell, background:'#f5f5ee', fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase'}}>{c.header}</th>
                ))}
                <th style={{...cell, background:'#f5f5ee'}}></th>
              </tr>
              {showFilters && (
                <tr>
                  <th style={cell}></th>
                  {SEASON_PLAN_COLUMNS.map(c => (
                    <th key={c.header} style={{padding:'4px 8px'}}>
                      <input
                        value={filters[c.header] || ''}
                        onChange={e => setFilter(c.header, e.target.value)}
                        placeholder={t('common.filterPlaceholder')}
                        style={{width:'100%', padding:'5px 7px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'12px', fontWeight:400}}
                      />
                    </th>
                  ))}
                  <th style={cell}></th>
                </tr>
              )}
            </thead>
            <tbody>
              {filtered.map(l => {
                // Archived campaigns are read-only in the table regardless of
                // a line's own status — their only intended edit path is
                // re-uploading the Excel (see isArchived's definition above).
                const rowDisabled = l.status !== 'planned' || isArchived
                return (
                <tr key={l.id}>
                  <td style={cell}>
                    <input type="checkbox" disabled={rowDisabled}
                      checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)}/>
                  </td>
                  <td style={cell}>
                    <select style={inp} value={l.cold_room_id || ''} disabled={rowDisabled}
                      onChange={e => onUpdateLine(l.id, { cold_room_id: e.target.value })}>
                      <option value="" disabled>{t('seasonPlan.chooseRoom')}</option>
                      {coldRooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.volume_m3} m³)</option>)}
                    </select>
                  </td>
                  <td style={cell}>
                    <input style={inp} type="text" defaultValue={l.crop || l.room?.primary_crop || ''} disabled={rowDisabled}
                      onBlur={e => onUpdateLine(l.id, { crop: e.target.value || null })}/>
                  </td>
                  <td style={cell}>
                    <input style={inp} type="text" defaultValue={l.variety || ''} disabled={rowDisabled}
                      onBlur={e => onUpdateLine(l.id, { variety: e.target.value || null })}/>
                  </td>
                  <td style={{...cell, color:'#6b6b6b'}}>
                    {l.room?.volume_m3 != null ? `${l.room.volume_m3} m³` : '—'}
                  </td>
                  <td style={cell}>
                    <input style={inp} type="date" value={l.planned_date || ''} disabled={rowDisabled}
                      onChange={e => onUpdateLine(l.id, { planned_date: e.target.value || null })}/>
                  </td>
                  <td style={cell}>
                    <input style={inp} type="number" value={l.planned_dose_ppb ?? ''} disabled={rowDisabled}
                      onChange={e => onUpdateLine(l.id, { planned_dose_ppb: Number(e.target.value) || null })}/>
                  </td>
                  <td style={cell}>
                    <select style={inp} value={l.product_preference} disabled={rowDisabled}
                      onChange={e => onUpdateLine(l.id, { product_preference: e.target.value })}>
                      <option value="undecided">{t('seasonPlan.productUndecided')}</option>
                      <option value="powder">MatriPowder</option>
                      <option value="tablets">MatriTablets</option>
                    </select>
                  </td>
                  {!isPureOperator && (
                    <td style={{...cell, fontWeight:700, color:'#0b4358', whiteSpace:'nowrap'}}>
                      {l.cost != null ? fmtUSD(l.cost) : '—'}
                    </td>
                  )}
                  {!isPureOperator && (
                    <td style={{...cell, color:'#6b6b6b', whiteSpace:'nowrap'}}>
                      {(l.cost != null && l.room?.volume_m3) ? fmtUSD(l.cost / l.room.volume_m3) : '—'}
                    </td>
                  )}
                  <td style={cell}>
                    <input style={inp} type="text" defaultValue={l.notes || ''} disabled={rowDisabled}
                      onBlur={e => onUpdateLine(l.id, { notes: e.target.value || null })}/>
                  </td>
                  <td style={cell}>
                    <span className={`status ${l.status === 'converted' ? 'approved' : 'pending'}`}>
                      {l.status === 'converted' ? t('seasonPlan.status.convertedBadge') : t('seasonPlan.status.plannedBadge')}
                    </span>
                  </td>
                  <td style={cell}>
                    {l.status === 'planned' && !isArchived && (
                      <button className="btn-secondary btn-sm" onClick={() => onDeleteLine(l.id)}>✕</button>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table></div>
        )}
      </div>

      {pendingFile && (
        <div
          onClick={(e) => e.target === e.currentTarget && setPendingFile(null)}
          style={{position:'fixed', inset:0, background:'rgba(7,46,61,.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center'}}
        >
          <div style={{background:'#fff', borderRadius:'14px', padding:'28px', width:'100%', maxWidth:'440px', boxShadow:'0 8px 32px rgba(11,67,88,.2)'}}>
            <div style={{fontSize:'16px', fontWeight:800, color:'#0b4358', marginBottom:'10px'}}>
              {t('seasonPlan.replaceModal.title')}
            </div>
            <div style={{fontSize:'13px', color:'#555', lineHeight:1.5, marginBottom:'18px'}}>
              {t('seasonPlan.replaceModal.body')}
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
              <button className="btn-primary" onClick={() => resolvePendingImport(false)}>
                {t('seasonPlan.replaceModal.add')}
              </button>
              <button className="btn-secondary" onClick={() => resolvePendingImport(true)}>
                {t('seasonPlan.replaceModal.replace')}
              </button>
              <button className="btn-secondary" style={{background:'none', border:'none', color:'#888'}} onClick={() => setPendingFile(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {planModal && (
        <div
          onClick={(e) => e.target === e.currentTarget && setPlanModal(null)}
          style={{position:'fixed', inset:0, background:'rgba(7,46,61,.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'}}
        >
          <div style={{background:'#fff', borderRadius:'14px', padding:'28px', width:'100%', maxWidth:'440px', boxShadow:'0 8px 32px rgba(11,67,88,.2)'}}>
            <div style={{fontSize:'16px', fontWeight:800, color:'#0b4358', marginBottom:'10px'}}>
              {t(`seasonPlan.planModal.title.${planModal}`)}
            </div>
            <div style={{fontSize:'13px', color:'#555', lineHeight:1.5, marginBottom:'18px'}}>
              {t(`seasonPlan.planModal.body.${planModal}`)}
            </div>

            {planModal === 'basedOn' && (
              <div style={{marginBottom:'14px'}}>
                <label style={{fontSize:'10px', color:'#888', display:'block', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'.04em'}}>
                  {t('seasonPlan.planModal.sourceLabel')}
                </label>
                <select style={inp} value={newPlanSource} onChange={e => setNewPlanSource(e.target.value)}>
                  <option value="">{t('seasonPlan.planModal.sourcePlaceholder')}</option>
                  {archivedPlans.map(p => <option key={p.id} value={p.id}>{p.season_label}</option>)}
                </select>
              </div>
            )}

            <div style={{marginBottom:'20px'}}>
              <label style={{fontSize:'10px', color:'#888', display:'block', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'.04em'}}>
                {t('seasonPlan.planModal.labelLabel')}
              </label>
              <input style={inp} type="text" value={newPlanLabel} onChange={e => setNewPlanLabel(e.target.value)}
                placeholder={t(`seasonPlan.planModal.labelPlaceholder.${planModal}`)}/>
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
              <button className="btn-primary" disabled={creatingPlan || !newPlanLabel.trim() || (planModal === 'basedOn' && !newPlanSource)} onClick={confirmPlanModal}>
                {creatingPlan ? t('seasonPlan.planModal.creating') : t('seasonPlan.planModal.confirm')}
              </button>
              <button className="btn-secondary" style={{background:'none', border:'none', color:'#888'}} onClick={() => setPlanModal(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
