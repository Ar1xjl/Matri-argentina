import { useState, useEffect } from 'react'
import RoomHistory from './RoomHistory'
import { supabase } from '../../lib/supabaseClient'
import { exportToExcel, filterRows } from '../../lib/tableTools'

const statusLabel = (status) => ({
  approved:  { cls:'approved',  label:'Activa' },
  submitted: { cls:'pending',   label:'Pendiente' },
  applied:   { cls:'pending',   label:'Aplicado' },
  completed: { cls:'confirmed', label:'MatriSure OK' },
  rejected:  { cls:'rejected',  label:'Rechazado' },
  cancelled: { cls:'rejected',  label:'Cancelado' },
}[status] || null)

export default function Rooms({ coldRooms = [], treatments = [], onAddRoom, onDeleteRoom, profile }) {
  const [showForm, setShowForm] = useState(false)
  const [historyRoom, setHistoryRoom] = useState(null)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [volume, setVolume] = useState('')
  const [crop, setCrop] = useState('Manzanas')
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
    if (isDistributorView && !targetOrgId) { setFormError('Elegí a qué cliente pertenece la cámara.'); return }
    setFormError('')
    const res = await onAddRoom({ name, location, volume_m3: Number(volume), primary_crop: crop }, isDistributorView ? targetOrgId : undefined)
    if (res?.error) { setFormError(res.error); return }
    setName(''); setLocation(''); setVolume(''); setCrop('Manzanas')
    setShowForm(false)
  }

  const handleDelete = async (room) => {
    setDeleteError('')
    const res = await onDeleteRoom(room.id)
    if (res?.error) setDeleteError(res.error)
  }

  const COLUMNS = [
    ...(isDistributorView ? [{ header: 'Cliente', get: r => r.organizations?.name || '' }] : []),
    { header: 'Ubicación', get: r => r.location || '' },
    { header: 'Cámara',    get: r => r.name || '' },
    { header: 'Volumen (m³)', get: r => r.volume_m3 ?? '' },
    { header: 'Cultivo',   get: r => r.primary_crop || '' },
    { header: 'Último trat.', get: r => { const last = lastTreatmentByRoom[r.id]; return last ? new Date(last.created_at).toLocaleDateString('es-AR') : '' } },
    { header: 'Estado',    get: r => { const last = lastTreatmentByRoom[r.id]; return last ? (statusLabel(last.status)?.label || '') : '' } },
  ]

  const filtered = filterRows(coldRooms, COLUMNS, filters)
  const setFilter = (header, value) => setFilters(prev => ({ ...prev, [header]: value }))

  return (
    <div>
      <div className="alert info">
        ℹ️ Las cámaras se guardan automáticamente con el primer tratamiento, o podés agregarlas manualmente.
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Frigoríficos y Cámaras</span>
          <div style={{display:'flex', gap:'8px'}}>
            <button className="btn-secondary btn-sm" onClick={() => setShowFilters(!showFilters)}>{showFilters ? '✕ Filtros' : 'Filtrar'}</button>
            <button className="btn-secondary btn-sm" onClick={() => exportToExcel('camaras.xlsx', COLUMNS, filtered)}>⬇ Exportar a Excel</button>
            <button className="btn-lime btn-sm" onClick={() => setShowForm(!showForm)}>
              {showForm ? '✕ Cancelar' : '+ Nueva cámara'}
            </button>
          </div>
        </div>

        {showForm && (
          <div style={{padding:'20px', borderBottom:'1px solid var(--border)', background:'var(--gray-lt)'}}>
            <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px'}}>
              {isDistributorView && (
                <div className="form-field">
                  <label>Cliente</label>
                  <select value={targetOrgId} onChange={e => setTargetOrgId(e.target.value)}>
                    {customerOrgs.length === 0 && <option value="">No hay clientes todavía</option>}
                    {customerOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-field">
                <label>Nombre de la cámara</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Cámara Norte 3"/>
              </div>
              <div className="form-field">
                <label>Ubicación / establecimiento</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ej: Est. San José"/>
              </div>
              <div className="form-field">
                <label>Volumen (m³)</label>
                <input type="number" value={volume} onChange={e => setVolume(e.target.value)} placeholder="Ej: 450"/>
              </div>
              <div className="form-field">
                <label>Cultivo principal</label>
                <select value={crop} onChange={e => setCrop(e.target.value)}>
                  <option>Manzanas</option>
                  <option>Peras</option>
                  <option>Kiwi</option>
                  <option>Otro</option>
                </select>
              </div>
              <div className="form-field" style={{display:'flex', alignItems:'flex-end'}}>
                <button className="btn-primary" style={{width:'100%'}} onClick={handleSave}>Guardar cámara</button>
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
              {coldRooms.length === 0 ? 'No hay cámaras cargadas todavía.' : 'Ninguna cámara coincide con los filtros aplicados.'}
            </div>
          ) : (
            <div className="table-scroll"><table className="data-table">
              <thead>
                <tr>
                  {isDistributorView && <th>Cliente</th>}
                  <th>Ubicación</th><th>Cámara</th><th>Volumen (m³)</th>
                  <th>Cultivo</th><th>Último trat.</th><th>Estado</th><th></th>
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
                      <td style={{color:'var(--gray)'}}>{last ? new Date(last.created_at).toLocaleDateString('es-AR') : '—'}</td>
                      <td>{s ? <span className={`status ${s.cls}`}>{s.label}</span> : '—'}</td>
                      <td>
                        <div style={{display:'flex', gap:'6px'}}>
                          <button className="btn-secondary btn-sm" onClick={() => setHistoryRoom(r.name)}>
                            🕒 Historial
                          </button>
                          <button className="btn-secondary btn-sm" onClick={() => handleDelete(r)}>
                            ✕ Eliminar
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
