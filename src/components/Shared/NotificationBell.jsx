import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'

const POLL_MS = 30000

export default function NotificationBell({ profileId, onNavigate }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)

  const load = useCallback(() => {
    if (!profileId) return
    supabase.from('notifications').select('*')
      .eq('recipient_profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => { if (!error) setNotifications(data || []) })
  }, [profileId])

  useEffect(() => {
    load()
    const interval = setInterval(load, POLL_MS)
    return () => clearInterval(interval)
  }, [load])

  const unreadCount = notifications.filter(n => !n.read_at).length

  const handleClick = (n) => {
    setOpen(false)
    if (!n.read_at) {
      supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id).then(load)
    }
    if (n.panel) onNavigate(n.panel)
  }

  const markAllRead = () => {
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length === 0) return
    supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds).then(load)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(v => !v); if (!open) load() }}
        aria-label="Notificaciones"
        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', fontSize: '19px', lineHeight: 1, padding: '4px' }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -4, background: '#e8736a', color: 'white',
            borderRadius: '100px', fontSize: '10px', fontWeight: 700, padding: '1px 5px', lineHeight: 1.4
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
          <div style={{
            position: 'absolute', top: '34px', right: 0, width: '320px', maxHeight: '420px', overflowY: 'auto',
            background: 'white', borderRadius: '12px', border: '0.5px solid #ddddd5',
            boxShadow: '0 8px 32px rgba(11,67,88,.15)', zIndex: 100
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', borderBottom: '1px solid #eee'
            }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0b4358' }}>Notificaciones</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{ background: 'none', border: 'none', color: '#0b4358', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Marcar todas leídas
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', fontSize: '12.5px', color: '#888', textAlign: 'center' }}>
                Sin notificaciones
              </div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  padding: '12px 16px', borderBottom: '1px solid #f2f2ec', cursor: 'pointer',
                  background: n.read_at ? 'white' : '#f5f9ee'
                }}
              >
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0b4358' }}>{n.title}</div>
                {n.body && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{n.body}</div>}
                <div style={{ fontSize: '10.5px', color: '#aaa', marginTop: '4px' }}>
                  {new Date(n.created_at).toLocaleString('es-AR')}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
