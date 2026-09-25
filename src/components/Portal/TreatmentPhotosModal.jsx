import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import MatriSureCapture from './MatriSureCapture'

// Extra documentation photos for a Treatment (fruit quality, fill level,
// anything else) — any time, append-only (migration 0039). Live camera only,
// same rule as every other photo in the flow (MatriSureCapture has no file
// picker). Files live in the existing private 'matrisure-photos' bucket under
// {treatment org_id}/{treatment_id}/, so the bucket's org-scoped RLS applies.

const CATEGORIES = ['fruit_quality', 'fill_level', 'other']
const CATEGORY_STYLE = {
  fruit_quality: { bg: '#eaf7ee', color: '#1a6b30' },
  fill_level:    { bg: '#e8f4fc', color: '#0c447c' },
  other:         { bg: '#f5f5ee', color: '#6b6b6b' },
}

function Thumb({ path }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let ignore = false
    supabase.storage.from('matrisure-photos').createSignedUrl(path, 60 * 10).then(({ data, error }) => {
      if (ignore) return
      if (error || !data) setFailed(true); else setUrl(data.signedUrl)
    })
    return () => { ignore = true }
  }, [path])
  if (failed) return <div style={{fontSize:'11px', color:'#8b2020', padding:'30px 0', textAlign:'center'}}>{t('treatmentPhotos.loadError')}</div>
  if (!url) return <div style={{fontSize:'11px', color:'#888', padding:'30px 0', textAlign:'center'}}>{t('common.loading')}</div>
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" style={{width:'100%', borderRadius:'8px', display:'block'}}/></a>
}

export default function TreatmentPhotosModal({ treatment, canAdd, onClose }) {
  const { t } = useTranslation()
  const [photos, setPhotos] = useState([])
  const [authors, setAuthors] = useState({})
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState('list') // 'list' | 'capture' | 'details'
  const [blob, setBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [category, setCategory] = useState('fruit_quality')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    const { data, error: loadErr } = await supabase
      .from('treatment_photos').select('*').eq('treatment_id', treatment.id).order('created_at', { ascending: false })
    if (loadErr) { console.error(loadErr); setLoading(false); return }
    const rows = data || []
    setPhotos(rows)
    const ids = [...new Set(rows.map(r => r.created_by).filter(Boolean))]
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      setAuthors(Object.fromEntries((profs || []).map(p => [p.id, p.full_name])))
    }
    setLoading(false)
  }, [treatment.id])

  useEffect(() => { (async () => { await reload() })() }, [reload])

  const handleCaptured = async (capturedBlob) => {
    setBlob(capturedBlob)
    setPreviewUrl(URL.createObjectURL(capturedBlob))
    setCategory('fruit_quality'); setNote(''); setError('')
    setStep('details')
  }

  const discardCapture = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setBlob(null); setPreviewUrl(null); setStep('list')
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    const path = `${treatment.org_id}/${treatment.id}/extra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
    const { error: uploadError } = await supabase.storage.from('matrisure-photos').upload(path, blob, { contentType: 'image/jpeg' })
    if (uploadError) { setSaving(false); setError(uploadError.message); return }
    const { error: insertError } = await supabase.from('treatment_photos').insert({
      treatment_id: treatment.id, category, note: note.trim() || null, photo_path: path,
    })
    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    discardCapture()
    await reload()
  }

  const title = `${t('treatmentPhotos.title')} — ${treatment.cold_rooms?.name || ''}`

  if (step === 'capture') {
    return (
      <div style={{position:'fixed', inset:0, background:'rgba(7,46,61,.7)', backdropFilter:'blur(4px)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px', overflowY:'auto'}}>
        <MatriSureCapture
          onCapture={handleCaptured}
          onCancel={() => setStep('list')}
          bannerText={t('treatmentPhotos.captureBanner')}
          confirmLabel={t('treatmentPhotos.continue')}
        />
      </div>
    )
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
      style={{position:'fixed', inset:0, background:'rgba(7,46,61,.7)', backdropFilter:'blur(4px)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'30px 20px', overflowY:'auto'}}>
      <div style={{background:'#fff', borderRadius:'14px', padding:'20px', maxWidth:'640px', width:'100%'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', gap:'10px'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>{title}</span>
          <button onClick={onClose} disabled={saving} style={{background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#6b7280'}}>✕</button>
        </div>

        {step === 'details' ? (
          <div>
            {previewUrl && <img src={previewUrl} alt="" style={{width:'100%', maxWidth:'360px', borderRadius:'8px', display:'block', margin:'0 auto 14px'}}/>}
            <label style={{display:'block', fontSize:'12px', color:'#888', marginBottom:'4px'}}>{t('treatmentPhotos.category')}</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              style={{width:'100%', padding:'9px 10px', borderRadius:'8px', border:'1.5px solid #dde0d5', fontSize:'14px', marginBottom:'12px'}}>
              {CATEGORIES.map(c => <option key={c} value={c}>{t(`treatmentPhotos.categories.${c}`)}</option>)}
            </select>
            <label style={{display:'block', fontSize:'12px', color:'#888', marginBottom:'4px'}}>{t('treatmentPhotos.note')}</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={500} placeholder={t('treatmentPhotos.notePlaceholder')}
              style={{width:'100%', padding:'9px 10px', borderRadius:'8px', border:'1.5px solid #dde0d5', fontSize:'14px', fontFamily:'inherit', resize:'vertical', marginBottom:'12px'}}/>
            {error && <div style={{color:'#8b2020', fontSize:'12px', marginBottom:'10px'}}>⚠️ {error}</div>}
            <div style={{display:'flex', gap:'8px'}}>
              <button className="btn-primary" disabled={saving} onClick={handleSave}>{saving ? t('treatmentPhotos.saving') : t('treatmentPhotos.save')}</button>
              <button className="btn-secondary" disabled={saving} onClick={discardCapture}>{t('common.cancel')}</button>
            </div>
          </div>
        ) : (
          <>
            {canAdd && (
              <button className="btn-lime" style={{marginBottom:'14px'}} onClick={() => setStep('capture')}>📷 {t('treatmentPhotos.add')}</button>
            )}
            {loading ? (
              <div style={{padding:'24px', textAlign:'center', color:'#888', fontSize:'13px'}}>{t('common.loading')}</div>
            ) : photos.length === 0 ? (
              <div style={{padding:'24px', textAlign:'center', color:'#888', fontSize:'13px'}}>{t('treatmentPhotos.empty')}</div>
            ) : (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))', gap:'12px'}}>
                {photos.map(p => {
                  const cs = CATEGORY_STYLE[p.category] || CATEGORY_STYLE.other
                  return (
                    <div key={p.id} style={{border:'0.5px solid #ddddd5', borderRadius:'10px', padding:'8px'}}>
                      <Thumb path={p.photo_path} />
                      <div style={{marginTop:'8px'}}>
                        <span style={{background:cs.bg, color:cs.color, fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'100px'}}>{t(`treatmentPhotos.categories.${p.category}`)}</span>
                      </div>
                      {p.note && <div style={{fontSize:'12px', color:'#0b4358', marginTop:'6px', whiteSpace:'pre-wrap'}}>{p.note}</div>}
                      <div style={{fontSize:'10px', color:'#888', marginTop:'6px'}}>
                        {new Date(p.created_at).toLocaleString()}{authors[p.created_by] ? ` · ${authors[p.created_by]}` : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
