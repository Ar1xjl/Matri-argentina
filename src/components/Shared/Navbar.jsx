import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import logoImg from '../../assets/logos/MatriPowder_Logo.svg'
import LanguageSwitcher from './LanguageSwitcher'

export default function Navbar({ onOpenModal }) {
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const openModal = (tab) => {
    setMobileOpen(false)
    onOpenModal(tab)
  }

  return (
    <div>
      <div style={{
        background: '#072e3d', color: '#90b8c8',
        fontSize: '12px', textAlign: 'center', padding: '6px 12px'
      }}>
        {t('navbar.announcement')}
      </div>

      <nav style={{
        background: 'white', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '12px 20px',
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid #dde0d5',
        boxShadow: '0 1px 8px rgba(0,0,0,.06)'
      }}>
        <img src={logoImg} alt="MaTri" style={{height: '36px'}} />

        <div className="navbar-links">
          <span style={{fontSize:'15px', fontWeight:500, color:'#0b4358', cursor:'pointer'}}>
            {t('navbar.products')}
          </span>
          <span style={{fontSize:'15px', fontWeight:500, color:'#0b4358', cursor:'pointer'}}>
            {t('navbar.howItWorks')}
          </span>
          <span
            style={{fontSize:'15px', fontWeight:500, color:'#0b4358', cursor:'pointer'}}
            onClick={() => openModal('register')}
          >
            {t('navbar.requestAccess')}
          </span>
          <LanguageSwitcher />
          <button
            onClick={() => openModal('login')}
            style={{
              background: '#e05a4e', color: 'white', border: 'none',
              padding: '10px 22px', borderRadius: '6px',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            {t('navbar.login')}
          </button>
        </div>

        <button
          className="navbar-hamburger"
          onClick={() => setMobileOpen(v => !v)}
          aria-label={t('navbar.openMenu')}
          style={{
            background: 'none', border: 'none', fontSize: '26px',
            color: '#0b4358', cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
            width: '40px', height: '40px'
          }}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </nav>

      <div className={`navbar-mobile-menu${mobileOpen ? ' open' : ''}`}>
        <span style={{fontSize:'15px', fontWeight:500, color:'#0b4358', cursor:'pointer', padding:'10px 0'}}>
          {t('navbar.products')}
        </span>
        <span style={{fontSize:'15px', fontWeight:500, color:'#0b4358', cursor:'pointer', padding:'10px 0'}}>
          {t('navbar.howItWorks')}
        </span>
        <span
          style={{fontSize:'15px', fontWeight:500, color:'#0b4358', cursor:'pointer', padding:'10px 0'}}
          onClick={() => openModal('register')}
        >
          {t('navbar.requestAccess')}
        </span>
        <div style={{padding:'10px 0'}}>
          <LanguageSwitcher />
        </div>
        <button
          onClick={() => openModal('login')}
          style={{
            background: '#e05a4e', color: 'white', border: 'none',
            padding: '10px 22px', borderRadius: '6px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            marginTop: '8px', width: '100%'
          }}
        >
          {t('navbar.login')}
        </button>
      </div>
    </div>
  )
}
