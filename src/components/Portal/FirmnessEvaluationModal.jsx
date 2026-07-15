import { useState } from 'react'
import { DEFAULT_SAMPLES, lossRate } from '../../lib/firmness'
import { generateFirmnessPdf } from '../../lib/firmnessPdf'

const FIELD_DEFS = [
  ['declaration_number', 'N° de declaración'],
  ['variety', 'Variedad'],
  ['lot_number', 'Lote'],
  ['cold_type', 'Tipo de frío'],
  ['harvest_date', 'Fecha de cosecha', 'date'],
  ['room_fill_start', 'Inicio de llenado de cámara', 'date'],
  ['room_fill_end', 'Final de llenado de cámara', 'date'],
  ['room_exit_date', 'Fecha de salida de cámara', 'date'],
  ['evaluator_name', 'Evaluador'],
]

function emptyForm(evaluatorName) {
  return {
    declaration_number: '', variety: '', lot_number: '', cold_type: '',
    harvest_date: '', room_fill_start: '', room_fill_end: '', room_exit_date: '',
    evaluator_name: evaluatorName || '',
    samples: DEFAULT_SAMPLES.map(s => ({ ...s })),
  }
}

// Small inline SVG line chart — only ever 2 series (Testigo/Matri) over a
// handful of points, doesn't warrant pulling in a charting library.
function FirmnessChart({ samples }) {
  const rows = (samples || []).filter(s => s.day != null && s.testigo !== '' && s.matri !== '')
  if (rows.length < 2) return null
  const sorted = [...rows].sort((a, b) => a.day - b.day)
  const W = 460, H = 220, PAD = 36
  const maxDay = Math.max(...sorted.map(s => s.day))
  const maxVal = Math.max(...sorted.map(s => Math.max(Number(s.testigo), Number(s.matri)))) * 1.15 || 1
  const x = d => PAD + (d / maxDay) * (W - PAD * 1.5)
  const y = v => H - PAD - (v / maxVal) * (H - PAD * 1.5)
  const line = key => sorted.map(s => `${x(s.day)},${y(Number(s[key]))}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: `${W}px`, height: 'auto' }}>
      <line x1={PAD} y1={H - PAD} x2={W - PAD / 2} y2={H - PAD} stroke="#ddddd5" strokeWidth="1" />
      <line x1={PAD} y1={PAD / 2} x2={PAD} y2={H - PAD} stroke="#ddddd5" strokeWidth="1" />
      {sorted.map(s => (
        <text key={s.day} x={x(s.day)} y={H - PAD + 16} fontSize="11" fill="#6b7280" textAnchor="middle">{s.day}</text>
      ))}
      <polyline points={line('testigo')} fill="none" stroke="#e8736a" strokeWidth="2" />
      <polyline points={line('matri')} fill="none" stroke="#0b4358" strokeWidth="2" />
      {sorted.map(s => (
        <g key={`pts-${s.day}`}>
          <circle cx={x(s.day)} cy={y(Number(s.testigo))} r="3.5" fill="#e8736a" />
          <circle cx={x(s.day)} cy={y(Number(s.matri))} r="3.5" fill="#0b4358" />
        </g>
      ))}
      <text x={W - PAD / 2} y={H - PAD + 16} fontSize="11" fill="#6b7280" textAnchor="end">días</text>
      <g transform={`translate(${PAD + 8}, 14)`}>
        <circle cx="0" cy="-4" r="3.5" fill="#e8736a" /><text x="8" y="0" fontSize="11" fill="#0b4358">Testigo</text>
        <circle cx="70" cy="-4" r="3.5" fill="#0b4358" /><text x="78" y="0" fontSize="11" fill="#0b4358">Matri</text>
      </g>
    </svg>
  )
}

export default function FirmnessEvaluationModal({ treatment, evaluation, canEdit, evaluatorName, onSave, onGetPdfUrl, onClose }) {
  const [editing, setEditing] = useState(!evaluation && canEdit)
  const [form, setForm] = useState(() => evaluation
    ? { ...evaluation, samples: evaluation.samples?.length ? evaluation.samples : DEFAULT_SAMPLES.map(s => ({ ...s })) }
    : emptyForm(evaluatorName))
  const [pdfFile, setPdfFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pdfUrl, setPdfUrl] = useState(null)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)

  const updateField = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const updateSample = (idx, key, value) => setForm(f => ({
    ...f, samples: f.samples.map((s, i) => i === idx ? { ...s, [key]: value } : s),
  }))
  const addSample = () => setForm(f => ({ ...f, samples: [...f.samples, { day: '', testigo: '', matri: '' }] }))
  const removeSample = (idx) => setForm(f => ({ ...f, samples: f.samples.filter((_, i) => i !== idx) }))

  const handleSave = async () => {
    setError('')
    setSaving(true)
    const cleanSamples = form.samples
      .filter(s => s.day !== '' && s.day != null)
      .map(s => ({ day: Number(s.day), testigo: s.testigo === '' ? null : Number(s.testigo), matri: s.matri === '' ? null : Number(s.matri) }))
    const { error: saveError } = await onSave(treatment.id, { ...form, samples: cleanSamples }, pdfFile)
    setSaving(false)
    if (saveError) { setError(saveError); return }
    setEditing(false)
  }

  const handleDownloadReport = async () => {
    setGeneratingReport(true)
    await generateFirmnessPdf(treatment, evaluation)
    setGeneratingReport(false)
  }

  const handleViewPdf = async () => {
    setLoadingPdf(true)
    const url = await onGetPdfUrl(evaluation.pdf_url)
    setLoadingPdf(false)
    if (url) setPdfUrl(url)
  }

  const loss = lossRate((editing ? form.samples : evaluation?.samples) || [])

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(7,46,61,.6)', backdropFilter: 'blur(4px)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(11,67,88,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: '#0b4358' }}>
            📊 {evaluation?.declaration_number ? `Evaluación de Firmeza N°${evaluation.declaration_number}` : 'Evaluación de Firmeza'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#6b7280', cursor: 'pointer' }}>✕</button>
        </div>

        {editing ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {FIELD_DEFS.map(([key, label, type]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0b4358', marginBottom: '4px', textTransform: 'uppercase' }}>{label}</label>
                  <input
                    type={type || 'text'} value={form[key] || ''}
                    onChange={e => updateField(key, e.target.value)}
                    style={{ width: '100%', padding: '8px 11px', borderRadius: '7px', border: '1.5px solid #dde0d5', fontSize: '13px', color: '#0b4358' }}
                  />
                </div>
              ))}
            </div>

            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0b4358', marginBottom: '8px', textTransform: 'uppercase' }}>
              Firmeza de pulpa (lb/pulg²)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 30px', gap: '8px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                <span>Día</span><span>Testigo</span><span>Matri</span><span></span>
              </div>
              {form.samples.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 30px', gap: '8px' }}>
                  <input type="number" value={s.day} onChange={e => updateSample(i, 'day', e.target.value)}
                    style={{ padding: '7px 9px', borderRadius: '6px', border: '1.5px solid #dde0d5', fontSize: '13px' }} />
                  <input type="number" step="0.1" value={s.testigo} onChange={e => updateSample(i, 'testigo', e.target.value)}
                    style={{ padding: '7px 9px', borderRadius: '6px', border: '1.5px solid #dde0d5', fontSize: '13px' }} />
                  <input type="number" step="0.1" value={s.matri} onChange={e => updateSample(i, 'matri', e.target.value)}
                    style={{ padding: '7px 9px', borderRadius: '6px', border: '1.5px solid #dde0d5', fontSize: '13px' }} />
                  <button onClick={() => removeSample(i)} style={{ background: 'none', border: 'none', color: '#8b2020', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                </div>
              ))}
            </div>
            <button className="btn-secondary btn-sm" onClick={addSample} style={{ marginBottom: '16px' }}>+ Agregar día</button>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0b4358', marginBottom: '4px', textTransform: 'uppercase' }}>
                Documento firmado (PDF, opcional)
              </label>
              <input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files?.[0] || null)} style={{ fontSize: '13px' }} />
              {evaluation?.pdf_url && !pdfFile && (
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Ya hay un PDF adjunto — subí uno nuevo solo si querés reemplazarlo.</div>
              )}
            </div>

            {error && <div style={{ color: '#8b2020', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" disabled={saving} onClick={handleSave} style={{ flex: 1 }}>
                {saving ? 'Guardando…' : 'Guardar evaluación'}
              </button>
              {evaluation && (
                <button className="btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
              )}
            </div>
          </>
        ) : evaluation ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: '13px', marginBottom: '18px' }}>
              {FIELD_DEFS.map(([key, label, type]) => evaluation[key] && (
                <div key={key}>
                  <span style={{ color: '#6b7280' }}>{label}: </span>
                  <span style={{ color: '#0b4358', fontWeight: 600 }}>
                    {type === 'date' ? new Date(evaluation[key]).toLocaleDateString('es-AR') : evaluation[key]}
                  </span>
                </div>
              ))}
            </div>

            <div className="table-scroll" style={{ marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Tratamiento', ...(evaluation.samples || []).map(s => `Día ${s.day}`)].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #ddddd5', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: '#e8736a' }}>Testigo</td>
                    {(evaluation.samples || []).map((s, i) => <td key={i} style={{ padding: '6px 10px' }}>{s.testigo ?? '—'}</td>)}
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0b4358' }}>Matri</td>
                    {(evaluation.samples || []).map((s, i) => <td key={i} style={{ padding: '6px 10px' }}>{s.matri ?? '—'}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>

            {(loss.testigo != null || loss.matri != null) && (
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
                Pérdida de firmeza: Testigo {loss.testigo?.toFixed(2)} lb/pulg²/día · Matri {loss.matri?.toFixed(2)} lb/pulg²/día
              </div>
            )}

            <FirmnessChart samples={evaluation.samples} />

            <div style={{ display: 'flex', gap: '8px', marginTop: '18px', flexWrap: 'wrap' }}>
              <button className="btn-primary" disabled={generatingReport} onClick={handleDownloadReport} style={{ flex: 1 }}>
                {generatingReport ? 'Generando…' : '📄 Descargar reporte (PDF)'}
              </button>
              {evaluation.pdf_url && (
                pdfUrl ? (
                  <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn-secondary" style={{ textDecoration: 'none', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Abrir documento firmado
                  </a>
                ) : (
                  <button className="btn-secondary" disabled={loadingPdf} onClick={handleViewPdf} style={{ flex: 1 }}>
                    {loadingPdf ? 'Preparando…' : '📎 Documento firmado adjunto'}
                  </button>
                )
              )}
              {canEdit && (
                <button className="btn-secondary" onClick={() => setEditing(true)}>✎ Editar</button>
              )}
            </div>
          </>
        ) : (
          <div style={{ fontSize: '13px', color: '#888', textAlign: 'center', padding: '20px' }}>
            Todavía no hay una evaluación de firmeza cargada para este tratamiento.
          </div>
        )}
      </div>
    </div>
  )
}
