import { useTranslation } from 'react-i18next'
import { formatDate } from '../../lib/formatters'

export default function Dashboard({ onNavigate, treatments = [], myRoles = [] }) {
  const { t } = useTranslation()
  // Role-visibility backlog item (flagged 2026-08-11, scoped and built
  // 2026-08-25) — a "pure" Operador (has the role but not Owner/Aprobador
  // too) shouldn't see commercial figures here. Someone who holds Operador
  // *alongside* Owner/Aprobador (e.g. a small Customer's own owner who also
  // does the physical application) still sees everything, same as today.
  const isPureOperator = myRoles.includes('operator') && !myRoles.includes('owner') && !myRoles.includes('approver')

  // ── Real stats derived from shared treatments state ──────────────────
  const pending   = treatments.filter(t => t.status === 'submitted').length
  const approved  = treatments.filter(t => t.status === 'approved' || t.status === 'applied' || t.status === 'completed').length
  const totalUSD  = treatments
    .filter(t => t.status === 'approved' || t.status === 'applied' || t.status === 'completed')
    .reduce((s, t) => s + parseFloat(t.price_local || 0), 0)
  // Same "en curso" derivation as AppLog.jsx — started but not yet finished.
  const inProgress = treatments.filter(t => t.status === 'approved' && t.start_photo_url && !t.end_photo_url).length

  // Unique rooms that have been treated
  const activeRooms = [...new Set(treatments.map(t => t.cold_rooms?.name).filter(Boolean))].length

  const STATS = [
    { icon:'🏠', labelKey:'dashboard.stats.activeRooms', value:String(activeRooms) },
    { icon:'📦', labelKey:'dashboard.stats.pending',     value:String(pending) },
    { icon:'✅', labelKey:'dashboard.stats.approved',    value:String(approved) },
    isPureOperator
      ? { icon:'🔧', labelKey:'dashboard.stats.inProgress', value:String(inProgress) }
      : { icon:'💰', labelKey:'dashboard.stats.revenue',    value:`$${totalUSD.toFixed(0)}` },
  ]

  // Recent treatments — last 4
  const recentTreatments = [...treatments].slice(0, 4)

  // Rooms summary — unique rooms with last treatment status
  const roomMap = {}
  treatments.forEach(tr => {
    const roomName = tr.cold_rooms?.name
    if (!roomName) return
    if (!roomMap[roomName]) roomMap[roomName] = tr
    else if (new Date(tr.created_at) > new Date(roomMap[roomName].created_at)) roomMap[roomName] = tr
  })
  const roomSummary = Object.values(roomMap).slice(0, 3)

  const statusConfig = {
    approved:  { cls:'approved',  labelKey:'dashboard.status.approved',  color:'var(--lime)' },
    submitted: { cls:'pending',   labelKey:'dashboard.status.submitted', color:'var(--amber)' },
    applied:   { cls:'pending',   labelKey:'dashboard.status.applied',   color:'var(--amber)' },
    completed: { cls:'confirmed', labelKey:'dashboard.status.completed', color:'var(--lime)' },
    rejected:  { cls:'rejected',  labelKey:'dashboard.status.rejected',  color:'#e8736a' },
    cancelled: { cls:'rejected',  labelKey:'dashboard.status.cancelled', color:'#e8736a' },
  }

  const productTag = (product) => (
    <span style={{
      background: product === 'powder' ? '#eef4c0' : '#e1f5ee',
      color: product === 'powder' ? '#4a6010' : '#0d7a5f',
      fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'100px'
    }}>{product === 'powder' ? 'MatriPowder' : 'MatriTablets'}</span>
  )

  return (
    <div>
      {/* Stats */}
      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'24px'}}>
        {STATS.map((s, i) => (
          <div key={i} className="card" style={{marginBottom:0, position:'relative', overflow:'hidden'}}>
            <div style={{position:'absolute', top:0, left:0, right:0, height:'3px', background:'var(--lime)'}}/>
            <div style={{padding:'18px', position:'relative'}}>
              <div style={{position:'absolute', right:'14px', top:'14px', fontSize:'20px', opacity:.25}}>{s.icon}</div>
              <div style={{fontSize:'11px', fontWeight:700, color:'var(--gray)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'6px'}}>{t(`${s.labelKey}.label`)}</div>
              <div style={{fontSize:'26px', fontWeight:900, color:'var(--navy)', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:'11px', color:'var(--gray)', marginTop:'4px'}}>{t(`${s.labelKey}.unit`)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Alert if pending treatments */}
      {pending > 0 && (
        <div className="alert warn" style={{marginBottom:'16px'}}>
          {t('dashboard.pendingAlertPrefix')} <strong>{t('dashboard.pendingAlertCount', { count: pending })}</strong> {t('dashboard.pendingAlertSuffix')}
        </div>
      )}

      {/* Recent treatments */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('dashboard.recentTreatments.title')}</span>
          <button className="btn-secondary btn-sm" onClick={() => onNavigate('treatments')}>{t('dashboard.recentTreatments.viewAll')}</button>
        </div>
        {recentTreatments.length === 0 ? (
          <div style={{padding:'40px', textAlign:'center', color:'var(--gray)', fontSize:'13px'}}>
            {t('dashboard.recentTreatments.empty')}{' '}
            <span
              onClick={() => onNavigate('calculator')}
              style={{color:'var(--navy)', fontWeight:700, cursor:'pointer', textDecoration:'underline'}}
            >
              {t('dashboard.recentTreatments.createFirst')}
            </span>
          </div>
        ) : (
          <div style={{padding:0}} className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('dashboard.recentTreatments.columns.room')}</th>
                  <th>{t('dashboard.recentTreatments.columns.product')}</th>
                  {!isPureOperator && <th>{t('dashboard.recentTreatments.columns.price')}</th>}
                  <th>{t('dashboard.recentTreatments.columns.date')}</th>
                  <th>{t('dashboard.recentTreatments.columns.status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentTreatments.map((tr, i) => {
                  const s = statusConfig[tr.status] || statusConfig.submitted
                  return (
                    <tr key={i}>
                      <td style={{fontWeight:600}}>{tr.cold_rooms?.name}</td>
                      <td>{productTag(tr.product)}</td>
                      {!isPureOperator && <td style={{fontWeight:700}}>{tr.price_local != null ? `${tr.price_currency || 'USD'} ${tr.price_local}` : '—'}</td>}
                      <td style={{color:'var(--gray)'}}>{formatDate(tr.created_at)}</td>
                      <td><span className={`status ${s.cls}`}>{t(s.labelKey)}</span></td>
                      <td>
                        <button className="btn-secondary btn-sm" onClick={() => onNavigate('treatments')}>{t('dashboard.recentTreatments.columns.view')}</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rooms summary */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('dashboard.roomsSummary.title')}</span>
          <button className="btn-secondary btn-sm" onClick={() => onNavigate('rooms')}>{t('dashboard.roomsSummary.viewAll')}</button>
        </div>
        <div className="card-body">
          {roomSummary.length === 0 ? (
            <div style={{textAlign:'center', color:'var(--gray)', fontSize:'13px', padding:'20px 0'}}>
              {t('dashboard.roomsSummary.empty')}
            </div>
          ) : (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:'14px'}}>
              {roomSummary.map((tr, i) => {
                const s = statusConfig[tr.status] || statusConfig.submitted
                const pct = tr.status === 'completed' ? 100 : tr.status === 'approved' || tr.status === 'applied' ? 75 : 40
                return (
                  <div key={i} style={{background:'var(--white)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'16px'}}>
                    <div style={{fontSize:'14px', fontWeight:800, color:'var(--navy)', marginBottom:'3px'}}>{tr.cold_rooms?.name}</div>
                    <div style={{fontSize:'12px', color:'var(--gray)', marginBottom:'10px'}}>
                      {tr.product === 'powder' ? 'MatriPowder' : 'MatriTablets'}
                      {!isPureOperator && ` · ${tr.service_fee_local != null ? t('dashboard.roomsSummary.service') : t('dashboard.roomsSummary.own')}`}
                    </div>
                    <div style={{height:'3px', background:'var(--border)', borderRadius:'2px', margin:'8px 0'}}>
                      <div style={{height:'100%', width:`${pct}%`, background:s.color, borderRadius:'2px'}}/>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'11px', color:'var(--gray)'}}>
                      <span>{formatDate(tr.created_at)}</span>
                      <span className={`status ${s.cls}`} style={{fontSize:'10px'}}>{t(s.labelKey)}</span>
                    </div>
                  </div>
                )
              })}

              <div
                onClick={() => onNavigate('calculator')}
                style={{background:'var(--gray-lt)', border:'2px dashed var(--border)', borderRadius:'var(--radius)', padding:'16px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', minHeight:'100px'}}
              >
                <div style={{textAlign:'center', color:'var(--gray)'}}>
                  <div style={{fontSize:'28px'}}>＋</div>
                  <div style={{fontSize:'13px', fontWeight:700, marginTop:'4px'}}>{t('dashboard.roomsSummary.newTreatment')}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px'}}>
        {[
          { icon:'🧮', key:'calculator', action:'calculator' },
          { icon:'📋', key:'matrisure',  action:'applog' },
          { icon:'⚡', key:'generators', action:'generators' },
        ].map((item, i) => (
          <div
            key={i}
            onClick={() => onNavigate(item.action)}
            style={{background:'var(--white)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'18px', cursor:'pointer', transition:'box-shadow .2s'}}
            onMouseEnter={e => e.currentTarget.style.boxShadow='var(--shadow-md)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
          >
            <div style={{fontSize:'24px', marginBottom:'8px'}}>{item.icon}</div>
            <div style={{fontSize:'13px', fontWeight:700, color:'var(--navy)', marginBottom:'4px'}}>{t(`dashboard.quickActions.${item.key}.label`)}</div>
            <div style={{fontSize:'12px', color:'var(--gray)'}}>{t(`dashboard.quickActions.${item.key}.desc`)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
