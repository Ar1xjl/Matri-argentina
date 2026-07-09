import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { fetchOrgPricing, fetchCustomerOverride } from '../../lib/orgPricing'

function fmtUSD(v) { return '$' + Number(v || 0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2}) }

const emptyForm = {
  powder_price_override: '', tablets_price_override: '', service_fee_override: '',
  powder_discount_pct: '0', tablets_discount_pct: '0', service_fee_discount_pct: '0',
  minimum_commitment_m3: '', notes: '',
}

export default function CustomerPricingModal({ customer, profile, onClose }) {
  const [pricing, setPricing] = useState({ brackets: [], product: [], serviceFee: [] })
  const [form, setForm] = useState(emptyForm)
  const [stats, setStats] = useState({ planM3: 0, appliedM3: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetchOrgPricing(),
      fetchCustomerOverride(customer.id),
      supabase.from('season_plans').select('id').eq('org_id', customer.id).maybeSingle(),
      supabase.from('treatments').select('cold_rooms(volume_m3)').eq('org_id', customer.id).in('status', ['applied', 'completed']),
    ]).then(async ([pricingData, override, { data: plan }, { data: appliedTreatments }]) => {
      setPricing(pricingData)
      if (override) {
        setForm({
          powder_price_override: override.powder_price_override ?? '',
          tablets_price_override: override.tablets_price_override ?? '',
          service_fee_override: override.service_fee_override ?? '',
          powder_discount_pct: String(override.powder_discount_pct ?? 0),
          tablets_discount_pct: String(override.tablets_discount_pct ?? 0),
          service_fee_discount_pct: String(override.service_fee_discount_pct ?? 0),
          minimum_commitment_m3: override.minimum_commitment_m3 ?? '',
          notes: override.notes || '',
        })
      }
      let planM3 = 0
      if (plan) {
        const { data: planLines } = await supabase.from('season_plan_lines').select('cold_rooms(volume_m3)').eq('season_plan_id', plan.id)
        planM3 = (planLines || []).reduce((s, l) => s + (l.cold_rooms?.volume_m3 || 0), 0)
      }
      const appliedM3 = (appliedTreatments || []).reduce((s, t) => s + (t.cold_rooms?.volume_m3 || 0), 0)
      setStats({ planM3, appliedM3 })
      setLoading(false)
    })
  }, [customer.id])

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const num = (v) => (v === '' || v == null ? null : Number(v))
    const payload = {
      customer_org_id: customer.id,
      powder_price_override: num(form.powder_price_override),
      tablets_price_override: num(form.tablets_price_override),
      service_fee_override: num(form.service_fee_override),
      powder_discount_pct: Number(form.powder_discount_pct) || 0,
      tablets_discount_pct: Number(form.tablets_discount_pct) || 0,
      service_fee_discount_pct: Number(form.service_fee_discount_pct) || 0,
      minimum_commitment_m3: num(form.minimum_commitment_m3),
      notes: form.notes.trim() || null,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('customer_pricing_overrides').upsert(payload, { onConflict: 'customer_org_id' })
    setSaving(false)
    if (error) { setError(error.message); return }
    onClose()
  }

  const inputStyle = { width:'100%', padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'13px' }
  const labelStyle = { fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase' }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{position:'fixed', inset:0, background:'rgba(7,46,61,.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'}}
    >
      <div style={{background:'#fff', borderRadius:'14px', padding:'28px', width:'100%', maxWidth:'620px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(11,67,88,.2)'}}>
        <div style={{fontSize:'16px', fontWeight:800, color:'#0b4358', marginBottom:'4px'}}>
          Precio pactado — {customer.name}
        </div>
        <div style={{fontSize:'12px', color:'#888', marginBottom:'18px'}}>
          Un precio fijo por SKU reemplaza toda la tabla estándar. Si no cargás uno, se aplica el % de descuento (si tiene). Si no cargás nada, paga precio de lista.
        </div>

        {loading ? (
          <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>Cargando…</div>
        ) : (
          <>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'16px'}}>
              {[
                ['Comprometido (m³)', form.minimum_commitment_m3 || '—'],
                ['En Plan de Temporada (m³)', stats.planM3.toLocaleString('es-AR')],
                ['Aplicado real (m³)', stats.appliedM3.toLocaleString('es-AR')],
              ].map(([label, value]) => (
                <div key={label} style={{background:'#f5f5ee', borderRadius:'8px', padding:'10px', textAlign:'center'}}>
                  <div style={{fontSize:'9px', color:'#888', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:'3px'}}>{label}</div>
                  <div style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>{value ?? '—'}</div>
                </div>
              ))}
            </div>

            <div style={{background:'#f5f5ee', borderRadius:'8px', padding:'10px 12px', marginBottom:'16px'}}>
              <div style={{fontSize:'11px', fontWeight:700, color:'#0b4358', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.04em'}}>Precio de lista actual (referencia)</div>
              <table style={{width:'100%', fontSize:'12px', borderCollapse:'collapse'}}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left', color:'#888', fontWeight:600, paddingBottom:'4px'}}>Bracket</th>
                    <th style={{textAlign:'right', color:'#888', fontWeight:600, paddingBottom:'4px'}}>Powder $/m³</th>
                    <th style={{textAlign:'right', color:'#888', fontWeight:600, paddingBottom:'4px'}}>Tablets $/m³</th>
                    <th style={{textAlign:'right', color:'#888', fontWeight:600, paddingBottom:'4px'}}>Service fee</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.brackets.map(b => (
                    <tr key={b.code}>
                      <td style={{color:'#0b4358'}}>{b.code} ({b.min_m3}–{b.max_m3 ?? '+'} m³)</td>
                      <td style={{textAlign:'right'}}>{fmtUSD(pricing.product.find(p => p.sku === 'MatriPowder' && p.bracket === b.code)?.price)}</td>
                      <td style={{textAlign:'right'}}>{fmtUSD(pricing.product.find(p => p.sku === 'MatriTablets' && p.bracket === b.code)?.price)}</td>
                      <td style={{textAlign:'right'}}>{fmtUSD(pricing.serviceFee.find(f => f.bracket === b.code)?.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358', marginBottom:'8px'}}>MatriPowder</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px'}}>
              <div>
                <label style={labelStyle}>Precio fijo pactado ($/m³)</label>
                <input type="number" step="0.01" style={inputStyle} value={form.powder_price_override} onChange={e => setField('powder_price_override', e.target.value)} placeholder="Vacío = sin override"/>
              </div>
              <div>
                <label style={labelStyle}>% descuento (si no hay fijo)</label>
                <input type="number" step="1" style={inputStyle} value={form.powder_discount_pct} onChange={e => setField('powder_discount_pct', e.target.value)}/>
              </div>
            </div>

            <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358', marginBottom:'8px'}}>MatriTablets</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px'}}>
              <div>
                <label style={labelStyle}>Precio fijo pactado ($/m³)</label>
                <input type="number" step="0.01" style={inputStyle} value={form.tablets_price_override} onChange={e => setField('tablets_price_override', e.target.value)} placeholder="Vacío = sin override"/>
              </div>
              <div>
                <label style={labelStyle}>% descuento (si no hay fijo)</label>
                <input type="number" step="1" style={inputStyle} value={form.tablets_discount_pct} onChange={e => setField('tablets_discount_pct', e.target.value)}/>
              </div>
            </div>

            <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358', marginBottom:'8px'}}>Service fee (aplicación de Powder)</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px'}}>
              <div>
                <label style={labelStyle}>Monto fijo (0 = bonificado/gratis)</label>
                <input type="number" step="0.01" style={inputStyle} value={form.service_fee_override} onChange={e => setField('service_fee_override', e.target.value)} placeholder="Vacío = sin override"/>
              </div>
              <div>
                <label style={labelStyle}>% descuento (si no hay fijo)</label>
                <input type="number" step="1" style={inputStyle} value={form.service_fee_discount_pct} onChange={e => setField('service_fee_discount_pct', e.target.value)}/>
              </div>
            </div>

            <div style={{marginBottom:'14px'}}>
              <label style={labelStyle}>Volumen mínimo comprometido (m³, informativo)</label>
              <input type="number" step="1" style={inputStyle} value={form.minimum_commitment_m3} onChange={e => setField('minimum_commitment_m3', e.target.value)} placeholder="Ej: 5000"/>
              <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>
                Solo para seguimiento — el sistema nunca revierte ni bloquea el precio solo, esa decisión siempre la tomás vos.
              </div>
            </div>

            <div style={{marginBottom:'18px'}}>
              <label style={labelStyle}>Notas de la negociación</label>
              <textarea rows={2} style={{...inputStyle, resize:'vertical', fontFamily:'inherit'}} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Ej: acordado en reunión del 10/7, revisar en marzo"/>
            </div>

            {error && <div style={{color:'#8b2020', fontSize:'12px', marginBottom:'12px'}}>{error}</div>}

            <div style={{display:'flex', gap:'8px'}}>
              <button className="btn-primary" disabled={saving} onClick={handleSave} style={{flex:1}}>
                {saving ? 'Guardando…' : 'Guardar precio pactado'}
              </button>
              <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
