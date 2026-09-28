import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'

// Real document upload/assignment (2026-09-28) — replaces the old hardcoded
// DOCS array. Only Global Owner/Aprobador uploads + assigns (migration
// 0040); everyone else just gets the RLS-filtered read-only list below,
// same component either way (canManage decides which half renders).
// See DOMAIN_MODEL.md Rule 59.

const COUNTRY_LABEL = {
  AR: '🇦🇷 Argentina', BR: '🇧🇷 Brasil', CL: '🇨🇱 Chile', UY: '🇺🇾 Uruguay',
  PY: '🇵🇾 Paraguay', BO: '🇧🇴 Bolivia', PE: '🇵🇪 Perú', US: '🇺🇸 Estados Unidos',
}
const countryLabel = (code) => COUNTRY_LABEL[code] || code || '—'

function AssignModal({ doc, distributors, initialOrgIds, onSave, onClose }) {
  const [selected, setSelected] = useState(new Set(initialOrgIds))
  const [saving, setSaving] = useState(false)
  const byCountry = distributors.reduce((acc, d) => {
    (acc[d.country || '—'] ||= []).push(d)
    return acc
  }, {})

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleCountry = (list) => {
    const allIn = list.every(d => selected.has(d.id))
    setSelected(prev => {
      const next = new Set(prev)
      list.forEach(d => allIn ? next.delete(d.id) : next.add(d.id))
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    await onSave([...selected])
    setSaving(false)
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
      style={{position:'fixed', inset:0, background:'rgba(7,46,61,.7)', backdropFilter:'blur(4px)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'30px 20px', overflowY:'auto'}}>
      <div style={{background:'#fff', borderRadius:'14px', padding:'20px', maxWidth:'520px', width:'100%'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Asignar — {doc.name}</span>
          <button onClick={onClose} disabled={saving} style={{background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#6b7280'}}>✕</button>
        </div>
        <p style={{fontSize:'12px', color:'#888', marginBottom:'14px'}}>Visible para cada Distribuidor tildado, y para todo lo que cuelga debajo (Sub-distribuidores, Clientes).</p>

        {distributors.length === 0 ? (
          <div style={{padding:'20px', textAlign:'center', color:'#888', fontSize:'13px'}}>No hay Distribuidores dados de alta todavía.</div>
        ) : (
          Object.entries(byCountry).sort(([a],[b]) => a.localeCompare(b)).map(([country, list]) => (
            <div key={country} style={{marginBottom:'14px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px'}}>
                <span style={{fontSize:'12px', fontWeight:700, color:'#0b4358'}}>{countryLabel(country)}</span>
                <button className="btn-secondary btn-sm" onClick={() => toggleCountry(list)}>
                  {list.every(d => selected.has(d.id)) ? 'Destildar todos' : `Seleccionar todos (${list.length})`}
                </button>
              </div>
              {list.map(d => (
                <label key={d.id} style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'#0b4358', padding:'6px 4px', cursor:'pointer'}}>
                  <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)}/>
                  {d.name}
                </label>
              ))}
            </div>
          ))
        )}

        <div style={{display:'flex', gap:'8px', marginTop:'10px'}}>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar asignación'}</button>
          <button className="btn-secondary" disabled={saving} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function Documents({ profile, myRoles = [] }) {
  const { t } = useTranslation()
  const orgType = profile?.organizations?.org_type
  const canManage = orgType === 'global' && (myRoles.includes('owner') || myRoles.includes('approver'))

  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [distributors, setDistributors] = useState([])
  const [assignedByDoc, setAssignedByDoc] = useState({}) // { [document_id]: Set(org_id) }
  const [assigningDoc, setAssigningDoc] = useState(null)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [file, setFile] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)

  const [replacingId, setReplacingId] = useState(null)
  const [replaceError, setReplaceError] = useState('')

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false })
    if (error) { console.error(error); setLoading(false); return }
    setDocs(data || [])

    if (canManage) {
      const [{ data: orgs }, { data: assignments }] = await Promise.all([
        supabase.from('organizations').select('id, name, country').eq('org_type', 'distributor').order('name'),
        supabase.from('document_assignments').select('document_id, org_id'),
      ])
      setDistributors(orgs || [])
      const grouped = {}
      ;(assignments || []).forEach(a => { (grouped[a.document_id] ||= new Set()).add(a.org_id) })
      setAssignedByDoc(grouped)
    }
    setLoading(false)
  }, [canManage])

  useEffect(() => { (async () => { await reload() })() }, [reload])

  const handleUpload = async () => {
    setUploadError('')
    if (!name.trim()) { setUploadError('Ponele un nombre al documento.'); return }
    if (!file) { setUploadError('Elegí un archivo.'); return }
    setUploading(true)

    const id = crypto.randomUUID()
    const path = `${id}/${file.name}`
    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file)
    if (uploadErr) { setUploading(false); setUploadError(uploadErr.message); return }

    const { error: insertErr } = await supabase.from('documents').insert({
      id, name: name.trim(), category: category.trim() || null, file_path: path, file_name: file.name, uploaded_by: profile.id,
    })
    setUploading(false)
    if (insertErr) { setUploadError(insertErr.message); return }
    setName(''); setCategory(''); setFile(null)
    await reload()
  }

  const handleReplace = async (doc, newFile) => {
    setReplaceError('')
    const path = `${doc.id}/${Date.now()}-${newFile.name}`
    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, newFile)
    if (uploadErr) { setReplaceError(uploadErr.message); return }
    const { error: updateErr } = await supabase.from('documents')
      .update({ file_path: path, file_name: newFile.name, updated_at: new Date().toISOString() }).eq('id', doc.id)
    if (updateErr) { setReplaceError(updateErr.message); return }
    supabase.storage.from('documents').remove([doc.file_path]) // best-effort, old blob cleanup
    setReplacingId(null)
    await reload()
  }

  const handleDelete = async (doc) => {
    if (!window.confirm(`¿Eliminar "${doc.name}"? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('documents').delete().eq('id', doc.id)
    if (error) { console.error(error); return }
    await supabase.storage.from('documents').remove([doc.file_path])
    await reload()
  }

  const saveAssignment = async (doc, orgIds) => {
    const current = assignedByDoc[doc.id] || new Set()
    const toAdd = orgIds.filter(id => !current.has(id))
    const toRemove = [...current].filter(id => !orgIds.includes(id))
    if (toAdd.length) await supabase.from('document_assignments').insert(toAdd.map(org_id => ({ document_id: doc.id, org_id })))
    if (toRemove.length) await supabase.from('document_assignments').delete().eq('document_id', doc.id).in('org_id', toRemove)
    setAssigningDoc(null)
    await reload()
  }

  const handleDownload = async (doc) => {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 60, { download: doc.file_name })
    if (error) { console.error(error); return }
    window.open(data.signedUrl, '_blank')
  }

  if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>{t('common.loading')}</div>

  return (
    <div>
      {assigningDoc && (
        <AssignModal
          doc={assigningDoc}
          distributors={distributors}
          initialOrgIds={[...(assignedByDoc[assigningDoc.id] || [])]}
          onSave={(orgIds) => saveAssignment(assigningDoc, orgIds)}
          onClose={() => setAssigningDoc(null)}
        />
      )}

      {canManage && (
        <div className="card" style={{marginBottom:'16px'}}>
          <div className="card-header"><span className="card-title">Subir documento nuevo</span></div>
          <div className="card-body">
            {uploadError && <div style={{color:'#8b2020', fontSize:'12px', marginBottom:'10px'}}>⚠️ {uploadError}</div>}
            <div style={{display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'flex-end'}}>
              <div>
                <label style={{display:'block', fontSize:'11px', color:'#888', marginBottom:'4px'}}>Nombre</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Instrucciones de uso MatriTablets"
                  style={{padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'13px', width:'260px'}}/>
              </div>
              <div>
                <label style={{display:'block', fontSize:'11px', color:'#888', marginBottom:'4px'}}>Categoría (opcional)</label>
                <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ej: Manual, Etiqueta, Guía" list="doc-categories"
                  style={{padding:'8px 10px', borderRadius:'7px', border:'1.5px solid #dde0d5', fontSize:'13px', width:'180px'}}/>
                <datalist id="doc-categories">
                  {[...new Set(docs.map(d => d.category).filter(Boolean))].map(c => <option key={c} value={c}/>)}
                </datalist>
              </div>
              <div>
                <label style={{display:'block', fontSize:'11px', color:'#888', marginBottom:'4px'}}>Archivo</label>
                <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} style={{fontSize:'12px'}}/>
              </div>
              <button className="btn-primary btn-sm" disabled={uploading} onClick={handleUpload}>{uploading ? 'Subiendo…' : 'Subir'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="alert info">{t('documents.notice')}</div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('documents.title')}</span>
          <span style={{fontSize:'12px', color:'var(--gray)'}}>{t('documents.count', { count: docs.length })}</span>
        </div>
        <div className="card-body" style={{padding:'8px 0'}}>
          {docs.length === 0 ? (
            <div style={{padding:'30px', textAlign:'center', color:'#888', fontSize:'13px'}}>No hay documentos disponibles todavía.</div>
          ) : docs.map((d,i) => (
            <div key={d.id}>
              <div style={{
                display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap',
                padding:'14px 18px',
                borderBottom: (i < docs.length-1 || replacingId === d.id) ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{flex:1, minWidth:'200px'}}>
                  <div style={{fontSize:'13px', fontWeight:700, color:'var(--navy)'}}>{d.name}</div>
                  <div style={{fontSize:'11px', color:'var(--gray)', marginTop:'2px'}}>
                    {d.category ? `${d.category} · ` : ''}{new Date(d.updated_at || d.created_at).toLocaleDateString('es-AR')}
                    {canManage && (
                      <> · {(assignedByDoc[d.id]?.size || 0) === 0 ? <span style={{color:'#b06a00'}}>sin asignar</span> : `asignado a ${assignedByDoc[d.id].size} distribuidor${assignedByDoc[d.id].size===1?'':'es'}`}</>
                    )}
                  </div>
                </div>
                <button className="btn-secondary btn-sm" onClick={() => handleDownload(d)}>{t('documents.download')}</button>
                {canManage && (
                  <>
                    <button className="btn-secondary btn-sm" onClick={() => setAssigningDoc(d)}>🔗 Asignar</button>
                    <button className="btn-secondary btn-sm" onClick={() => { setReplacingId(replacingId === d.id ? null : d.id); setReplaceError('') }}>✏️ Reemplazar archivo</button>
                    <button className="btn-secondary btn-sm" style={{color:'#8b2020'}} onClick={() => handleDelete(d)}>🗑️</button>
                  </>
                )}
              </div>
              {replacingId === d.id && (
                <div style={{padding:'12px 18px', background:'#fafaf8', borderBottom: i < docs.length-1 ? '1px solid var(--border)' : 'none', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap'}}>
                  <input type="file" onChange={e => e.target.files?.[0] && handleReplace(d, e.target.files[0])} style={{fontSize:'12px'}}/>
                  {replaceError && <span style={{color:'#8b2020', fontSize:'12px'}}>⚠️ {replaceError}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
