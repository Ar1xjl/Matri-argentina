import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

const SIZE_LABEL = { grande: 'Grande (1000 ppb / 5 m³)', chica: 'Chica (1000 ppb / 2.5 m³)' }

export default function TabletCatalogPanel({ profile }) {
  const [envelopes, setEnvelopes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newCount, setNewCount] = useState({ grande: '', chica: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const orgId = profile?.org_id

  const loadEnvelopes = async () => {
    const { data, error } = await supabase.from('tablet_catalog').select('*').eq('org_id', orgId).order('envelope_count', { ascending: false })
    if (error) { console.error('[TabletCatalogPanel]', error); setError(error.message); return }
    setEnvelopes(data || [])
  }

  useEffect(() => {
    if (!orgId) return
    supabase.from('tablet_catalog').select('*').eq('org_id', orgId).order('envelope_count', { ascending: false }).then(({ data, error }) => {
      if (error) { console.error('[TabletCatalogPanel]', error); setError(error.message) }
      setEnvelopes(data || [])
      setLoading(false)
    })
  }, [orgId])

  const handleAdd = async (tabletSize) => {
    setError('')
    const count = Number(newCount[tabletSize])
    if (!count || count <= 0) { setError('Ingresá una cantidad de tabletas por sobre válida.'); return }
    setSaving(true)
    const { error } = await supabase.from('tablet_catalog').insert({ org_id: orgId, tablet_size: tabletSize, envelope_count: count })
    setSaving(false)
    if (error) {
      setError(error.code === '23505' ? 'Ese tamaño de sobre ya existe.' : error.message)
      return
    }
    setNewCount(prev => ({ ...prev, [tabletSize]: '' }))
    await loadEnvelopes()
  }

  const handleRemove = async (id) => {
    setError('')
    const { error } = await supabase.from('tablet_catalog').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await loadEnvelopes()
  }

  if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>Cargando…</div>

  return (
    <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)', marginTop:'16px'}}>
      <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5'}}>
        <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Catálogo de sobres — MatriTablets</span>
        <div style={{fontSize:'11px', color:'#888', marginTop:'2px'}}>
          Tamaños de sobre disponibles para cada tipo de tableta. Los sobres son unidades de compra — no afectan el cálculo de dosis, solo cómo se compra/almacena stock en Inventario.
        </div>
      </div>

      {error && <div style={{padding:'10px 20px', color:'#8b2020', fontSize:'12px', background:'#fdeaea'}}>⚠️ {error}</div>}

      <div style={{padding:'20px'}}>
        {['grande', 'chica'].map(tabletSize => (
          <div key={tabletSize} style={{marginBottom:'20px'}}>
            <div style={{fontSize:'13px', fontWeight:700, color:'#0b4358', marginBottom:'8px'}}>{SIZE_LABEL[tabletSize]}</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:'10px', marginBottom:'10px'}}>
              {envelopes.filter(e => e.tablet_size === tabletSize).length === 0 ? (
                <div style={{color:'#888', fontSize:'13px'}}>Todavía no cargaste ningún tamaño de sobre.</div>
              ) : envelopes.filter(e => e.tablet_size === tabletSize).map(e => (
                <div key={e.id} style={{display:'flex', alignItems:'center', gap:'8px', background:'#f5f5ee', borderRadius:'8px', padding:'8px 12px'}}>
                  <span style={{fontSize:'14px', fontWeight:700, color:'#0b4358'}}>Sobre × {e.envelope_count}</span>
                  <button
                    onClick={() => handleRemove(e.id)}
                    style={{background:'none', border:'none', color:'#8b2020', cursor:'pointer', fontSize:'13px', padding:0}}
                    title="Eliminar tamaño"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div style={{display:'flex', gap:'8px', alignItems:'flex-end'}}>
              <div>
                <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>Tabletas por sobre</label>
                <input
                  type="number" step="1"
                  style={{padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px', width:'140px'}}
                  value={newCount[tabletSize]} onChange={e => setNewCount(prev => ({ ...prev, [tabletSize]: e.target.value }))}
                  placeholder="Ej: 20"
                  onKeyDown={e => e.key === 'Enter' && handleAdd(tabletSize)}
                />
              </div>
              <button className="btn-primary" disabled={saving} onClick={() => handleAdd(tabletSize)}>
                {saving ? 'Agregando…' : '+ Agregar tamaño'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
