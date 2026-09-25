// Shared style tokens for the "Acerca del Portal" manual (about/ui.jsx and the per-language content files).
export const COLOR = {
  navy: '#0b4358', lime: '#b5cc2e', coral: '#e8736a', cream: '#f5f5ee', border: '#ddddd5', muted: '#6b6b6b',
  okBg: '#eaf7ee', okInk: '#1a6b30', okBorder: '#a3d9b0',
  warnBg: '#fff3cd', warnInk: '#b06a00', warnBorder: '#f0d68a',
  badBg: '#fdeaea', badInk: '#8b2020', badBorder: '#f5c1c1',
  infoBg: '#e8f4fc', infoInk: '#0c447c', infoBorder: '#b8dcf5',
  realBg: '#fdece9', realBorder: '#e8736a',
}

export const card = { background: '#fff', borderRadius: '12px', border: `0.5px solid ${COLOR.border}`, padding: '22px 24px', marginBottom: '16px' }
export const h3style = { fontSize: '15.5px', fontWeight: 800, color: COLOR.navy, marginBottom: '12px' }
export const pMuted = { fontSize: '13px', color: COLOR.muted, lineHeight: 1.6 }
export const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }
export const tableWrap = { overflowX: 'auto', border: `0.5px solid ${COLOR.border}`, borderRadius: '10px', margin: '14px 0' }
export const table = { width: '100%', borderCollapse: 'collapse', fontSize: '13px' }
export const th = { fontSize: '10.5px', fontWeight: 700, color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'left', padding: '9px 12px', borderBottom: `1px solid ${COLOR.border}`, background: COLOR.cream }
export const td = { padding: '11px 12px', borderBottom: `0.5px solid ${COLOR.border}`, verticalAlign: 'top' }
