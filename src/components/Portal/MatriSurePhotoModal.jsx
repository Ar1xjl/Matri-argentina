import { useState, useEffect } from 'react'

export default function MatriSurePhotoModal({ path, onGetPhotoUrl, onClose }) {
  const [url,   setUrl]   = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    (async () => {
      const signedUrl = await onGetPhotoUrl(path)
      if (signedUrl) setUrl(signedUrl)
      else setError(true)
    })()
  }, [path, onGetPhotoUrl])

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{position:'fixed', inset:0, background:'rgba(7,46,61,.7)', backdropFilter:'blur(4px)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center'}}
    >
      <div style={{background:'#fff', borderRadius:'14px', padding:'20px', maxWidth:'480px', width:'100%'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#0b4358'}}>Foto MatriSure</span>
          <button onClick={onClose} style={{background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#6b7280'}}>✕</button>
        </div>
        {error && <div style={{color:'#8b2020', fontSize:'13px'}}>No se pudo cargar la foto.</div>}
        {!error && !url && <div style={{fontSize:'13px', color:'#888', textAlign:'center', padding:'20px'}}>Cargando...</div>}
        {url && <img src={url} alt="MatriSure" style={{width:'100%', borderRadius:'8px'}}/>}
      </div>
    </div>
  )
}
