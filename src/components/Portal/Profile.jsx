import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'

export default function Profile({ profile }) {
  const { t } = useTranslation()
  const orgId = profile?.org_id
  const [loading, setLoading] = useState(true)
  const [orgName, setOrgName] = useState('')
  const [form, setForm] = useState({ tax_id: '', tax_status: '', region: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!orgId) return
    supabase.from('organizations').select('name, tax_id, tax_status, region').eq('id', orgId).single().then(({ data }) => {
      if (data) {
        setOrgName(data.name || '')
        setForm({ tax_id: data.tax_id || '', tax_status: data.tax_status || '', region: data.region || '' })
      }
      setLoading(false)
    })
  }, [orgId])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase.from('organizations').update({
      tax_id: form.tax_id.trim() || null,
      tax_status: form.tax_status.trim() || null,
      region: form.region.trim() || null,
    }).eq('id', orgId)
    setSaving(false)
    if (!error) setSaved(true)
  }

  const FIELDS = [
    ['tax_id', t('profile.company.taxId'), t('profile.company.taxIdPlaceholder')],
    ['tax_status', t('profile.company.taxStatus'), t('profile.company.taxStatusPlaceholder')],
    ['region', t('profile.company.region'), t('profile.company.regionPlaceholder')],
  ]

  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>

      {/* Company data — CUIT/Situación Fiscal/Región ya no se piden en el alta
          pública (varían por país); el propio dueño de la cuenta los completa
          acá, en texto libre, una vez que su organización ya existe. */}
      <div className="card" style={{marginBottom:0}}>
        <div className="card-header"><span className="card-title">{t('profile.company.title')}</span></div>
        <div className="card-body">
          {loading ? (
            <div style={{padding:'12px 0', color:'#888', fontSize:'13px'}}>{t('common.loading')}</div>
          ) : (
            <>
              <div className="form-field">
                <label>{t('profile.company.name')}</label>
                <input defaultValue={orgName} readOnly style={{background:'var(--gray-lt)', color:'var(--gray)'}} />
              </div>
              {FIELDS.map(([key, label, placeholder]) => (
                <div key={key} className="form-field">
                  <label>{label}</label>
                  <input
                    value={form[key]}
                    placeholder={placeholder}
                    onChange={e => { setForm({ ...form, [key]: e.target.value }); setSaved(false) }}
                  />
                </div>
              ))}
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? t('common.saving') : t('profile.company.save')}
              </button>
              {saved && <div style={{fontSize:'12px', color:'#1a6b30', marginTop:'8px'}}>{t('profile.company.saved')}</div>}
            </>
          )}
        </div>
      </div>

      {/* Password */}
      <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-header"><span className="card-title">{t('profile.password.title')}</span></div>
          <div className="card-body">
            {[
              [t('profile.password.current'),   'password', '••••••••'],
              [t('profile.password.new'),    'password', '••••••••'],
              [t('profile.password.confirm'),'password', '••••••••'],
            ].map(([label, type, ph]) => (
              <div key={label} className="form-field">
                <label>{label}</label>
                <input type={type} placeholder={ph}/>
              </div>
            ))}
            <button className="btn-primary">{t('profile.password.update')}</button>
          </div>
        </div>

        <div className="alert info">
          {t('profile.password.forgotHint')}
        </div>

        {/* Account info */}
        <div className="card" style={{marginBottom:0}}>
          <div className="card-header"><span className="card-title">{t('profile.accountInfo.title')}</span></div>
          <div className="card-body">
            {[
              [t('profile.accountInfo.distributor'), 'Wassington'],
              [t('profile.accountInfo.region'),               'Río Negro, Argentina'],
              [t('profile.accountInfo.memberSince'),        'Junio 2026'],
              [t('profile.accountInfo.lastAccess'),        'Hoy, 11:30 hs'],
            ].map(([label, value]) => (
              <div key={label} style={{
                display:'flex', justifyContent:'space-between',
                padding:'8px 0', borderBottom:'1px solid var(--border)',
                fontSize:'13px'
              }}>
                <span style={{color:'var(--gray)'}}>{label}</span>
                <span style={{fontWeight:600, color:'var(--navy)'}}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
