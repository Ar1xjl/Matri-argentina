import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { downloadPlanTemplate, parsePlanFile } from '../../lib/excelImport'

const PRODUCT_OPTIONS = [
  { value: 'undecided', label: 'Sin decidir' },
  { value: 'powder', label: 'MatriPowder' },
  { value: 'tablets', label: 'MatriTablets' },
]

function emptyRow() {
  return { cold_room_id: '', planned_date: '', planned_dose_ppb: '', product_preference: 'undecided', notes: '' }
}

// Distributor-authored Season Plan draft for one Customer — invisible to
// that Customer until "Compartir con el Cliente" copies it into their real
// plan (see migration 0021). Deliberately simpler than SeasonPlan.jsx: no
// Excel import, no Treatment conversion — this is just a working estimate.
export default function SeasonPlanDraftModal({ customerOrg, rooms, onClose }) {
  const [draft, setDraft] = useState(null)
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [newRow, setNewRow] = useState(emptyRow())
  const [adding, setAdding] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState('')
  const [shared, setShared] = useState(false)
  const [localRooms, setLocalRooms] = useState(rooms) // grows as Excel import auto-creates new Cámaras
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null) // { imported, errors, duplicates } | null
  const fileInput = useRef(null)

  // Keep localRooms in sync with the `rooms` prop (adjusted during render,
  // React's documented pattern for this — see App.jsx's invite-modal note).
  const [prevRoomsProp, setPrevRoomsProp] = useState(rooms)
  if (rooms !== prevRoomsProp) {
    setPrevRoomsProp(rooms)
    setLocalRooms(rooms)
  }

  const loadLines = (draftId) => {
    supabase.from('season_plan_draft_lines').select('*, cold_rooms(name, volume_m3)')
      .eq('draft_id', draftId).order('planned_date').then(({ data, error: err }) => {
        if (err) { console.error('[SeasonPlanDraftModal loadLines]', err); return }
        setLines(data || [])
      })
  }

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      let { data: d } = await supabase.from('season_plan_drafts').select('*')
        .eq('customer_org_id', customerOrg.id).eq('status', 'draft')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!d) {
        const { data: created, error: err } = await supabase.from('season_plan_drafts')
          .insert({ customer_org_id: customerOrg.id }).select().single()
        if (err) { console.error('[SeasonPlanDraftModal create]', err); if (!cancelled) setLoading(false); return }
        d = created
      }
      if (cancelled) return
      setDraft(d)
      loadLines(d.id)
      setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [customerOrg.id])

  const handleAddRow = async () => {
    if (!newRow.cold_room_id) { setError('Elegí una cámara.'); return }
    setError('')
    setAdding(true)
    const { error: err } = await supabase.from('season_plan_draft_lines').insert({
      draft_id: draft.id,
      cold_room_id: newRow.cold_room_id,
      planned_date: newRow.planned_date || null,
      planned_dose_ppb: newRow.planned_dose_ppb === '' ? null : Number(newRow.planned_dose_ppb),
      product_preference: newRow.product_preference,
      notes: newRow.notes || null,
    })
    setAdding(false)
    if (err) { setError(err.message); return }
    setNewRow(emptyRow())
    loadLines(draft.id)
  }

  const updateLine = async (id, field, value) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
    await supabase.from('season_plan_draft_lines').update({ [field]: value === '' ? null : value }).eq('id', id)
  }

  const deleteLine = async (id) => {
    await supabase.from('season_plan_draft_lines').delete().eq('id', id)
    loadLines(draft.id)
  }

  // Same room-matching/auto-create + duplicate-detection logic as
  // Portal.jsx's importPlanExcel (Cámara + Fecha = same batch, skipped;
  // different Fecha = a real separate application) — just scoped to this
  // Customer's org and this draft instead of the caller's own.
  const handleImportFile = async (file) => {
    if (!file || !draft) return
    setImporting(true)
    setImportResult(null)
    const { valid, errors } = await parsePlanFile(file)
    const rowErrors = [...errors]
    const duplicates = []

    const roomsByName = new Map(localRooms.map(r => [r.name.trim().toLowerCase(), r]))
    const existingSignatures = new Set(lines.map(l => `${l.cold_room_id}|${l.planned_date || ''}`))
    const linesToInsert = []
    const newlyCreatedRooms = []

    for (const row of valid) {
      const key = row.roomName.toLowerCase()
      let room = roomsByName.get(key)
      if (!room) {
        if (!row.roomVolume) {
          rowErrors.push({ row: '-', reason: `Cámara nueva "${row.roomName}" sin volumen — no se pudo crear` })
          continue
        }
        const { data: created, error: err } = await supabase.from('cold_rooms')
          .insert({ org_id: customerOrg.id, name: row.roomName, volume_m3: row.roomVolume, location: row.location, primary_crop: row.primaryCrop })
          .select().single()
        if (err) { rowErrors.push({ row: '-', reason: err.message }); continue }
        room = created
        roomsByName.set(key, room)
        newlyCreatedRooms.push(room)
      }

      const signature = `${room.id}|${row.planned_date || ''}`
      if (existingSignatures.has(signature)) {
        duplicates.push({ room: row.roomName, date: row.planned_date })
        continue
      }
      existingSignatures.add(signature)

      linesToInsert.push({
        draft_id: draft.id,
        cold_room_id: room.id,
        planned_date: row.planned_date,
        planned_dose_ppb: row.planned_dose_ppb,
      })
    }

    if (linesToInsert.length > 0) {
      const { error: err } = await supabase.from('season_plan_draft_lines').insert(linesToInsert)
      if (err) rowErrors.push({ row: '-', reason: err.message })
    }
    if (newlyCreatedRooms.length > 0) setLocalRooms(prev => [...prev, ...newlyCreatedRooms])

    setImporting(false)
    setImportResult({ imported: linesToInsert.length, errors: rowErrors, duplicates })
    loadLines(draft.id)
    if (fileInput.current) fileInput.current.value = ''
  }

  const handleShare = async () => {
    setSharing(true)
    setError('')
    const { error: err } = await supabase.rpc('share_season_plan_draft', { p_draft_id: draft.id })
    setSharing(false)
    if (err) { setError(err.message); return }
    setShared(true)
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(7,46,61,.6)', backdropFilter: 'blur(4px)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '760px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(11,67,88,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: '#0b4358' }}>
            🗓️ Borrador de Plan de Temporada — {customerOrg.name}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#6b7280', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: '12.5px', color: '#6b7280', marginBottom: '18px' }}>
          {customerOrg.name} no ve nada de esto hasta que apretás "Compartir con el Cliente" más abajo.
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#888' }}>Cargando…</div>
        ) : shared ? (
          <div style={{ fontSize: '13px', color: '#1a6b30', background: '#eaf7ee', border: '1px solid #a3d9b0', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
            ✓ Compartido — {customerOrg.name} ya lo ve en su propio Plan de Temporada y recibió una notificación.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
              <button className="btn-secondary btn-sm" onClick={downloadPlanTemplate}>📥 Descargar plantilla</button>
              <button className="btn-secondary btn-sm" disabled={importing} onClick={() => fileInput.current?.click()}>
                {importing ? 'Importando…' : '📤 Subir Excel'}
              </button>
              <input ref={fileInput} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={e => handleImportFile(e.target.files?.[0])} />
            </div>

            {importResult && (
              <div style={{ fontSize: '12.5px', marginBottom: '14px' }}>
                <div style={{ color: '#1a6b30' }}>
                  ✓ Se importaron {importResult.imported} registro{importResult.imported === 1 ? '' : 's'}.
                </div>
                {importResult.duplicates?.length > 0 && (
                  <div style={{ color: '#b06a00', marginTop: '4px' }}>
                    {importResult.duplicates.length} fila{importResult.duplicates.length === 1 ? '' : 's'} no se cargaron por ser duplicadas (misma cámara + misma fecha).
                  </div>
                )}
                {importResult.errors.length > 0 && (
                  <div style={{ color: '#8b2020', marginTop: '4px' }}>
                    {importResult.errors.length} fila{importResult.errors.length === 1 ? '' : 's'} con problemas:
                    <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
                      {importResult.errors.map((e, i) => <li key={i}>Fila {e.row}: {e.reason}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="table-scroll" style={{ marginBottom: '14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Cámara', 'Fecha', 'Dosis (ppb)', 'Producto', 'Notas', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #ddddd5', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map(l => (
                    <tr key={l.id}>
                      <td style={{ padding: '6px 8px' }}>{l.cold_rooms?.name}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="date" value={l.planned_date || ''} onChange={e => updateLine(l.id, 'planned_date', e.target.value)}
                          style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #dde0d5', fontSize: '12.5px', width: '130px' }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="number" value={l.planned_dose_ppb ?? ''} onChange={e => updateLine(l.id, 'planned_dose_ppb', e.target.value)}
                          style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #dde0d5', fontSize: '12.5px', width: '80px' }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <select value={l.product_preference} onChange={e => updateLine(l.id, 'product_preference', e.target.value)}
                          style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #dde0d5', fontSize: '12.5px' }}>
                          {PRODUCT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={l.notes || ''} onChange={e => updateLine(l.id, 'notes', e.target.value)}
                          style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #dde0d5', fontSize: '12.5px', width: '140px' }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <button onClick={() => deleteLine(l.id)} style={{ background: 'none', border: 'none', color: '#8b2020', cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ padding: '6px 8px' }}>
                      <select value={newRow.cold_room_id} onChange={e => setNewRow({ ...newRow, cold_room_id: e.target.value })}
                        style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #dde0d5', fontSize: '12.5px' }}>
                        <option value="">Elegir cámara…</option>
                        {localRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input type="date" value={newRow.planned_date} onChange={e => setNewRow({ ...newRow, planned_date: e.target.value })}
                        style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #dde0d5', fontSize: '12.5px', width: '130px' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input type="number" value={newRow.planned_dose_ppb} onChange={e => setNewRow({ ...newRow, planned_dose_ppb: e.target.value })}
                        style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #dde0d5', fontSize: '12.5px', width: '80px' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <select value={newRow.product_preference} onChange={e => setNewRow({ ...newRow, product_preference: e.target.value })}
                        style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #dde0d5', fontSize: '12.5px' }}>
                        {PRODUCT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input value={newRow.notes} onChange={e => setNewRow({ ...newRow, notes: e.target.value })}
                        style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #dde0d5', fontSize: '12.5px', width: '140px' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <button className="btn-secondary btn-sm" disabled={adding} onClick={handleAddRow}>+ Agregar</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {error && <div style={{ color: '#8b2020', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}

            <button className="btn-primary" disabled={sharing || lines.length === 0} onClick={handleShare} style={{ width: '100%' }}>
              {sharing ? 'Compartiendo…' : `Compartir con ${customerOrg.name}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
