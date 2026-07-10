import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { fetchOrgPricing, fetchAllCustomerOverrides, fetchPouchCatalog, resolveProductPrice } from '../../lib/orgPricing'
import { POUCHES, DOSE_BASE, greedyCeiling, comboGrams, actualPpb, tabletCombo } from '../../lib/dosing'
import { exportToExcel, filterRows } from '../../lib/tableTools'

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

export default function SeasonPlanRollup() {
  const [lines, setLines] = useState([])
  const [orgById, setOrgById] = useState(new Map())
  const [overrideByCustomerId, setOverrideByCustomerId] = useState(new Map())
  const [pricing, setPricing] = useState({ brackets: [], product: [], serviceFee: [] })
  const [pouchSizes, setPouchSizes] = useState(POUCHES)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({})

  useEffect(() => {
    fetchOrgPricing().then(setPricing)
    fetchPouchCatalog().then(sizes => { if (sizes.length > 0) setPouchSizes(sizes) })
    Promise.all([
      supabase.from('organizations').select('*'),
      supabase.from('season_plan_lines').select('*, cold_rooms(name, volume_m3, primary_crop), season_plans(org_id, season_label)'),
      fetchAllCustomerOverrides(),
    ]).then(([{ data: orgs }, { data: planLines }, overrides]) => {
      setOrgById(new Map((orgs || []).map(o => [o.id, o])))
      setOverrideByCustomerId(new Map(overrides.map(o => [o.customer_org_id, o])))
      setLines(planLines || [])
      setLoading(false)
    })
  }, [])

  const enriched = useMemo(() => lines.map(l => {
    const customer = orgById.get(l.season_plans?.org_id)
    const parent = customer ? orgById.get(customer.parent_id) : null
    const override = customer ? overrideByCustomerId.get(customer.id) : null
    const cost = computeIndicativeCost(pricing, l.product_preference, l.planned_dose_ppb, l.cold_rooms?.volume_m3, override, pouchSizes)
    return { ...l, customer, parent, cost }
  }), [lines, orgById, overrideByCustomerId, pricing, pouchSizes])

  const totals = useMemo(() => {
    const uniqueCustomers = new Set(enriched.map(l => l.customer?.id).filter(Boolean))
    const totalM3 = enriched.reduce((s, l) => s + (l.cold_rooms?.volume_m3 || 0), 0)
    const totalCost = enriched.reduce((s, l) => s + (l.cost || 0), 0)
    return { customers: uniqueCustomers.size, applications: enriched.length, m3: totalM3, cost: totalCost }
  }, [enriched])

  const COLUMNS = [
    { header: 'Distribuidor / Sub-distribuidor', get: l => l.parent?.name || '' },
    { header: 'Cliente',           get: l => l.customer?.name || '' },
    { header: 'Cámara',            get: l => l.cold_rooms?.name || '' },
    { header: 'Cultivo',           get: l => l.cold_rooms?.primary_crop || '' },
    { header: 'Fecha estimada',    get: l => l.planned_date || '' },
    { header: 'Dosis (ppb)',       get: l => l.planned_dose_ppb ?? '' },
    { header: 'Producto',          get: l => PRODUCT_LABEL[l.product_preference] || l.product_preference },
    { header: 'Costo indicativo',  get: l => l.cost != null ? l.cost.toFixed(2) : '' },
    { header: 'Estado',            get: l => l.status === 'converted' ? 'Convertida' : 'Planificada' },
  ]

  const filtered = filterRows(enriched, COLUMNS, filters)
  const setFilter = (header, value) => setFilters(prev => ({ ...prev, [header]: value }))

  if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>Cargando...</div>

  return (
    <div>
      <div className="alert info" style={{marginBottom:'16px'}}>
        📋 Todo lo que tus clientes (y los de tus sub-distribuidores) planificaron para la temporada — pensado para ver dónde está el potencial de negocio. Es de solo lectura: cada cliente edita su propio plan.
      </div>

      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'16px'}}>
        {[
          ['Clientes con plan cargado', totals.customers],
          ['Total aplicaciones', totals.applications],
          ['Total m³', totals.m3.toLocaleString('es-AR')],
          ['Costo potencial total', fmtUSD(totals.cost)],
        ].map(([label, value]) => (
          <div key={label} style={{background:'#0b4358', borderRadius:'12px', padding:'14px', textAlign:'center'}}>
            <div style={{fontSize:'10px', color:'rgba(255,255,255,.6)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:'4px'}}>{label}</div>
            <div style={{fontSize:'18px', fontWeight:800, color:'#fff'}}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Plan de temporada — toda tu red</span>
          <div style={{display:'flex', gap:'8px'}}>
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
                      <input
                        value={filters[c.header] || ''}
                        onChange={e => setFilter(c.header, e.target.value)}
                        placeholder="Filtrar..."
                        style={{width:'100%', padding:'5px 7px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'12px', fontWeight:400}}
                      />
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
                  <td style={{padding:'12px 16px', color:'#6b6b6b'}}>{l.planned_date || '—'}</td>
                  <td style={{padding:'12px 16px'}}>{l.planned_dose_ppb ?? '—'}</td>
                  <td style={{padding:'12px 16px'}}>{PRODUCT_LABEL[l.product_preference] || l.product_preference}</td>
                  <td style={{padding:'12px 16px', fontWeight:700, color:'#0b4358'}}>{l.cost != null ? fmtUSD(l.cost) : '—'}</td>
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
