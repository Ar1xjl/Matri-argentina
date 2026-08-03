import { useTranslation } from 'react-i18next'
import Navbar from '../Shared/Navbar'
import powderImg   from '../../assets/images/MatriPowder.png'
import tabletsImg  from '../../assets/images/MatriTablets.png'
import generatorImg from '../../assets/images/MatriGenerator.png'
import sureImg     from '../../assets/images/MatriSure_Kit.png'
import powderLogo   from '../../assets/logos/MatriPowder_Logo.svg'
import tabletsLogo  from '../../assets/logos/MatriTablets_Logo.svg'
import generatorLogo from '../../assets/logos/MatriGenerator_Logo.svg'
import sureLogo     from '../../assets/logos/MatriSure_Logo.png'

const PRODUCTS = [
  { key: 'powder',    img: powderImg,    logo: powderLogo },
  { key: 'tablets',   img: tabletsImg,   logo: tabletsLogo },
  { key: 'generator', img: generatorImg, logo: generatorLogo },
  { key: 'sure',      img: sureImg,      logo: sureLogo },
]

const STEPS = ['step1', 'step2', 'step3']

const FEATURES = [
  { icon: '🎯', key: 'exactDose' },
  { icon: '⏱️', key: 'savesTime' },
  { icon: '✅', key: 'easyToUse' },
  { icon: '🛡️', key: 'traceability' },
]

export default function Landing({ onOpenModal }) {
  const { t } = useTranslation()

  return (
    <div>
      <Navbar onOpenModal={onOpenModal} />

      {/* Hero band */}
      <div style={{background:'#c8d84a', textAlign:'center', padding:'28px 20px 22px'}}>
        <h1 style={{fontSize:'clamp(24px,4vw,42px)', fontWeight:900, color:'#0b4358',
          letterSpacing:'.02em', textTransform:'uppercase'}}>
          {t('landing.hero.title')}
        </h1>
        <p style={{fontSize:'16px', color:'#0b4358', marginTop:'6px', opacity:.8}}>
          {t('landing.hero.subtitle')}
        </p>
      </div>

      {/* Hero image section */}
      <div className="hero-image-section" style={{
        position:'relative',
        background:'linear-gradient(to right, #f5f2eb 42%, #d0dba8 100%)'
      }}>
        <div className="hero-text" style={{zIndex:2, position:'relative'}}>
          <h2 style={{fontSize:'clamp(22px,3.5vw,36px)', fontWeight:900,
            color:'#0b4358', lineHeight:1.15, marginBottom:'14px'}}>
            {t('landing.heroImage.titleLine1')}<br/>{t('landing.heroImage.titleLine2')}
          </h2>
          <p style={{fontSize:'15px', color:'#6b7280', lineHeight:1.6, marginBottom:'24px'}}>
            {t('landing.heroImage.description')}
          </p>
          <div style={{display:'flex', flexWrap:'wrap', gap:'16px'}}>
            {FEATURES.map(f => (
              <div key={f.key} style={{display:'flex', alignItems:'center', gap:'8px',
                fontSize:'12px', fontWeight:700, color:'#0b4358'}}>
                <div style={{width:'36px', height:'36px', border:'2px solid #0b4358',
                  borderRadius:'50%', display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:'14px'}}>{f.icon}</div>
                <strong>{t(`landing.heroImage.features.${f.key}`)}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="hero-product-grid-wrap" style={{display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', width:'100%', maxWidth:'380px'}}>
            {PRODUCTS.map(p => (
              <div key={p.key} style={{
                background:'white', borderRadius:'10px', padding:'14px',
                boxShadow:'0 2px 12px rgba(11,67,88,.10)',
                display:'flex', flexDirection:'column', alignItems:'center', gap:'8px'
              }}>
                <img src={p.img} alt="" style={{width:'100%', height:'90px', objectFit:'contain'}}/>
                <img src={p.logo} alt="" style={{height:'22px', objectFit:'contain'}}/>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Badge + title */}
      <div className="section-pad" style={{padding:'56px 40px 20px', textAlign:'center'}}>
        <div style={{
          display:'inline-block', border:'1.5px solid #a8c832', color:'#0b4358',
          fontSize:'11px', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase',
          padding:'6px 18px', borderRadius:'100px'
        }}>
          {t('landing.badge.protection')}
        </div>
        <h2 style={{fontSize:'clamp(20px,3vw,32px)', fontWeight:900, color:'#0b4358',
          margin:'12px 0 8px'}}>
          {t('landing.section2.title')}
        </h2>
        <p style={{fontSize:'15px', color:'#6b7280', maxWidth:'540px', margin:'0 auto'}}>
          {t('landing.section2.description')}
        </p>
      </div>

      {/* Products */}
      <div className="section-pad" style={{padding:'32px 40px'}}>
        <div className="products-grid">
          {PRODUCTS.map(p => (
            <div key={p.key} style={{
              background:'white', border:'1.5px solid #dde0d5', borderRadius:'10px',
              padding:'24px 20px 20px', display:'flex', flexDirection:'column',
              alignItems:'center', textAlign:'center',
              transition:'box-shadow .2s, transform .2s'
            }}>
              <img src={p.img} alt="" style={{width:'100%', height:'120px', objectFit:'contain', marginBottom:'14px'}}/>
              <img src={p.logo} alt="" style={{height:'28px', objectFit:'contain', marginBottom:'10px'}}/>
              <p style={{fontSize:'12.5px', color:'#6b7280', lineHeight:1.6, flex:1}}>{t(`landing.products.${p.key}.desc`)}</p>
              <div style={{
                background:'#eef4c0', color:'#0b4358', fontSize:'10px', fontWeight:700,
                padding:'3px 10px', borderRadius:'100px', marginTop:'12px',
                letterSpacing:'.06em', textTransform:'uppercase'
              }}>{t(`landing.products.${p.key}.tag`)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="section-pad" style={{background:'#ece8df', padding:'56px 40px', textAlign:'center'}}>
        <div style={{
          display:'inline-block', border:'1.5px solid #a8c832', color:'#0b4358',
          fontSize:'11px', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase',
          padding:'6px 18px', borderRadius:'100px', marginBottom:'14px'
        }}>{t('landing.howItWorks.badge')}</div>
        <h2 style={{fontSize:'clamp(20px,3vw,30px)', fontWeight:900, color:'#0b4358', marginBottom:'8px'}}>
          {t('landing.howItWorks.title')}
        </h2>
        <p style={{fontSize:'15px', color:'#6b7280', maxWidth:'540px', margin:'0 auto 36px'}}>
          {t('landing.howItWorks.description')}
        </p>
        <div className="steps-row">
          {STEPS.map((stepKey, i) => (
            <div key={stepKey} style={{flex:1, textAlign:'center', padding:'24px 20px', position:'relative'}}>
              {i < STEPS.length - 1 && (
                <div className="step-arrow" style={{position:'absolute', right:'-10px', top:'34px',
                  fontSize:'22px', color:'#a8c832', fontWeight:900}}>→</div>
              )}
              <div style={{
                width:'52px', height:'52px', background:'#0b4358', color:'white',
                borderRadius:'50%', display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:'20px', fontWeight:900, margin:'0 auto 14px'
              }}>{i + 1}</div>
              <h3 style={{fontSize:'14px', fontWeight:700, color:'#0b4358', marginBottom:'6px'}}>{t(`landing.howItWorks.${stepKey}.title`)}</h3>
              <p style={{fontSize:'13px', color:'#6b7280', lineHeight:1.5}}>{t(`landing.howItWorks.${stepKey}.desc`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="cta-pad" style={{background:'#c8d84a', textAlign:'center', padding:'52px 40px'}}>
        <h2 style={{fontSize:'clamp(20px,3vw,30px)', fontWeight:900, color:'#0b4358', marginBottom:'12px'}}>
          {t('landing.cta.title')}
        </h2>
        <p style={{fontSize:'15px', color:'#0b4358', opacity:.75, marginBottom:'28px'}}>
          {t('landing.cta.subtitle')}
        </p>
        <div style={{display:'flex', flexWrap:'wrap', gap:'12px', justifyContent:'center'}}>
          <button onClick={() => onOpenModal('register')} style={{
            background:'#e05a4e', color:'white', border:'none',
            padding:'14px 36px', borderRadius:'8px', fontSize:'16px',
            fontWeight:700, cursor:'pointer'
          }}>{t('landing.cta.requestAccess')}</button>
          <button onClick={() => onOpenModal('login')} style={{
            background:'transparent', color:'#0b4358', border:'2px solid #0b4358',
            padding:'14px 36px', borderRadius:'8px', fontSize:'16px',
            fontWeight:700, cursor:'pointer'
          }}>{t('landing.cta.haveAccount')}</button>
        </div>
      </div>

      <footer className="section-pad" style={{background:'#072e3d', color:'#607080', textAlign:'center', padding:'24px 40px', fontSize:'12px'}}>
        {t('landing.footer')}
      </footer>
    </div>
  )
}
