import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// Simplified to what the real `treatments` schema actually persists today.
// Generator selection is intentionally left out — Generators.jsx is still
// mock data (no real generator rows exist yet to choose from). Maturity
// parameters (firmness/brix/IEC) aren't modeled on Treatment yet either —
// see the Treatment Evaluation feature idea on hold, per project memory.
// "YYYY-MM-DDTHH:MM" in local time, for pre-filling <input type="datetime-local">
function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

// mode='start': just the Inicio time, shown when the operator places the kit
// in the Cold Room. mode='end': just the Fin time, shown separately later —
// often 12-30h afterward — when they come back to close out the
// application. A single combined start+end form doesn't match how long a
// real application actually takes (Juan, 2026-07-31).
export default function ApplicationForm({ treatment, operatorName, mode, onSave, onCancel }) {
  const { t } = useTranslation()
  const [time,   setTime]   = useState(nowLocal())
  const [saving, setSaving] = useState(false)

  const card  = {background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'24px', marginBottom:'16px'}
  const label = {display:'block', fontSize:'13px', fontWeight:500, color:'#0b4358', marginBottom:'5px'}
  const inp   = {width:'100%', padding:'10px 12px', borderRadius:'8px', border:'0.5px solid #ccc', fontSize:'14px', color:'#0b4358', background:'#fafaf8', fontFamily:'inherit'}

  const timeLabel = mode === 'start' ? t('applicationForm.startTimeLabel') : t('applicationForm.endTimeLabel')
  const heading   = mode === 'start' ? t('applicationForm.startHeading') : t('applicationForm.endHeading')

  const handleSave = async () => {
    setSaving(true)
    await onSave(mode === 'start' ? { startTime: time } : { endTime: time })
    setSaving(false)
  }

  return (
    <div style={{maxWidth:'600px'}}>

      {treatment && (
        <div className="alert info">
          {t('applicationForm.contextLine', {
            heading,
            room: treatment.cold_rooms?.name,
            product: treatment.product === 'powder' ? 'MatriPowder' : 'MatriTablets',
            id: treatment.id.slice(0,8),
          })}
        </div>
      )}

      <div style={card}>
        <div style={{fontSize:'15px', fontWeight:700, color:'#0b4358', marginBottom:'16px'}}>
          {t('applicationForm.treatmentData')}
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={label}>{t('applicationForm.doseLabel')}</label>
          <input style={{...inp, background:'#f0f0ec', color:'#888'}} value={treatment?.target_dose_ppb ?? ''} disabled/>
          <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>
            {t('applicationForm.doseHint')}
          </div>
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={label}>{t('applicationForm.operatorLabel')}</label>
          <input style={{...inp, background:'#f0f0ec', color:'#888'}} value={operatorName || ''} disabled/>
          <div style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>
            {t('applicationForm.operatorHint')}
          </div>
        </div>

        <div>
          <label style={label}>{timeLabel}</label>
          <input style={inp} type="datetime-local" value={time} onChange={e => setTime(e.target.value)}/>
        </div>

        {mode === 'start' && (
          <div style={{fontSize:'11px', color:'#b06a00', marginTop:'12px'}}>
            {t('applicationForm.generatorNotAvailable')}
          </div>
        )}
      </div>

      <div style={{display:'flex', gap:'10px'}}>
        <button className="btn-primary" style={{flex:1, opacity: saving ? .6 : 1}} onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : t('applicationForm.continueToPhoto')}
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
