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
  { header: 'Cultivo',           get: l => l.cold_rooms?.primary_crop || '' },
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
  const [showSimulator, setShowSimulator] = useState(false)

  // Re-fetchable on its own — called again after a Distributor-authored
  // draft gets shared (see SeasonPlanDraftModal's onShared), since sharing
  // writes new season_plan_lines that this rollup would otherwise never
  // find out about until a full page reload.
  const reloadLines = async () => {
    const [{ data: planLines }, overrides] = await Promise.all([
      supabase.from('season_plan_lines').select('*, cold_rooms(name, volume_m3, primary_crop), season_plans(org_id, season_label)'),
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
      supabase.from('season_plan_lines').select('*, cold_rooms(name, volume_m3, primary_crop), season_plans(org_id, season_label)'),
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

  // Fase L-2: the Campaign Cost Simulator prices one Customer at a time
  // (same as it already does on that Customer's own Season Plan) — only
  // makes sense once the current filters narrow the table down to exactly
  // one. Reuses the exact per-Customer pricing already resolved for `cost`
  // above, and reshapes `cold_rooms` → `room` to match what the simulator
  // (built for the single-Customer Season Plan) actually expects.
  const filteredCustomerIds = [...new Set(filtered.map(l => l.customer?.id).filter(Boolean))]
  const simulatorCustomer = filteredCustomerIds.length === 1 ? orgById.get(filteredCustomerIds[0]) : null
  const simulatorPricing = simulatorCustomer ? pricingForOwner(pricing, pricingOwnerByCustomerId.get(simulatorCustomer.id)) : null
  const simulatorOverride = simulatorCustomer ? overrideByCustomerId.get(simulatorCustomer.id) : null

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

      {!isPureOperator && showSimulator && simulatorCustomer && (
        <CampaignCostSimulator
          lines={filtered.map(l => ({ ...l, room: l.cold_rooms }))}
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
            {!isPureOperator && !simulatorCustomer && (
              <span style={{fontSize:'11px', color:'#888'}}>Filtrá por un Cliente para simular su costo</span>
            )}
            {!isPureOperator && (
              <button className="btn-lime btn-sm" disabled={!simulatorCustomer} style={{opacity: simulatorCustomer ? 1 : .5}} onClick={() => setShowSimulator(true)}>
                🧮 Simulador{simulatorCustomer ? ` — ${simulatorCustomer.name}` : ''}
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
                  <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{l.cold_rooms?.primary_crop || '—'}</td>
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
