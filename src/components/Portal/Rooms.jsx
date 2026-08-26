import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import RoomHistory from './RoomHistory'
import { supabase } from '../../lib/supabaseClient'
import { exportToExcel, filterRows } from '../../lib/tableTools'
import { formatDate } from '../../lib/formatters'
import { CROP_OPTIONS } from '../../lib/crops'

const STATUS_KEYS = {
  approved:  { cls:'approved',  key:'approved' },
  submitted: { cls:'pending',   key:'submitted' },
  applied:   { cls:'pending',   key:'applied' },
  completed: { cls:'confirmed', key:'completed' },
  rejected:  { cls:'rejected',  key:'rejected' },
  cancelled: { cls:'rejected',  key:'cancelled' },
}

export default function Rooms({ coldRooms = [], treatments = [], onAddRoom, onDeleteRoom, profile }) {
  const { t } = useTranslation()
  const statusLabel = (status) => {
    const s = STATUS_KEYS[status]
    return s ? { cls: s.cls, label: t(`rooms.status.${s.key}`) } : null
  }
  const [showForm, setShowForm] = useState(false)
  const [historyRoom, setHistoryRoom] = useState(null)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [volume, setVolume] = useState('')
  const [crop, setCrop] = useState('Manzana')
  const [targetOrgId, setTargetOrgId] = useState('')
  const [customerOrgs, setCustomerOrgs] = useState([])
  const [formError, setFormError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({})

  const isDistributorView = profile?.organizations?.org_type !== 'customer'

  // Distributor/Sub-distributor/Global picks which Customer a new room
  // belongs to — RLS already scopes this to their own subtree.
  useEffect(() => {
    if (!isDistributorView) return
    supabase.from('organizations').select('*').eq('org_type', 'customer').then(({ data }) => {
      setCustomerOrgs(data || [])
      if (data?.length > 0) setTargetOrgId(data[0].id)
    })
  }, [isDistributorView])

  if (historyRoom) {
    return (
      <RoomHistory
        roomName={historyRoom}
        onClose={() => setHistoryRoom(null)}
      />
    )
  }

  // Last treatment per Cold Room, for the "último trat." / estado columns
  const lastTreatmentByRoom = {}
  treatments.forEach(t => {
    const roomId = t.cold_room_id
    if (!roomId) return
    if (!lastTreatmentByRoom[roomId] || new Date(t.created_at) > new Date(lastTreatmentByRoom[roomId].created_at)) {
      lastTreatmentByRoom[roomId] = t
    }
  })

  const handleSave = async () => {
    if (!name || !volume) return
    if (isDistributorView && !targetOrgId) { setFormError(t('rooms.form.customerRequired')); return }
    setFormError('')
    const res = await onAddRoom({ name, location, volume_m3: Number(volume), primary_crop: crop }, isDistributorView ? targetOrgId : undefined)
    if (res?.error) { setFormError(res.error); return }
    setName(''); setLocation(''); setVolume(''); setCrop('Manzana')
    setShowForm(false)
  }

  const handleDelete = async (room) => {
    setDeleteError('')
    const res = await onDeleteRoom(room.id)
    if (res?.error) setDeleteError(res.error)
  }

  const COLUMNS = [
    ...(isDistributorView ? [{ header: t('rooms.columns.customer'), get: r => r.organizations?.name || '' }] : []),
    { header: t('rooms.columns.location'), get: r => r.location || '' },
    { header: t('rooms.columns.room'),    get: r => r.name || '' },
    { header: t('rooms.columns.volume'), get: r => r.volume_m3 ?? '' },
    { header: t('rooms.columns.crop'),   get: r => r.primary_crop || '' },
    { header: t('rooms.columns.lastTreatment'), get: r => { const last = lastTreatmentByRoom[r.id]; return last ? formatDate(last.created_at) : '' } },
    { header: t('rooms.columns.status'),    get: r => { const last = lastTreatmentByRoom[r.id]; return last ? (statusLabel(last.status)?.label || '') : '' } },
  ]

  const filtered = filterRows(coldRooms, COLUMNS, filters)
  const setFilter = (header, value) => setFilters(prev => ({ ...prev, [header]: value }))

  return (
    <div>
      <div className="alert info">
        {t('rooms.autoSaveHint')}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('sidebar.nav.rooms')}</span>
          <div style={{display:'flex', gap:'8px'}}>
            <button className="btn-secondary btn-sm" onClick={() => setShowFilters(!showFilters)}>{showFilters ? t('common.closeFilters') : t('common.filter')}</button>
            <button className="btn-secondary btn-sm" onClick={() => exportToExcel('camaras.xlsx', COLUMNS, filtered)}>{t('common.exportExcel')}</button>
            <button className="btn-lime btn-sm" onClick={() => setShowForm(!showForm)}>
              {showForm ? t('common.cancel') : t('rooms.newRoom')}
            </button>
          </div>
        </div>

        {showForm && (
          <div style={{padding:'20px', borderBottom:'1px solid var(--border)', background:'var(--gray-lt)'}}>
            <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px'}}>
              {isDistributorView && (
                <div className="form-field">
                  <label>{t('rooms.columns.customer')}</label>
                  <select value={targetOrgId} onChange={e => setTargetOrgId(e.target.value)}>
                    {customerOrgs.length === 0 && <option value="">{t('rooms.form.noCustomers')}</option>}
                    {customerOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-field">
                <label>{t('rooms.form.nameLabel')}</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={t('rooms.form.namePlaceholder')}/>
              </div>
              <div className="form-field">
                <label>{t('rooms.form.locationLabel')}</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder={t('rooms.form.locationPlaceholder')}/>
              </div>
              <div className="form-field">
                <label>{t('rooms.columns.volume')}</label>
                <input type="number" value={volume} onChange={e => setVolume(e.target.value)} placeholder="Ej: 450"/>
              </div>
              <div className="form-field">
                <label>{t('rooms.form.cropLabel')}</label>
                <input list="rooms-crop-options" value={crop} onChange={e => setCrop(e.target.value)} placeholder={t('rooms.form.cropLabel')}/>
                <datalist id="rooms-crop-options">
                  {CROP_OPTIONS.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="form-field" style={{display:'flex', alignItems:'flex-end'}}>
                <button className="btn-primary" style={{width:'100%'}} onClick={handleSave}>{t('rooms.form.save')}</button>
              </div>
            </div>
            {formError && <div style={{color:'#8b2020', fontSize:'12px', marginTop:'10px'}}>{formError}</div>}
          </div>
        )}

        {deleteError && (
          <div style={{padding:'10px 20px', color:'#8b2020', fontSize:'12px', background:'#fdeaea'}}>⚠️ {deleteError}</div>
        )}

        <div style={{padding:0}}>
          {filtered.length === 0 ? (
            <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
              {coldRooms.length === 0 ? t('rooms.empty') : t('rooms.noFilterMatches')}
            </div>
          ) : (
            <div className="table-scroll"><table className="data-table">
              <thead>
                <tr>
                  {isDistributorView && <th>{t('rooms.columns.customer')}</th>}
                  <th>{t('rooms.columns.location')}</th><th>{t('rooms.columns.room')}</th><th>{t('rooms.columns.volume')}</th>
                  <th>{t('rooms.columns.crop')}</th><th>{t('rooms.columns.lastTreatment')}</th><th>{t('rooms.columns.status')}</th><th></th>
                </tr>
                {showFilters && (
                  <tr>
                    {COLUMNS.map(c => (
                      <th key={c.header} style={{padding:'4px 8px'}}>
                        <input
                          value={filters[c.header] || ''}
                          onChange={e => setFilter(c.header, e.target.value)}
                          placeholder={t('common.filterPlaceholder')}
                          style={{width:'100%', padding:'5px 7px', borderRadius:'6px', border:'0.5px solid #ccc', fontSize:'12px', fontWeight:400}}
                        />
                      </th>
                    ))}
                    <th></th>
                  </tr>
                )}
              </thead>
              <tbody>
                {filtered.map(r => {
                  const last = lastTreatmentByRoom[r.id]
                  const s = last ? statusLabel(last.status) : null
                  return (
                    <tr key={r.id}>
                      {isDistributorView && <td style={{color:'var(--gray)'}}>{r.organizations?.name || '—'}</td>}
                      <td style={{color:'var(--gray)'}}>{r.location || '—'}</td>
                      <td style={{fontWeight:700}}>{r.name}</td>
                      <td>{r.volume_m3} m³</td>
                      <td>{r.primary_crop || '—'}</td>
                      <td style={{color:'var(--gray)'}}>{last ? formatDate(last.created_at) : '—'}</td>
                      <td>{s ? <span className={`status ${s.cls}`}>{s.label}</span> : '—'}</td>
                      <td>
                        <div style={{display:'flex', gap:'6px'}}>
                          <button className="btn-secondary btn-sm" onClick={() => setHistoryRoom(r.name)}>
                            {t('rooms.history')}
                          </button>
                          <button className="btn-secondary btn-sm" onClick={() => handleDelete(r)}>
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </div>
  )
}
