import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { fetchOrgPricing, fetchPricingOwnersForOrgs, pricingForOwner, fetchAllCustomerOverrides, fetchPouchCatalog, resolveProductPrice } from '../../lib/orgPricing'
import { POUCHES, DOSE_BASE, greedyCeiling, comboGrams, actualPpb, tabletCombo } from '../../lib/dosing'
import { exportToExcel, filterRows } from '../../lib/tableTools'
import SeasonPlanDraftModal from './SeasonPlanDraftModal'
import CampaignCostSimulator from './CampaignCostSimulator'

// Fase L-2 (2026-08-11): these 4 columns get a dropdown of real values
// instead of free text — Juan's ask, since a Distributor with many
// Customers/Cámaras can't easily guess what to type. Options are cascading:
// each dropdown only offers values still reachable given every OTHER
// currently active filter, same spirit as the Calculator's Cliente→Cámara
// picker shipped just before this.
const DROPDOWN_FILTER_HEADERS = ['Distribuidor / Sub-distribuidor', 'Cliente', 'Cámara', 'Cultivo']

function fmtUSD(v) { return '$' + Number(v || 0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2}) }
function fmtNumM3(v) { return Number(v || 0).toLocaleString('es-AR', {maximumFractionDigits:0}) }

// Same "indicative cost" math as the Customer's own Season Plan/Calculator —
// one shared Distributor currency across the whole subtree (Rule: currency
// is set once at Distributor level), so one pricing fetch covers every row.
// `override` is that specific line's Customer's own negotiated price, if any
// (DOMAIN_MODEL.md Rule 36) — different customers in this rollup can each
// have a different override, unlike the single-customer Calculator/Season Plan.
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

const PRODUCT_LABEL = { powder: 'MatriPowder', tablets: 'MatriTablets', undecided: 'Sin decidir' }

// Pure functions of a row — hoisted to module scope (same convention as
// every other filterRows-based table in this app, e.g. SeasonPlan.jsx's
// SEASON_PLAN_COLUMNS) rather than redefined every render inside the
// component, which is what the previous in-component version amounted to.
// `financial: true` entries get dropped for a pure Operador (role-visibility
// backlog item, 2026-08-25) — filtered into the per-render `COLUMNS` below,
// since that's the one thing here that genuinely varies per viewer.
const COLUMNS_ALL = [
  { header: 'Distribuidor / Sub-distribuidor', get: l => l.parent?.name || '' },
  { header: 'Cliente',           get: l => l.customer?.name || '' },
  { header: 'Cámara',            get: l => l.cold_rooms?.name || '' },
  // `l.crop`/`l.variety` are the snapshot taken when the line was created
  // (migration 0036); the room fallback only matters for lines that predate
  // the snapshot.
  { header: 'Cultivo',           get: l => l.crop || l.cold_rooms?.primary_crop || '' },
  { header: 'Variedad',          get: l => l.variety || '' },
  { header: 'Volumen (m³)',      get: l => l.cold_rooms?.volume_m3 ?? '' },
  { header: 'Fecha estimada',    get: l => l.planned_date || '' },
  { header: 'Dosis (ppb)',       get: l => l.planned_dose_ppb ?? '' },
  { header: 'Producto',          get: l => PRODUCT_LABEL[l.product_preference] || l.product_preference },
  { header: 'Costo (producto)',  get: l => l.cost != null ? l.cost.toFixed(2) : '', financial: true },
  { header: '$/m³ (producto)',   get: l => (l.cost != null && l.cold_rooms?.volume_m3) ? (l.cost / l.cold_rooms.volume_m3).toFixed(2) : '', financial: true },
  { header: 'Estado',            get: l => l.status === 'converted' ? 'Convertida' : 'Planificada' },
]

export default function SeasonPlanRollup({ onNavigate, myRoles = [] }) {
  // Role-visibility backlog item (flagged 2026-08-11, scoped and built
  // 2026-08-25) — a "pure" Operador (has the role but not Owner/Aprobador
  // too) shouldn't see cost/price figures here. Someone who holds Operador
  // *alongside* Owner/Aprobador still sees everything, same as today.
  const isPureOperator = myRoles.includes('operator') && !myRoles.includes('owner') && !myRoles.includes('approver')
  const COLUMNS = useMemo(() => COLUMNS_ALL.filter(c => !c.financial || !isPureOperator), [isPureOperator])
  const [lines, setLines] = useState([])
  const [orgById, setOrgById] = useState(new Map())
  const [overrideByCustomerId, setOverrideByCustomerId] = useState(new Map())
  const [pricing, setPricing] = useState({ brackets: [], product: [], serviceFee: [] }) // raw, unfiltered — see pricingOwnerByCustomerId
  const [pricingOwnerByCustomerId, setPricingOwnerByCustomerId] = useState(new Map())
  const [pouchSizes, setPouchSizes] = useState(POUCHES)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({})
  const [allRooms, setAllRooms] = useState([])
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [pickedCustomerId, setPickedCustomerId] = useState('')
  const [draftCustomer, setDraftCustomer] = useState(null) // { id, name } | null
  // Fase (2026-08-26, Juan) — the Simulador no longer requires pre-filtering
  // down to exactly one Customer: clicking it opens a picker (any number of
  // Customers, or all) that also doubles as the per-Customer summary
  // ("Resumen por cliente") view, then "Continuar a simulación" feeds the
  // union of their lines into the existing CampaignCostSimulator.
  const [showSimulatorPicker, setShowSimulatorPicker] = useState(false)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState(new Set())
  const [showSimulator, setShowSimulator] = useState(false)

  // Re-fetchable on its own — called again after a Distributor-authored
  // draft gets shared (see SeasonPlanDraftModal's onShared), since sharing
  // writes new season_plan_lines that this rollup would otherwise never
  // find out about until a full page reload.
  // Only the ACTIVE campaign per Customer feeds this rollup — an archived
  // historical upload must never double-count m³/cost alongside the real
  // campaign in progress (migration 0036). `!inner` + the .eq below is the
  // PostgREST way to filter on an embedded table.
  const reloadLines = async () => {
    const [{ data: planLines }, overrides] = await Promise.all([
      supabase.from('season_plan_lines').select('*, cold_rooms(name, volume_m3, primary_crop), season_plans!inner(org_id, season_label, status)').eq('season_plans.status', 'active'),
      fetchAllCustomerOverrides(),
    ])
    setOverrideByCustomerId(new Map(overrides.map(o => [o.customer_org_id, o])))
    setLines(planLines || [])
    const customerIds = (planLines || []).map(l => l.season_plans?.org_id)
    setPricingOwnerByCustomerId(await fetchPricingOwnersForOrgs(customerIds))
  }

  useEffect(() => {
    // Raw/unfiltered — this rollup prices many different Customers at once,
    // each possibly against a different nearest ancestor with its own price
    // list (Fase H, 2026-07-16), so it can't resolve a single owner up front
    // the way Calculator/SeasonPlan do. Narrowed per-line via pricingForOwner
    // below, once we know each line's actual Customer.
    fetchOrgPricing().then(setPricing)
    fetchPouchCatalog().then(sizes => { if (sizes.length > 0) setPouchSizes(sizes) })
    Promise.all([
      supabase.from('organizations').select('*'),
      supabase.from('cold_rooms').select('*'),
      supabase.from('season_plan_lines').select('*, cold_rooms(name, volume_m3, primary_crop), season_plans!inner(org_id, season_label, status)').eq('season_plans.status', 'active'),
      fetchAllCustomerOverrides(),
    ]).then(async ([{ data: orgs }, { data: rooms }, { data: planLines }, overrides]) => {
      setOrgById(new Map((orgs || []).map(o => [o.id, o])))
      setAllRooms(rooms || [])
      setOverrideByCustomerId(new Map(overrides.map(o => [o.customer_org_id, o])))
      setLines(planLines || [])
      const customerIds = (planLines || []).map(l => l.season_plans?.org_id)
      setPricingOwnerByCustomerId(await fetchPricingOwnersForOrgs(customerIds))
      setLoading(false)
    })
  }, [])

  const customers = useMemo(
    () => [...orgById.values()].filter(o => o.org_type === 'customer').sort((a, b) => a.name.localeCompare(b.name)),
    [orgById]
  )
  const roomsForDraft = useMemo(
    () => draftCustomer ? allRooms.filter(r => r.org_id === draftCustomer.id) : [],
    [allRooms, draftCustomer]
  )

  const openDraftPicker = () => { setPickedCustomerId(''); setShowCustomerPicker(true) }
  const confirmDraftCustomer = () => {
    const customer = customers.find(c => c.id === pickedCustomerId)
    if (!customer) return
    setDraftCustomer(customer)
    setShowCustomerPicker(false)
  }

  const enriched = useMemo(() => lines.map(l => {
    const customer = orgById.get(l.season_plans?.org_id)
    const parent = customer ? orgById.get(customer.parent_id) : null
    const override = customer ? overrideByCustomerId.get(customer.id) : null
    // Each Customer resolves against its OWN nearest pricing owner — never
    // assume every line in this rollup shares the same list (Fase H).
    const linePricing = pricingForOwner(pricing, customer ? pricingOwnerByCustomerId.get(customer.id) : null)
    const cost = computeIndicativeCost(linePricing, l.product_preference, l.planned_dose_ppb, l.cold_rooms?.volume_m3, override, pouchSizes)
    return { ...l, customer, parent, cost }
  }), [lines, orgById, overrideByCustomerId, pricing, pricingOwnerByCustomerId, pouchSizes])

  const filtered = filterRows(enriched, COLUMNS, filters)
  const setFilter = (header, value) => setFilters(prev => ({ ...prev, [header]: value }))

  // Cascading dropdown options: whatever this column's real values still are
  // once every OTHER active filter is applied (not this one, so picking a
  // value never traps you with an empty list you can't get out of).
  const dropdownOptions = (header) => {
    const col = COLUMNS.find(c => c.header === header)
    const rowsForOptions = filterRows(enriched, COLUMNS, { ...filters, [header]: '' })
    const values = new Set(rowsForOptions.map(r => col.get(r)).filter(v => v !== '' && v != null))
    return [...values].sort((a, b) => String(a).localeCompare(String(b)))
  }

  // Fase L-2 (2026-08-11) → reworked 2026-08-26 (Juan): the Simulador used
  // to only work once filters narrowed the table to exactly one Customer.
  // Now it opens a picker instead — any number of Customers, or all of the
  // ones currently visible under the active Distribuidor/Cultivo filters.
  // candidateCustomers is that pickable list; summaryByCustomer is the same
  // data shaped as the "Resumen por cliente" table (N° Cámaras/Volumen/
  // Facturación/$/m³ promedio), sorted highest-Facturación-first so the
  // biggest accounts surface first, same spirit as the intro banner's "ver
  // dónde está el potencial de negocio".
  const candidateCustomers = useMemo(() => {
    const ids = new Set(filtered.map(l => l.customer?.id).filter(Boolean))
    return [...ids].map(id => orgById.get(id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  }, [filtered, orgById])

  const summaryByCustomer = useMemo(() => {
    const map = new Map()
    filtered.forEach(l => {
      const custId = l.customer?.id
      if (!custId) return
      if (!map.has(custId)) map.set(custId, { customer: l.customer, parent: l.parent, roomIds: new Set(), m3: 0, cost: 0 })
      const entry = map.get(custId)
      // cold_room_id is season_plan_lines' own native column — cold_rooms(...)
      // is only ever selected as {name, volume_m3, primary_crop}, no id, so
      // that embedded object can never be used as the distinct-room key.
      if (l.cold_room_id) entry.roomIds.add(l.cold_room_id)
      entry.m3 += l.cold_rooms?.volume_m3 || 0
      entry.cost += l.cost || 0
    })
    return [...map.values()]
      .map(e => ({ ...e, roomCount: e.roomIds.size, avgPerM3: e.m3 > 0 ? e.cost / e.m3 : 0 }))
      .sort((a, b) => b.cost - a.cost)
  }, [filtered])

  const openSimulatorPicker = () => { setSelectedCustomerIds(new Set()); setShowSimulatorPicker(true) }
  const toggleSimulatorCustomer = (id) => setSelectedCustomerIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const allSimulatorSelected = candidateCustomers.length > 0 && candidateCustomers.every(c => selectedCustomerIds.has(c.id))
  const toggleSelectAllSimulator = () => setSelectedCustomerIds(allSimulatorSelected ? new Set() : new Set(candidateCustomers.map(c => c.id)))
  const startSimulation = () => { setShowSimulatorPicker(false); setShowSimulator(true) }

  // Each line carries its OWN already-resolved pricing/override — a
  // simulation spanning several Customers can't assume they all share one
  // (CampaignCostSimulator.jsx reads `_pricing`/`_override` off the line
  // itself when present). The shared `pricing`/`override` props it also
  // takes (used only for the generator-purchase ROI card) come from
  // whichever Customer was selected first — an approximation, documented
  // in that component.
  const simulatorLines = useMemo(() => filtered
    .filter(l => selectedCustomerIds.has(l.customer?.id))
    .map(l => ({
      ...l,
      room: l.cold_rooms,
      _pricing: pricingForOwner(pricing, pricingOwnerByCustomerId.get(l.customer.id)),
      _override: overrideByCustomerId.get(l.customer.id) ?? null,
    })), [filtered, selectedCustomerIds, pricing, pricingOwnerByCustomerId, overrideByCustomerId])

  const firstSelectedId = [...selectedCustomerIds][0]
  const simulatorPricing = firstSelectedId ? pricingForOwner(pricing, pricingOwnerByCustomerId.get(firstSelectedId)) : pricing
  const simulatorOverride = firstSelectedId ? (overrideByCustomerId.get(firstSelectedId) ?? null) : null

  const totals = useMemo(() => {
    const uniqueCustomers = new Set(filtered.map(l => l.customer?.id).filter(Boolean))
    const totalM3 = filtered.reduce((s, l) => s + (l.cold_rooms?.volume_m3 || 0), 0)
    const totalCost = filtered.reduce((s, l) => s + (l.cost || 0), 0)
    return {
      customers: uniqueCustomers.size,
      applications: filtered.length,
      m3: totalM3,
      cost: totalCost,
      avgPerM3: totalM3 > 0 ? totalCost / totalM3 : 0,
    }
  }, [filtered])

  if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>Cargando...</div>

  return (
    <div>
      {draftCustomer && (
        <SeasonPlanDraftModal customerOrg={draftCustomer} rooms={roomsForDraft} onClose={() => setDraftCustomer(null)} onShared={reloadLines} />
      )}

      {!isPureOperator && showSimulator && simulatorLines.length > 0 && (
        <CampaignCostSimulator
          lines={simulatorLines}
          pricing={simulatorPricing}
          override={simulatorOverride}
          pouchSizes={pouchSizes}
          onClose={() => setShowSimulator(false)}
          onNavigate={onNavigate}
        />
      )}

      <div className="alert info" style={{marginBottom:'16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap'}}>
        <span>📋 Todo lo que tus clientes (y los de tus sub-distribuidores) planificaron para la temporada — pensado para ver dónde está el potencial de negocio. Cada cliente edita su propio plan; vos podés armarle un borrador si todavía no cargó nada.</span>
        <button className="btn-secondary btn-sm" style={{whiteSpace:'nowrap'}} onClick={openDraftPicker}>+ Crear borrador para un cliente</button>
      </div>

      {showCustomerPicker && (
        <div onClick={(e) => e.target === e.currentTarget && setShowCustomerPicker(false)} style={{position:'fixed', inset:0, background:'rgba(7,46,61,.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'}}>
          <div style={{background:'#fff', borderRadius:'14px', padding:'24px', width:'100%', maxWidth:'380px', boxShadow:'0 8px 32px rgba(11,67,88,.2)'}}>
            <div style={{fontSize:'15px', fontWeight:800, color:'#0b4358', marginBottom:'14px'}}>¿Para qué cliente?</div>
            <select value={pickedCustomerId} onChange={e => setPickedCustomerId(e.target.value)}
              style={{width:'100%', padding:'9px 12px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px', marginBottom:'16px'}}>
              <option value="">Elegir cliente…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{display:'flex', gap:'8px'}}>
              <button className="btn-primary" disabled={!pickedCustomerId} onClick={confirmDraftCustomer} style={{flex:1}}>Crear borrador</button>
              <button className="btn-secondary" onClick={() => setShowCustomerPicker(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Simulador picker (2026-08-26) — doubles as "Resumen por cliente":
          checkbox per Customer, live summary table, then "Continuar" feeds
          the union of selected Customers' lines into CampaignCostSimulator. */}
      {showSimulatorPicker && (
        <div onClick={(e) => e.target === e.currentTarget && setShowSimulatorPicker(false)} style={{position:'fixed', inset:0, background:'rgba(7,46,61,.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'30px 20px', overflowY:'auto'}}>
          <div style={{background:'#fff', borderRadius:'14px', padding:'26px', width:'100%', maxWidth:'820px', boxShadow:'0 8px 32px rgba(11,67,88,.2)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px'}}>
              <div style={{fontSize:'17px', fontWeight:800, color:'#0b4358'}}>🧮 Simulador — elegí cliente(s)</div>
              <button onClick={() => setShowSimulatorPicker(false)} style={{background:'none', border:'none', fontSize:'20px', color:'#888', cursor:'pointer', lineHeight:1}}>✕</button>
            </div>
            <div style={{fontSize:'12px', color:'#888', marginBottom:'16px'}}>
              Elegí uno, varios, o "Seleccionar todos" — la tabla de abajo se actualiza con lo que vayas tildando.
            </div>

            {candidateCustomers.length === 0 ? (
              <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>
                Ningún cliente coincide con los filtros actuales.
              </div>
            ) : (
              <div className="table-scroll" style={{marginBottom:'16px'}}><table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
                <thead>
                  <tr>
                    <th style={{padding:'8px 12px', background:'#f5f5ee', borderBottom:'0.5px solid #ddddd5'}}>
                      <input type="checkbox" checked={allSimulatorSelected} onChange={toggleSelectAllSimulator}/>
                    </th>
                    {['Cliente', 'Distribuidor / Sub-distribuidor', 'N° Cámaras', 'Volumen (m³)', 'Facturación (producto)', '$/m³ promedio (producto)'].map(h => (
                      <th key={h} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'8px 12px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaryByCustomer.map(row => (
                    <tr key={row.customer.id} style={{borderBottom:'0.5px solid #ddddd5', cursor:'pointer'}} onClick={() => toggleSimulatorCustomer(row.customer.id)}>
                      <td style={{padding:'8px 12px'}} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedCustomerIds.has(row.customer.id)} onChange={() => toggleSimulatorCustomer(row.customer.id)}/>
                      </td>
                      <td style={{padding:'8px 12px', fontWeight:600}}>{row.customer.name}</td>
                      <td style={{padding:'8px 12px', color:'#6b6b6b'}}>{row.parent?.name || '—'}</td>
                      <td style={{padding:'8px 12px'}}>{row.roomCount}</td>
                      <td style={{padding:'8px 12px'}}>{fmtNumM3(row.m3)}</td>
                      <td style={{padding:'8px 12px', fontWeight:700, color:'#0b4358'}}>{fmtUSD(row.cost)}</td>
                      <td style={{padding:'8px 12px', color:'#6b6b6b'}}>{fmtUSD(row.avgPerM3)}</td>
                    </tr>
                  ))}
                </tbody>
                {selectedCustomerIds.size > 1 && (() => {
                  const sel = summaryByCustomer.filter(r => selectedCustomerIds.has(r.customer.id))
                  const totM3 = sel.reduce((s, r) => s + r.m3, 0)
                  const totCost = sel.reduce((s, r) => s + r.cost, 0)
                  const totRooms = sel.reduce((s, r) => s + r.roomCount, 0)
                  return (
                    <tfoot>
                      <tr style={{background:'#f0f7ff'}}>
                        <td></td>
                        <td style={{padding:'8px 12px', fontWeight:800, color:'#0b4358'}} colSpan={2}>Total combinado ({sel.length} clientes)</td>
                        <td style={{padding:'8px 12px', fontWeight:800}}>{totRooms}</td>
                        <td style={{padding:'8px 12px', fontWeight:800}}>{fmtNumM3(totM3)}</td>
                        <td style={{padding:'8px 12px', fontWeight:800, color:'#0b4358'}}>{fmtUSD(totCost)}</td>
                        <td style={{padding:'8px 12px', fontWeight:800}}>{fmtUSD(totM3 > 0 ? totCost / totM3 : 0)}</td>
                      </tr>
                    </tfoot>
                  )
                })()}
              </table></div>
            )}

            <div style={{display:'flex', gap:'10px'}}>
              <button className="btn-primary" disabled={selectedCustomerIds.size === 0} style={{opacity: selectedCustomerIds.size === 0 ? .5 : 1}} onClick={startSimulation}>
                Continuar a simulación {selectedCustomerIds.size > 0 ? `(${selectedCustomerIds.size})` : ''}
              </button>
              <button className="btn-secondary" onClick={() => setShowSimulatorPicker(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:`repeat(${isPureOperator ? 3 : 5},1fr)`, gap:'14px', marginBottom:'16px'}}>
        {[
          ['Clientes con plan cargado', totals.customers],
          ['Total aplicaciones', totals.applications],
          ['Total m³', totals.m3.toLocaleString('es-AR')],
          ...(isPureOperator ? [] : [
            ['Costo potencial total (producto)', fmtUSD(totals.cost)],
            ['Costo prom. $/m³ (producto)', fmtUSD(totals.avgPerM3)],
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
          Los valores de costo son del producto únicamente — no incluyen el servicio de aplicación opcional.
        </div>
      )}

      <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Plan de temporada — toda tu red</span>
          <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
            {!isPureOperator && (
              <button className="btn-lime btn-sm" onClick={openSimulatorPicker}>
                🧮 Simulador
              </button>
            )}
            <button className="btn-secondary btn-sm" onClick={() => setShowFilters(!showFilters)}>{showFilters ? '✕ Filtros' : 'Filtrar'}</button>
            <button className="btn-secondary btn-sm" onClick={() => exportToExcel('plan_de_temporada_consolidado.xlsx', COLUMNS, filtered)}>⬇ Exportar a Excel</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
            {enriched.length === 0 ? 'Todavía ningún cliente cargó su Plan de Temporada.' : 'Ninguna línea coincide con los filtros aplicados.'}
          </div>
        ) : (
          <div className="table-scroll"><table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
            <thead>
              <tr>
                {COLUMNS.map(c => (
                  <th key={c.header} style={{fontSize:'11px', fontWeight:700, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'.06em', padding:'10px 16px', textAlign:'left', borderBottom:'0.5px solid #ddddd5', background:'#f5f5ee'}}>{c.header}</th>
                ))}
              </tr>
              {showFilters && (
                <tr>
                  {COLUMNS.map(c => (
                    <th key={c.header} style={{padding:'4px 8px'}}>
                      {DROPDOWN_FILTER_HEADERS.includes(c.header) ? (
                        <select
                          value={filters[c.header] || ''}
                          onChange={e => setFilter(c.header, e.target.value)}
                          style={{width:'100%', padding:'5px 7px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'12px', fontWeight:400}}
                        >
                          <option value="">Todos</option>
                          {dropdownOptions(c.header).map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : (
                        <input
                          value={filters[c.header] || ''}
                          onChange={e => setFilter(c.header, e.target.value)}
                          placeholder="Filtrar..."
                          style={{width:'100%', padding:'5px 7px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'12px', fontWeight:400}}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} style={{borderBottom:'0.5px solid #ddddd5'}}>
                  <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{l.parent?.name || '—'}</td>
                  <td style={{padding:'12px 16px', fontWeight:600}}>{l.customer?.name || '—'}</td>
                  <td style={{padding:'12px 16px'}}>{l.cold_rooms?.name || '—'}</td>
                  <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{l.crop || l.cold_rooms?.primary_crop || '—'}</td>
                  <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{l.variety || '—'}</td>
                  <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{l.cold_rooms?.volume_m3 != null ? `${l.cold_rooms.volume_m3} m³` : '—'}</td>
                  <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{l.planned_date || '—'}</td>
                  <td style={{padding:'12px 16px'}}>{l.planned_dose_ppb ?? '—'}</td>
                  <td style={{padding:'12px 16px'}}>{PRODUCT_LABEL[l.product_preference] || l.product_preference}</td>
                  {!isPureOperator && <td style={{padding:'12px 16px', fontWeight:700, color:'#0b4358'}}>{l.cost != null ? fmtUSD(l.cost) : '—'}</td>}
                  {!isPureOperator && <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{(l.cost != null && l.cold_rooms?.volume_m3) ? fmtUSD(l.cost / l.cold_rooms.volume_m3) : '—'}</td>}
                  <td style={{padding:'12px 16px'}}>
                    <span className={`status ${l.status === 'converted' ? 'approved' : 'pending'}`}>
                      {l.status === 'converted' ? '✓ Convertida' : '⏳ Planificada'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  )
}
