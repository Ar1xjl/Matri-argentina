import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function PouchCatalogPanel({ profile, readOnly = false }) {
  const [sizes, setSizes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newSize, setNewSize] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const orgId = profile?.org_id

  const loadSizes = async () => {
    const { data, error } = await supabase.from('pouch_catalog').select('*').eq('org_id', orgId).order('size_g', { ascending: false })
    if (error) { console.error('[PouchCatalogPanel]', error); setError(error.message); return }
    setSizes(data || [])
  }

  useEffect(() => {
    if (!orgId) return
    supabase.from('pouch_catalog').select('*').eq('org_id', orgId).order('size_g', { ascending: false }).then(({ data, error }) => {
      if (error) { console.error('[PouchCatalogPanel]', error); setError(error.message) }
      setSizes(data || [])
      setLoading(false)
    })
  }, [orgId])

  const handleAdd = async () => {
    setError('')
    const grams = Number(newSize)
    if (!grams || grams <= 0) { setError('Ingresá un tamaño en gramos válido.'); return }
    setSaving(true)
    const { error } = await supabase.from('pouch_catalog').insert({ org_id: orgId, size_g: grams })
    setSaving(false)
    if (error) {
      setError(error.code === '23505' ? 'Ese tamaño ya existe en tu catálogo.' : error.message)
      return
    }
    setNewSize('')
    await loadSizes()
  }

  const handleRemove = async (id) => {
    setError('')
    const { error } = await supabase.from('pouch_catalog').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await loadSizes()
  }

  if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>Cargando…</div>

  return (
    <div style={{background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
      <div style={{padding:'14px 20px', borderBottom:'0.5px solid #ddddd5'}}>
        <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Catálogo de sachets — MatriPowder</span>
        <div style={{fontSize:'11px', color:'#888', marginTop:'2px'}}>
          Estos son los tamaños de sachet que la Calculadora y el Plan de Temporada usan para armar la dosis de tus clientes. Por ahora, cada Distribuidor define el suyo propio.
        </div>
      </div>

      {error && <div style={{padding:'10px 20px', color:'#8b2020', fontSize:'12px', background:'#fdeaea'}}>⚠️ {error}</div>}

      <div style={{padding:'20px'}}>
        <div style={{display:'flex', flexWrap:'wrap', gap:'10px', marginBottom:'20px'}}>
          {sizes.length === 0 ? (
            <div style={{color:'#888', fontSize:'13px'}}>Todavía no cargaste ningún tamaño de sachet.</div>
          ) : sizes.map(s => (
            <div key={s.id} style={{display:'flex', alignItems:'center', gap:'8px', background:'#f5f5ee', borderRadius:'8px', padding:'8px 12px'}}>
              <span style={{fontSize:'14px', fontWeight:700, color:'#0b4358'}}>{s.size_g} g</span>
              {!readOnly && (
                <button
                  onClick={() => handleRemove(s.id)}
                  style={{background:'none', border:'none', color:'#8b2020', cursor:'pointer', fontSize:'13px', padding:0}}
                  title="Eliminar tamaño"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {readOnly ? (
          <div style={{fontSize:'11px', color:'#0c447c', fontWeight:600}}>
            👁️ Vista de solo lectura — el catálogo lo define el Distribuidor.
          </div>
        ) : (
          <div style={{display:'flex', gap:'8px', alignItems:'flex-end'}}>
            <div>
              <label style={{fontSize:'11px', fontWeight:700, color:'#0b4358', display:'block', marginBottom:'4px', textTransform:'uppercase'}}>Nuevo tamaño (gramos)</label>
              <input
                type="number" step="1"
                style={{padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'14px', width:'140px'}}
                value={newSize} onChange={e => setNewSize(e.target.value)} placeholder="Ej: 25"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <button className="btn-primary" disabled={saving} onClick={handleAdd}>
              {saving ? 'Agregando…' : '+ Agregar tamaño'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
