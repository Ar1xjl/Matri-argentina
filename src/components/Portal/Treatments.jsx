import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { pouchBreakdownDisplay } from '../../lib/dosing'
import { exportToExcel, filterRows } from '../../lib/tableTools'
import MatriSurePhotoModal from './MatriSurePhotoModal'
import FirmnessEvaluationModal from './FirmnessEvaluationModal'

// Supabase may embed a to-one relation as an object or a single-item array
// depending on FK inference — normalize to a plain object or null.
function matriSureOf(t) {
  const m = t.matrisure_verifications
  return Array.isArray(m) ? (m[0] ?? null) : (m ?? null)
}

function firmnessOf(t) {
  const f = t.firmness_evaluations
  return Array.isArray(f) ? (f[0] ?? null) : (f ?? null)
}

const productTag = (product) => (
  <span style={{
    background: product === 'powder' ? '#eef4c0' : '#e1f5ee',
    color: product === 'powder' ? '#4a6010' : '#0d7a5f',
    fontSize:'11px', fontWeight:700, padding:'3px 10px',
    borderRadius:'100px'
  }}>{product === 'powder' ? 'MatriPowder' : 'MatriTablets'}</span>
)

const STATUS_KEYS = {
  approved:  { cls:'approved',  key:'approved' },
  submitted: { cls:'pending',   key:'submitted' },
  applied:   { cls:'pending',   key:'applied' },
  completed: { cls:'confirmed', key:'completed' },
  rejected:  { cls:'rejected',  key:'rejected' },
  cancelled: { cls:'rejected',  key:'cancelled' },
}

export default function Treatments({ onNavigate, treatments = [], onGetPhotoUrl, onRepeat, onGetFirmnessPdfUrl }) {
  const { t } = useTranslation()
  const statusLabel = (status) => {
    const s = STATUS_KEYS[status]
    return s ? { cls: s.cls, label: t(`treatments.status.${s.key}`) } : { cls:'pending', label:status }
  }
  const [viewingPhoto, setViewingPhoto] = useState(null) // storage path, or null
  const [viewingFirmness, setViewingFirmness] = useState(null) // treatment row, or null
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({})

  const COLUMNS = [
    { header: t('treatments.columns.id'),      get: tr => `#${tr.id.slice(0,8)}` },
    { header: t('treatments.columns.room'),     get: tr => tr.cold_rooms?.name || '' },
    { header: t('treatments.columns.product'),  get: tr => tr.product === 'powder' ? 'MatriPowder' : 'MatriTablets' },
    { header: t('treatments.columns.sachets'),  get: tr => pouchBreakdownDisplay(tr) },
    { header: t('treatments.columns.price'),    get: tr => tr.price_local != null ? `${tr.price_currency || 'USD'} ${tr.price_local}` : '' },
    { header: t('treatments.columns.model'),    get: tr => tr.service_fee_local != null ? t('treatments.model.service') : t('treatments.model.own') },
    { header: t('treatments.columns.status'),   get: tr => statusLabel(tr.status).label },
  ]

  const filtered = filterRows(treatments, COLUMNS, filters)
  const setFilter = (header, value) => setFilters(prev => ({ ...prev, [header]: value }))

  return (
    <div>
      {viewingPhoto && (
        <MatriSurePhotoModal path={viewingPhoto} onGetPhotoUrl={onGetPhotoUrl} onClose={() => setViewingPhoto(null)} />
      )}

      {viewingFirmness && (
        <FirmnessEvaluationModal
          treatment={viewingFirmness}
          evaluation={firmnessOf(viewingFirmness)}
          canEdit={false}
          onGetPdfUrl={onGetFirmnessPdfUrl}
          onClose={() => setViewingFirmness(null)}
        />
      )}
      <div style={{display:'flex', gap:'10px', marginBottom:'16px'}}>
        <button className="btn-primary" onClick={() => onNavigate('calculator')}>
          {t('treatments.newTreatment')}
        </button>
        <button className="btn-secondary" onClick={() => setShowFilters(!showFilters)}>
          {showFilters ? t('treatments.hideFilters') : t('common.filter')}
        </button>
        <button className="btn-secondary" onClick={() => exportToExcel('tratamientos.xlsx', COLUMNS, filtered)}>
          {t('common.exportExcel')}
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('treatments.title')}</span>
          <span style={{fontSize:'12px', color:'var(--gray)'}}>{t('treatments.countOfTotal', { count: filtered.length, total: treatments.length })}</span>
        </div>
        <div style={{padding:0}}>
          {treatments.length === 0 ? (
            <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
              {t('treatments.empty')}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>
              {t('treatments.noFilterMatches')}
            </div>
          ) : (
            <div className="table-scroll"><table className="data-table">
              <thead>
                <tr>
                  <th>{t('treatments.columns.id')}</th><th>{t('treatments.columns.room')}</th><th>{t('treatments.columns.product')}</th>
                  <th>{t('treatments.columns.sachets')}</th><th>{t('treatments.columns.price')}</th><th>{t('treatments.columns.model')}</th>
                  <th>{t('treatments.columns.status')}</th><th></th>
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
                {filtered.map(tr => {
                  const s = statusLabel(tr.status)
                  const model = tr.service_fee_local != null ? t('treatments.model.service') : t('treatments.model.own')
                  const matriSure = matriSureOf(tr)
                  return (
                    <tr key={tr.id}>
                      <td style={{fontWeight:700, color:'var(--navy)'}}># {tr.id.slice(0,8)}</td>
                      <td>{tr.cold_rooms?.name}</td>
                      <td>{productTag(tr.product)}</td>
                      <td style={{fontFamily:'monospace', fontSize:'12px'}}>
                        {pouchBreakdownDisplay(tr)}
                      </td>
                      <td style={{fontWeight:700}}>{tr.price_local != null ? `${tr.price_currency || 'USD'} ${tr.price_local}` : '—'}</td>
                      <td>
                        <span style={{
                          background:'var(--cream-dark)', color:'var(--gray)',
                          fontSize:'11px', fontWeight:600, padding:'3px 10px',
                          borderRadius:'100px'
                        }}>{model}</span>
                      </td>
                      <td>
                        <span className={`status ${s.cls}`}>{s.label}</span>
                        {tr.status === 'rejected' && tr.rejection_reason && (
                          <div style={{fontSize:'11px', color:'#8b2020', marginTop:'4px', maxWidth:'180px'}}>
                            {tr.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{display:'flex', gap:'6px'}}>
                          {matriSure?.photo_url && (
                            <button className="btn-secondary btn-sm" onClick={() => setViewingPhoto(matriSure.photo_url)}>
                              {t('treatments.viewPhoto')}
                            </button>
                          )}
                          {firmnessOf(tr) && (
                            <button className="btn-secondary btn-sm" onClick={() => setViewingFirmness(tr)}>
                              {t('treatments.evaluation')}
                            </button>
                          )}
                          <button className="btn-secondary btn-sm" onClick={() => onRepeat(tr)}>{t('treatments.repeat')}</button>
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
