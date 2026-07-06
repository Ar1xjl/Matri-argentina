import { useState, useRef, useEffect } from 'react'

// Live camera capture only — no <input type="file"> anywhere in this component.
// DOMAIN_MODEL.md Business Rule 11: "MatriSure photo must be taken live from
// device camera — gallery upload is not permitted." A file picker (even one
// with a `capture` attribute hint) still lets a desktop user choose an old
// file, so this uses getUserMedia + canvas instead, which has no such escape hatch.
export default function MatriSureCapture({ onCapture, onCancel }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [error,    setError]    = useState('')
  const [photoBlob, setPhotoBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {
        setError('No se pudo acceder a la cámara. Revisá los permisos del navegador para este sitio.')
      }
    })()
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const capture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      setPhotoBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
    }, 'image/jpeg', 0.9)
  }

  const retake = () => {
    setPhotoBlob(null)
    setPreviewUrl(null)
  }

  const confirm = async () => {
    setUploading(true)
    await onCapture(photoBlob)
    setUploading(false)
  }

  const card = {background:'#fff', borderRadius:'12px', border:'0.5px solid #ddddd5', padding:'20px'}

  return (
    <div style={{maxWidth:'480px'}}>
      <div className="alert success" style={{marginBottom:'16px'}}>
        📸 Foto en vivo desde la cámara del dispositivo — no se permite subir desde la galería.
      </div>

      <div style={card}>
        {error && (
          <div style={{color:'#8b2020', fontSize:'13px', marginBottom:'12px'}}>{error}</div>
        )}

        {!photoBlob ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted
              style={{width:'100%', borderRadius:'8px', background:'#000', marginBottom:'12px'}}/>
            <button className="btn-primary" style={{width:'100%'}} onClick={capture} disabled={!!error}>
              📷 Capturar foto
            </button>
          </>
        ) : (
          <>
            <img src={previewUrl} alt="MatriSure capturada" style={{width:'100%', borderRadius:'8px', marginBottom:'12px'}}/>
            <div style={{display:'flex', gap:'10px'}}>
              <button className="btn-primary" style={{flex:1, opacity: uploading ? .6 : 1}} onClick={confirm} disabled={uploading}>
                {uploading ? 'Subiendo…' : '✓ Usar esta foto'}
              </button>
              <button className="btn-secondary" onClick={retake} disabled={uploading}>↺ Repetir</button>
            </div>
          </>
        )}

        <canvas ref={canvasRef} style={{display:'none'}}/>
      </div>

      <button className="btn-secondary" style={{marginTop:'12px'}} onClick={onCancel}>Cancelar</button>
    </div>
  )
}
