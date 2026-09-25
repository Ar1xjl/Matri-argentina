import { COLOR, card, h3style, tableWrap, table, th, td } from './styles'

export function Card({ title, children, style }) {
  return <div style={{ ...card, ...style }}>{title && <div style={h3style}>{title}</div>}{children}</div>
}

export function Callout({ kind = 'info', label, children }) {
  const styles = kind === 'real'
    ? { background: COLOR.realBg, borderLeft: `3px solid ${COLOR.realBorder}`, labelColor: COLOR.coral }
    : { background: COLOR.infoBg, borderLeft: `3px solid ${COLOR.infoInk}`, labelColor: COLOR.infoInk }
  return (
    <div style={{ background: styles.background, borderLeft: styles.borderLeft, borderRadius: '10px', padding: '14px 16px', margin: '14px 0' }}>
      <div style={{ fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.06em', color: styles.labelColor, marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '13.5px', lineHeight: 1.55, color: COLOR.navy }}>{children}</div>
    </div>
  )
}

export function Pill({ kind = 'neutral', children }) {
  const map = {
    ok: { bg: COLOR.okBg, color: COLOR.okInk },
    warn: { bg: COLOR.warnBg, color: COLOR.warnInk },
    bad: { bg: COLOR.badBg, color: COLOR.badInk },
    info: { bg: COLOR.infoBg, color: COLOR.infoInk },
    neutral: { bg: COLOR.cream, color: COLOR.muted },
  }
  const s = map[kind]
  return <span style={{ display: 'inline-flex', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{children}</span>
}

export function RoleTag({ children }) {
  return <span style={{ display: 'inline-block', fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: '#eef3d4', color: COLOR.navy }}>{children}</span>
}

export function Table({ headers, rows }) {
  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead><tr>{headers.map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} style={{ ...td, borderBottom: i === rows.length - 1 ? 'none' : td.borderBottom }}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Flow({ children }) {
  return <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, flexWrap: 'wrap', margin: '18px 0 10px' }}>{children}</div>
}

export function FlowStep({ n, state, who, children }) {
  return (
    <div style={{ background: COLOR.infoBg, border: `1px solid ${COLOR.infoBorder}`, borderRadius: '10px', padding: n ? '16px 16px 14px' : '16px', paddingTop: n ? '38px' : '16px', minWidth: '150px', flex: 1, position: 'relative' }}>
      {n && (
        <div style={{ position: 'absolute', top: '12px', left: '14px', width: '22px', height: '22px', borderRadius: '50%', background: COLOR.navy, color: '#fff', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</div>
      )}
      <div style={{ fontSize: '13.5px', fontWeight: 800, color: COLOR.navy, marginBottom: '3px' }}>{state}</div>
      {who && <div style={{ fontSize: '11px', color: COLOR.infoInk, fontWeight: 700, marginBottom: '6px' }}>{who}</div>}
      <div style={{ fontSize: '12px', color: COLOR.muted, lineHeight: 1.45 }}>{children}</div>
    </div>
  )
}

export function FlowArrow() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', color: COLOR.navy, fontSize: '22px', fontWeight: 700, flexShrink: 0 }}>→</div>
}

export function Link({ to, onNavigate, children }) {
  return (
    <a href="#" onClick={(e) => { e.preventDefault(); onNavigate(`about-${to}`) }} style={{ color: COLOR.infoInk, fontWeight: 600 }}>
      {children}
    </a>
  )
}

export function OrgTree({ labels }) {
  const levels = [
    { label: labels[0], bg: COLOR.navy, color: '#fff', indent: 0 },
    { label: labels[1], bg: '#eef3d4', color: COLOR.navy, indent: 26 },
    { label: labels[2], bg: COLOR.infoBg, color: COLOR.navy, indent: 52 },
    { label: labels[3], bg: COLOR.cream, color: COLOR.navy, indent: 78, border: `0.5px solid ${COLOR.border}` },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '14px 0' }}>
      {levels.map(l => (
        <div key={l.label} style={{
          background: l.bg, color: l.color, border: l.border, marginLeft: `${l.indent}px`,
          padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
        }}>{l.label}</div>
      ))}
    </div>
  )
}

export function LinkCard({ icon, title, desc, to, onNavigate }) {
  return (
    <button
      onClick={() => onNavigate(`about-${to}`)}
      style={{
        display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left', cursor: 'pointer',
        background: '#fff', border: `0.5px solid ${COLOR.border}`, borderRadius: '10px', padding: '14px 16px',
        fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      }}
    >
      <div style={{ fontSize: '16px' }}>{icon}</div>
      <div style={{ fontSize: '13px', fontWeight: 800, color: COLOR.navy }}>{title}</div>
      <div style={{ fontSize: '11.5px', color: COLOR.muted, lineHeight: 1.4 }}>{desc}</div>
    </button>
  )
}

export function PageHeader({ eyebrow, title, intro }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: '8px' }}>{eyebrow}</div>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: COLOR.navy, margin: '0 0 6px' }}>{title}</h1>
      <p style={{ color: COLOR.muted, fontSize: '14.5px', lineHeight: 1.6, maxWidth: '62ch', margin: 0 }}>{intro}</p>
    </div>
  )
}
