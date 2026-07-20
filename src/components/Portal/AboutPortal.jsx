// "Acerca del Portal" — in-app user manual. Documents the app's real current
// behavior (not DOMAIN_MODEL.md's aspirational design) — every place they
// diverge gets an "Estado real" callout. See MEMORY.md / project_matri_user_manual
// for the design history (this started as a Claude Artifact, iterated with
// Juan, then ported here). Page metadata (nav list) lives in lib/aboutPages.js,
// shared with Sidebar.jsx/Portal.jsx — keep this file component-only so Fast
// Refresh doesn't choke on a mixed export.
const COLOR = {
  navy: '#0b4358', lime: '#b5cc2e', coral: '#e8736a', cream: '#f5f5ee', border: '#ddddd5', muted: '#6b6b6b',
  okBg: '#eaf7ee', okInk: '#1a6b30', okBorder: '#a3d9b0',
  warnBg: '#fff3cd', warnInk: '#b06a00', warnBorder: '#f0d68a',
  badBg: '#fdeaea', badInk: '#8b2020', badBorder: '#f5c1c1',
  infoBg: '#e8f4fc', infoInk: '#0c447c', infoBorder: '#b8dcf5',
  realBg: '#fdece9', realBorder: '#e8736a',
}

const card = { background: '#fff', borderRadius: '12px', border: `0.5px solid ${COLOR.border}`, padding: '22px 24px', marginBottom: '16px' }
const h3style = { fontSize: '15.5px', fontWeight: 800, color: COLOR.navy, marginBottom: '12px' }
const pMuted = { fontSize: '13px', color: COLOR.muted, lineHeight: 1.6 }
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }
const tableWrap = { overflowX: 'auto', border: `0.5px solid ${COLOR.border}`, borderRadius: '10px', margin: '14px 0' }
const table = { width: '100%', borderCollapse: 'collapse', fontSize: '13px' }
const th = { fontSize: '10.5px', fontWeight: 700, color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'left', padding: '9px 12px', borderBottom: `1px solid ${COLOR.border}`, background: COLOR.cream }
const td = { padding: '11px 12px', borderBottom: `0.5px solid ${COLOR.border}`, verticalAlign: 'top' }

function Card({ title, children, style }) {
  return <div style={{ ...card, ...style }}>{title && <div style={h3style}>{title}</div>}{children}</div>
}

function Callout({ kind = 'info', label, children }) {
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

function Pill({ kind = 'neutral', children }) {
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

function RoleTag({ children }) {
  return <span style={{ display: 'inline-block', fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: '#eef3d4', color: COLOR.navy }}>{children}</span>
}

function Table({ headers, rows }) {
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

function Flow({ children }) {
  return <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, flexWrap: 'wrap', margin: '18px 0 10px' }}>{children}</div>
}

function FlowStep({ n, state, who, children }) {
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

function FlowArrow() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', color: COLOR.navy, fontSize: '22px', fontWeight: 700, flexShrink: 0 }}>→</div>
}

function Link({ to, onNavigate, children }) {
  return (
    <a href="#" onClick={(e) => { e.preventDefault(); onNavigate(`about-${to}`) }} style={{ color: COLOR.infoInk, fontWeight: 600 }}>
      {children}
    </a>
  )
}

function PageHeader({ eyebrow, title, intro }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: '8px' }}>{eyebrow}</div>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: COLOR.navy, margin: '0 0 6px' }}>{title}</h1>
      <p style={{ color: COLOR.muted, fontSize: '14.5px', lineHeight: 1.6, maxWidth: '62ch', margin: 0 }}>{intro}</p>
    </div>
  )
}

// ── Per-section content ─────────────────────────────────────────────────
const SECTIONS = {

  altas: () => (
    <>
      <PageHeader eyebrow="Flujo crítico · Organización" title="Alta de organizaciones y usuarios"
        intro='Dos altas distintas conviven acá: incorporar una organización nueva al árbol (Distribuidor, Sub-distribuidor o Cliente), e incorporar una persona dentro de una organización que ya existe.' />

      <div style={{ fontWeight: 800, color: COLOR.navy, marginBottom: '10px' }}>1. Alta de una organización</div>
      <div style={grid2}>
        <Card title="📋 Camino manual — “+ Nueva organización”">
          <p style={pMuted}>Desde <strong>Organizaciones</strong> (Panel del Distribuidor → CRM), cualquier Owner/Aprobador de una organización no-Cliente puede crear la que sigue debajo en su propio árbol:</p>
          <ul style={{ ...pMuted, margin: '8px 0', paddingLeft: '20px' }}>
            <li>Global solo puede crear <strong>Distribuidores</strong>.</li>
            <li>Un Distribuidor puede crear <strong>Sub-distribuidores</strong> o <strong>Clientes</strong>.</li>
            <li>Un Sub-distribuidor solo puede crear <strong>Clientes</strong>.</li>
          </ul>
          <p style={pMuted}>Campos: Nombre, Tipo, Organización superior, País y — solo si es Distribuidor — Moneda y Tipo de cambio a USD.</p>
        </Card>
        <Card title="🙋 Camino autoservicio — “Solicitar acceso”">
          <p style={pMuted}>Un Cliente potencial sin cuenta todavía completa el formulario público <strong>“Solicitar acceso — nueva empresa”</strong>: Razón Social, CUIT, Situación Fiscal, Provincia, email y teléfono.</p>
          <p style={pMuted}>La solicitud cae en <strong>“📥 Solicitudes de acceso pendientes”</strong>, visible para cualquier Distribuidor, Sub-distribuidor o staff de Global. Desde ahí se puede <Pill kind="info">Asignar organización</Pill> o <Pill kind="bad">Rechazar</Pill>.</p>
        </Card>
      </div>

      <Flow>
        <FlowStep n={1} state="Acuerdo comercial" who="Fuera del portal">Se negocia entre FreshInset y el nuevo socio antes de tocar el sistema.</FlowStep>
        <FlowArrow />
        <FlowStep n={2} state="⏳ Pendiente" who="Quien la crea">La organización queda creada pero no puede operar todavía.</FlowStep>
        <FlowArrow />
        <FlowStep n={3} state="✓ Activa" who="FreshInset Global">Botón “Activar”, visible solo para Global. Único gate — sin checklist adicional.</FlowStep>
        <FlowArrow />
        <FlowStep n={4} state="En marcha" who="El nuevo Owner">Configura sus propias tablas de precio y ya puede recibir Usuarios, Cámaras y Tratamientos.</FlowStep>
      </Flow>

      <Callout label="Por qué siempre pasa por Global">
        Incluso cuando un Distribuidor crea su propio Sub-distribuidor — algo que el sistema le permite hacer técnicamente sin pedir permiso a nadie — esa organización nace igual en “Pendiente” y necesita la aprobación de FreshInset Global antes de operar. Es una decisión de negocio, no una limitación técnica.
      </Callout>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '26px 0 10px' }}>2. Alta de un usuario dentro de una organización activa</div>
      <div style={grid2}>
        <Card title="🔗 Invitación por link (más directo)">
          <p style={pMuted}>Un Owner elige de antemano la organización y los Roles de Negocio en <strong>Usuarios → “🔗 Invitar por link”</strong> y comparte el link manualmente. Quien lo abre queda asignado automáticamente, sin que el Owner necesite saber su email de antemano.</p>
        </Card>
        <Card title="📥 Auto-registro + asignación manual">
          <p style={pMuted}>La persona crea su login con <strong>“Crear usuario”</strong> (solo el login, todavía sin organización). Aparece en <strong>“📥 Solicitudes de usuario pendientes de asignar”</strong> — cualquier Owner puede <Pill kind="info">Asignar</Pill> o <Pill kind="neutral">Descartar</Pill>.</p>
        </Card>
      </div>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>Roles de Negocio</div>
      <p style={{ ...pMuted, marginBottom: '6px' }}>Son independientes entre sí — no forman una escalera. Una persona puede tener varios a la vez.</p>
      <Table headers={['Rol', 'Qué puede hacer']} rows={[
        [<RoleTag>Owner</RoleTag>, 'Acceso total a su organización y a todo lo que cuelga debajo. Único rol que administra usuarios. Toda organización necesita al menos un Owner en todo momento.'],
        [<RoleTag>Aprobador</RoleTag>, 'Revisa, fija el precio final y aprueba o rechaza Tratamientos enviados por las organizaciones de abajo.'],
        [<RoleTag>Planificador</RoleTag>, 'Crea, edita y envía Tratamientos — usa la Calculadora y carga el Plan de Temporada.'],
        [<RoleTag>Operador</RoleTag>, 'Registra la aplicación física del tratamiento y sube la verificación MatriSure.'],
        [<RoleTag>Viewer</RoleTag>, 'Solo lectura de Tratamientos e historial — no puede crear ni modificar nada.'],
      ]} />

      <Callout label="Sucesión del Owner">
        En un Sub-distribuidor o Cliente, reemplazar al Owner es totalmente autónomo. En un Distribuidor, necesita la aprobación de FreshInset Global — el mismo gate que su alta original.
      </Callout>
    </>
  ),

  plan: () => (
    <>
      <PageHeader eyebrow="Flujo crítico · Planificación" title="Planificación de campaña"
        intro="El Plan de Temporada es una tabla no vinculante para bosquejar toda la campaña — todas las cámaras, todas las fechas — antes de comprometerse a un Tratamiento real. Convive con la Calculadora sin reemplazarla." />

      <Card title="Qué contiene cada línea del plan">
        <Table headers={['Campo', 'Detalle']} rows={[
          ['Cámara', 'Una de las cámaras propias del Cliente.'],
          ['Cultivo', 'Se completa o actualiza junto con la cámara.'],
          ['Fecha estimada', 'Cuándo se planea tratar esa cámara.'],
          ['Dosis (ppb)', 'Opcional en esta etapa.'],
          ['Producto', 'Powder / Tablets / Sin decidir.'],
          ['Costo indicativo', 'Recalculado en vivo contra el precio vigente — nunca es un compromiso.'],
          ['Estado', <>{<Pill kind="warn">Planificada</Pill>} o {<Pill kind="ok">Convertida</Pill>}</>],
        ]} />
      </Card>

      <div style={grid2}>
        <Card title="Carga fila por fila">
          <p style={pMuted}>Tabla editable directamente en pantalla, más un multi-selector con <strong>“Aplicar a seleccionadas”</strong> para asignar Producto en lote.</p>
        </Card>
        <Card title="Carga masiva por Excel">
          <p style={pMuted}>Plantilla descargable (Frigorífico, Cámara, Volumen, Dosis, Fecha, Cultivo). Detecta duplicados por Cámara + Fecha y pregunta si sumar o reemplazar.</p>
        </Card>
      </div>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>De línea planificada a Tratamiento real</div>
      <Flow>
        <FlowStep n={1} state="Seleccionar filas" who="Cliente">Elegís una o varias líneas en estado “Planificada”.</FlowStep>
        <FlowArrow />
        <FlowStep n={2} state="“Convertir en Tratamiento”" who="Cliente">Cada línea pasa, una por una, por la Calculadora real.</FlowStep>
        <FlowArrow />
        <FlowStep n={3} state="Confirmar" who="Cliente">Se revisa/ajusta y se confirma. Entra directo como Tratamiento Enviado.</FlowStep>
      </Flow>

      <Callout kind="real" label="🔧 Estado real">
        No hay un paso de Borrador separado en la conversión — pasar por la Calculadora al convertir <em>es</em> el paso de revisión, por diseño. Convertir una línea no reserva stock ni dispara ninguna aprobación por sí sola.
      </Callout>

      <div style={{ ...grid2, marginTop: '18px' }}>
        <Card title="🤝 Borrador armado por el Distribuidor">
          <p style={pMuted}>Un Distribuidor o Sub-distribuidor puede armar un Plan de Temporada estimado para un Cliente que todavía no cargó el propio. Queda invisible hasta tocar “Compartir”, que copia las líneas a su plan real.</p>
        </Card>
        <Card title="📊 Vista consolidada (rollup)">
          <p style={pMuted}>El Distribuidor ve, de solo lectura, el plan de todos sus Clientes a la vez — útil para asignar generadores antes de que se convierta en Tratamiento.</p>
        </Card>
      </div>
    </>
  ),

  calculadora: ({ onNavigate }) => (
    <>
      <PageHeader eyebrow="Flujo crítico · Decisión de dosis" title="Calculadora, DoseRight y Knowledge Base"
        intro='Las tres herramientas que un Cliente (o un Distribuidor/Global cargando en su nombre) usa para decidir y calcular una dosis antes de crear un Tratamiento.' />

      <Card title="🧮 Calculadora de dosis">
        <p style={pMuted}>Campos: Cámara, Nombre personalizado (opcional) y Dosis objetivo en ppb — con un atajo <strong>“Estándar (1.000 ppb)”</strong> (1.000 ppb = 0,067 g de MatriPowder 3,3% por m³).</p>
        <p style={pMuted}>Una barra superior indica si el cálculo usa el <strong>precio pactado</strong> de ese Cliente o la <strong>lista estándar</strong>. “Calcular y comparar alternativas” muestra siempre las 3 opciones (Powder exacto, Powder ajustado, Tablets) con precio real. Elegir una y confirmar crea el Tratamiento — ver <Link to="tratamientos" onNavigate={onNavigate}>Ciclo de un Tratamiento</Link>.</p>
      </Card>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>🔬 DoseRight — soporte científico de dosis</div>
      <p style={{ ...pMuted, marginBottom: '10px' }}>Un callout dentro de la propia Calculadora (“¿No sabés qué dosis usar?”) abre DoseRight en una ventana aparte.</p>
      <Flow>
        <FlowStep n={1} state="Abrir DoseRight" who="Ventana emergente">Se abre en un popup, no incrustado — necesario para devolver la dosis a la Calculadora.</FlowStep>
        <FlowArrow />
        <FlowStep n={2} state="Ajustar parámetros" who="Cliente">Madurez de cosecha, condiciones de guarda y horas desde cosecha.</FlowStep>
        <FlowArrow />
        <FlowStep n={3} state='"Usar esta dosis"' who="Cliente">La dosis vuelve a precargar el campo ppb — sigue siendo editable.</FlowStep>
      </Flow>

      <Callout label="DoseRight sugiere, no prescribe">
        La responsabilidad final de la dosis siempre es del usuario. El Tratamiento guarda de dónde vino (<code>manual</code> o <code>doseright</code>) para trazabilidad, aunque hoy no se muestra como etiqueta visible.
      </Callout>

      <Card title="📚 MaTri Knowledge Base" style={{ marginTop: '18px' }}>
        <p style={pMuted}>Ítem fijo del menú lateral que abre en pestaña nueva un sitio de referencias científicas — evidencia que respalda las recomendaciones de DoseRight. Visible sin restricción por rol ni tipo de organización.</p>
      </Card>
    </>
  ),

  tratamientos: ({ onNavigate }) => (
    <>
      <PageHeader eyebrow="Flujo crítico · Operación" title="Ciclo de vida de un Tratamiento"
        intro="El Tratamiento es la entidad central del negocio: guarda dosis, precio congelado, historial y evidencia científica de principio a fin." />

      <Flow>
        <FlowStep n={1} state="Enviado" who="👤 Planificador">Se crea desde la Calculadora o convirtiendo una línea del Plan de Temporada.</FlowStep>
        <FlowArrow />
        <FlowStep n={2} state="Aprobado" who="✅ Aprobador">Confirma o ajusta el precio final — queda congelado para siempre.</FlowStep>
        <FlowArrow />
        <FlowStep n={3} state="Aplicado" who="🔧 Operador">Registra fecha/hora real de inicio y fin.</FlowStep>
        <FlowArrow />
        <FlowStep n={4} state="Completado" who="📸 Cliente / Aprobador">MatriSure sube foto y confirma resultado. Cierra e inmutable.</FlowStep>
      </Flow>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', fontSize: '12.5px', color: COLOR.muted, flexWrap: 'wrap' }}>
        <span>También puede terminar en:</span>
        <Pill kind="bad">✗ Rechazado</Pill> <span>— el Aprobador rechaza con motivo obligatorio.</span>
      </div>

      <Callout kind="real" label="🔧 Estado real">
        No existe un estado de <strong>Borrador</strong> editable hoy: un Tratamiento nace directamente en “Enviado”. Tampoco hay botón para editar y reenviar un Tratamiento Rechazado. “Cancelado” existe en el modelo de datos, pero hoy no hay botón en la interfaz para llegar a él.
      </Callout>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '24px 0 10px' }}>Paso a paso</div>
      <ol style={{ ...pMuted, paddingLeft: '20px' }}>
        <li style={{ marginBottom: '10px' }}><strong>Creación (Planificador).</strong> Cámara + dosis, siempre las 3 alternativas visibles. Al confirmar entra a la cola del Aprobador.</li>
        <li style={{ marginBottom: '10px' }}><strong>Aprobación (Aprobador/Owner, Panel del Distribuidor).</strong> <Pill kind="ok">✓ Aprobar</Pill> fija el precio final. <Pill kind="bad">✗ Rechazar</Pill> pide un motivo visible para el Cliente.</li>
        <li style={{ marginBottom: '10px' }}><strong>Aplicación física (Operador).</strong> Carga fecha/hora completas de inicio y fin.</li>
        <li style={{ marginBottom: '10px' }}><strong>Verificación MatriSure.</strong> Foto en vivo, autoconfirmación o “pedir ayuda” — ver <Link to="matrisure" onNavigate={onNavigate}>MatriSure</Link>.</li>
        <li><strong>Completado.</strong> Precio y desglose de sachets quedan congelados para siempre.</li>
      </ol>

      <Callout label="Quién ve la cola de aprobación">
        Solo Owner y Aprobador ven “Tratamientos pendientes de aprobación”. Más detalle en <Link to="roles" onNavigate={onNavigate}>Roles y permisos</Link>.
      </Callout>
    </>
  ),

  precios: () => (
    <>
      <PageHeader eyebrow="Flujo crítico · Comercial" title="Manejo de precios"
        intro="Cada Distribuidor arma su propia lista de precios desde cero, en su propia moneda — nunca se hereda de FreshInset Global." />

      <Card title='Las 4 tablas — Panel del Distribuidor → "💲 Gestión de precios"'>
        <Table headers={['Tabla', 'Unidad', 'Segmentada por']} rows={[
          ['Producto', '$/m³', 'SKU (Powder / Tablets) × bracket de volumen'],
          ['Servicio de aplicación', '$/tratamiento', 'Bracket — solo Powder con servicio gestionado'],
          ['Generador', 'compra $/unidad y alquiler $/día', 'Bracket'],
          ['Brackets de volumen', '—', 'Editables por Distribuidor (0–600 / 600–1.200 / 1.200–1.800 / 1.800+ m³ por defecto)'],
        ]} />
        <p style={{ ...pMuted, marginTop: '10px' }}>Solo Owner y Aprobador editan estas tablas. Global las ve de solo lectura; un Sub-distribuidor tiene control total sobre las suyas propias.</p>
      </Card>

      <Callout label="Quién le fija el precio a quién">
        Cuando un Cliente cuelga de un Sub-distribuidor que armó su propio precio, ese precio gana. Si no configuró brackets propios, se usa el del ancestro más cercano que sí lo hizo.
      </Callout>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>Precio negociado por Cliente</div>
      <p style={{ ...pMuted, marginBottom: '10px' }}>Botón <strong>“💲 Precio”</strong> en Organizaciones, visible solo para Owner/Aprobador de la organización padre inmediata.</p>
      <Table headers={['Orden', 'Mecanismo', 'Uso típico']} rows={[
        ['1', 'Precio fijo pactado ($/m³)', 'Cuentas grandes — reemplaza toda la tabla de brackets.'],
        ['2', '% de descuento sobre lista', 'Cuentas medianas.'],
        ['3', 'Precio de lista, sin cambios', 'Cuentas chicas o de mayor riesgo de cobro.'],
      ]} />
      <p style={pMuted}>Un acuerdo puede llevar un <strong>volumen mínimo comprometido</strong> — puramente informativo, nunca bloquea el precio por su cuenta.</p>

      <Callout kind="real" label="📌 El congelado (snapshot)">
        Al aprobar un Tratamiento, el precio final y el desglose de sachets quedan fotografiados para siempre — junto con su equivalente en USD. Cambios futuros de precio, catálogo o tipo de cambio nunca alteran Tratamientos ya aprobados.
      </Callout>
    </>
  ),

  matrisure: () => (
    <>
      <PageHeader eyebrow="Operación y calidad" title="MatriSure — verificación de dosis"
        intro="El paso que confirma, con una tira de color, que la dosis realmente se alcanzó dentro de la cámara." />

      <Card title="Regla de oro: solo cámara en vivo">
        <p style={pMuted}>La foto se toma en vivo desde la cámara del dispositivo — no existe botón para subir desde la galería. Evita cargar una foto vieja para adulterar la verificación.</p>
      </Card>

      <div style={grid2}>
        <Card title="✓ Autoconfirmación (el caso más común)">
          <p style={pMuted}>El propio Cliente sube la foto y marca <Pill kind="ok">✓ Dosis alcanzada</Pill> o <Pill kind="bad">✗ No alcanzada</Pill>.</p>
        </Card>
        <Card title="🙋 Pedir ayuda (escalamiento opcional)">
          <p style={pMuted}>Aparece como “🙋 MatriSure — el cliente pidió ayuda” y un Aprobador de arriba confirma el resultado.</p>
        </Card>
      </div>

      <Callout label="“No alcanzada” no bloquea el cierre">
        Igual lleva el Tratamiento a Completado — queda registrado como alerta en el dashboard, pero nunca impide cerrarlo.
      </Callout>

      <Callout kind="real" label="🔧 Estado real / a futuro">
        La clasificación automática por color de la tira es un ítem de roadmap futuro. La alerta de “foto subida pero nadie confirmó el resultado” está documentada pero tampoco construida todavía.
      </Callout>
    </>
  ),

  firmeza: () => (
    <>
      <PageHeader eyebrow="Operación y calidad" title="Evaluación de Firmeza"
        intro="Distinta de MatriSure: MatriSure confirma la concentración dentro de la cámara; la Evaluación de Firmeza confirma el efecto sobre la fruta (Testigo vs. Matri)." />

      <Card title="Quién puede cargarla">
        <p style={pMuted}>Solo staff no-Cliente en la cadena de ancestros del Tratamiento, con rol Owner, Aprobador u Operador. El Cliente y el resto de la cadena solo pueden ver y descargar el PDF firmado.</p>
      </Card>

      <div style={grid2}>
        <Card title="Dónde se carga">
          <p style={pMuted}>Panel del Distribuidor → pestaña Tratamientos → botón “📊 + Evaluación”, sobre un Tratamiento Aplicado o Completado.</p>
        </Card>
        <Card title="Qué calcula solo">
          <p style={pMuted}>La tasa de pérdida de firmeza y su gráfico se derivan automáticamente de las muestras cargadas.</p>
        </Card>
      </div>
    </>
  ),

  generadores: () => (
    <>
      <PageHeader eyebrow="Operación y calidad" title="Generadores"
        intro="Solo relevante para MatriPowder — MatriTablets nunca necesita un generador." />

      <Card title="Ciclo de vida de una unidad">
        <Flow>
          <FlowStep state="Disponible">Recién registrada, o vuelta de un alquiler.</FlowStep>
          <FlowArrow />
          <FlowStep state="Despachada / En alquiler">Checklist previo obligatorio antes de salir.</FlowStep>
          <FlowArrow />
          <FlowStep state="En servicio → Reparada">O directamente Fuera de servicio.</FlowStep>
        </Flow>
      </Card>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>Acciones desde “Mis generadores”</div>
      <Table headers={['Acción', 'Quién', 'Qué pasa']} rows={[
        ['Registrar unidad nueva', 'Solo Global o Distribuidor', 'Un Sub-distribuidor nunca origina stock nuevo.'],
        ['Traspaso a sub-distribuidor', 'Distribuidor', 'Cambio simple de dueño, sin checklist.'],
        ['Alquilar a cliente', 'Distribuidor/Sub-distribuidor', 'Checklist previo obligatorio. La propiedad nunca cambia.'],
        ['Vender a cliente', 'Distribuidor/Sub-distribuidor', 'Mismo checklist, pero la propiedad pasa al Cliente.'],
        ['Marcar como devuelto', 'Distribuidor/Sub-distribuidor', 'Cierra el alquiler, vuelve a Disponible.'],
      ]} />

      <Callout label="Checklist previo al despacho (bloqueante)">
        Batería cargada, sellos intactos, prueba de arranque, service al día. La unidad no puede pasar a “Despachada” con el checklist incompleto.
      </Callout>

      <Card title="Calculadora Comprar vs. Alquilar vs. Servicio gestionado" style={{ marginTop: '18px' }}>
        <p style={pMuted}>Vista del Cliente — puede alimentarse con datos reales del Plan de Temporada. Un Distribuidor o Global ve directamente el estado de su propia flota.</p>
      </Card>
    </>
  ),

  inventario: () => (
    <>
      <PageHeader eyebrow="Operación y calidad" title="Inventario y Catálogo de SKU"
        intro="Herramienta interna del Distribuidor — hoy no tiene desglose por Sub-distribuidor ni es visible para Clientes." />

      <div style={grid2}>
        <Card title="🏷️ Catálogo de SKU">
          <p style={pMuted}><strong>MatriPowder:</strong> tamaños de sachet editables (default 100g/50g/20g/10g).</p>
          <p style={pMuted}><strong>MatriTablets:</strong> tamaños de sobre editables, no divisibles (default 10/15/50).</p>
        </Card>
        <Card title="📦 Inventario">
          <p style={pMuted}>MatriTablets se rastrea en dos pools: <strong>sobres</strong> cerrados y <strong>sueltas</strong>. Abrir un sobre es siempre manual.</p>
        </Card>
      </div>

      <Callout label="Descuento automático">
        Al pasar a “Aplicado”: Powder resta del desglose de sachets; Tablets resta solo del pool suelto. El stock puede quedar en negativo — señal visible, no se oculta.
      </Callout>

      <p style={pMuted}>El ajuste manual queda disponible para recibir stock nuevo, abrir un sobre, o corregir un conteo físico.</p>
    </>
  ),

  documentos: () => (
    <>
      <PageHeader eyebrow="Soporte" title="Documentos" intro="" />
      <Callout kind="real" label="🔧 Estado real">
        Hoy “Documentos” es una biblioteca con contenido fijo en el código — todavía no hay carga ni versionado real desde la interfaz. Está pendiente para producción.
      </Callout>
      <Card title="Diseño previsto para cuando se construya">
        <p style={pMuted}><strong>Documentación Global</strong> (de FreshInset): base de conocimiento científico, evidencia de calibración DoseRight.</p>
        <p style={pMuted}><strong>Documentación de la Organización:</strong> fichas de producto, hojas de seguridad, manuales de generador, guía MatriSure, inscripciones regulatorias (siempre a nivel país).</p>
        <p style={pMuted}>Subir una versión nueva sería autoservicio del propio Owner, sin revisión externa.</p>
      </Card>
    </>
  ),

  notificaciones: () => (
    <>
      <PageHeader eyebrow="Soporte" title="Notificaciones" intro="Campanita 🔔 en el encabezado — contador de no leídas, se actualiza cada 30 segundos." />
      <Card title="Eventos que avisan hoy">
        <ul style={{ ...pMuted, margin: 0, paddingLeft: '20px' }}>
          <li>Tratamiento enviado → avisa al Aprobador/Owner del padre inmediato.</li>
          <li>Tratamiento aprobado o rechazado → avisa a quien lo creó.</li>
          <li>Nueva solicitud de acceso de empresa.</li>
          <li>Nuevo registro de usuario pendiente de asignar.</li>
          <li>MatriSure — el Cliente pidió ayuda.</li>
          <li>Invitación por link redimida.</li>
        </ul>
      </Card>
      <Callout kind="real" label="🔧 Estado real">
        Solo existe el canal dentro de la app — todavía no hay envío por email (falta proveedor SMTP propio). Las alertas basadas en tiempo están documentadas pero no construidas todavía.
      </Callout>
    </>
  ),

  roles: () => (
    <>
      <PageHeader eyebrow="Referencia" title="Roles y permisos" intro="Qué ve y qué puede hacer cada Rol de Negocio dentro del Panel del Distribuidor — reforzado a nivel de base de datos, no solo escondido en la pantalla." />

      <Callout label="🔎 Detalle completo">
        Para el detalle pantalla por pantalla de cada combinación de Tipo de organización × Rol de Negocio, ver la{' '}
        <a href="https://claude.ai/code/artifact/dcfbfb24-5589-4101-bfa7-00a002dd71a0" target="_blank" rel="noopener noreferrer" style={{ color: COLOR.infoInk, fontWeight: 700 }}>Matriz de Roles y Permisos</a>.
      </Callout>

      <Table headers={['Rol', 'CRM/Inventario/Catálogo/Precios', 'Aprobar/Rechazar', 'Tratamientos', 'Evaluación de Firmeza']} rows={[
        [<RoleTag>Owner</RoleTag>, <Pill kind="ok">Control total</Pill>, <Pill kind="ok">Sí</Pill>, 'Ve todo', 'Sí'],
        [<RoleTag>Aprobador</RoleTag>, <Pill kind="ok">Control total</Pill>, <Pill kind="ok">Sí</Pill>, 'Ve todo', 'Sí'],
        [<RoleTag>Planificador</RoleTag>, <Pill kind="neutral">Sin acceso</Pill>, <Pill kind="bad">No</Pill>, 'Solo esta pestaña', 'No'],
        [<RoleTag>Operador</RoleTag>, <Pill kind="neutral">Sin acceso</Pill>, <Pill kind="bad">No</Pill>, 'Sin columna de precio', 'Sí'],
        [<RoleTag>Viewer</RoleTag>, <Pill kind="neutral">Sin acceso</Pill>, <Pill kind="bad">No</Pill>, 'Solo lectura', 'No'],
      ]} />

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>Matices según el tipo de organización</div>
      <Table headers={['Tipo', 'Inventario', 'Catálogo de SKU', 'Precios']} rows={[
        ['🌐 Global', <Pill kind="warn">Solo lectura</Pill>, <Pill kind="ok">Control total</Pill>, <Pill kind="warn">Solo lectura</Pill>],
        ['📦 Distribuidor', <Pill kind="ok">Control total</Pill>, <Pill kind="ok">Control total</Pill>, <Pill kind="ok">Control total</Pill>],
        ['🏬 Sub-distribuidor', <Pill kind="ok">Control total (propio)</Pill>, <Pill kind="warn">Solo lectura</Pill>, <Pill kind="ok">Control total (propio)</Pill>],
      ]} />

      <Callout label="Del lado Cliente">
        Hoy, dentro de una organización Cliente, Aprobador no se comporta distinto de Owner — no existe todavía una pantalla propia donde la diferencia importe.
      </Callout>
    </>
  ),

  glosario: () => (
    <>
      <PageHeader eyebrow="Referencia" title="Glosario" intro="" />
      <Card>
        {[
          ['Organización', 'Nodo del árbol comercial: FreshInset Global, Distribuidor, Sub-distribuidor o Cliente.'],
          ['Tratamiento', 'El ciclo completo de una aplicación de MaTri, de la creación a la verificación confirmada.'],
          ['Plan de Temporada', 'Tabla no vinculante para bosquejar una campaña antes de comprometerse a Tratamientos reales.'],
          ['Línea de plan', 'Una fila del Plan de Temporada — cámara + fecha + dosis, convertible en Tratamiento.'],
          ['Cámara', 'Ubicación física donde se aplica el tratamiento; historial completo entre temporadas.'],
          ['Generador', 'Equipo profesional para aplicaciones con MatriPowder, con ID individual propio.'],
          ['MatriSure', 'Kit de tiras que confirma con foto en vivo si la dosis se alcanzó.'],
          ['Evaluación de Firmeza', 'Comparación Testigo vs. Matri de firmeza de la fruta a lo largo de los días de post-cosecha.'],
          ['Bracket de volumen', 'Rango de m³ usado para segmentar precios.'],
          ['Precio negociado', 'Acuerdo propio de un Cliente puntual que reemplaza la lista general.'],
          ['Snapshot de precio', 'Precio y desglose de sachets congelados al momento de aprobar un Tratamiento.'],
          ['TC a USD', 'Tipo de cambio propio de cada Distribuidor, usado para consolidar el dashboard de FreshInset Global.'],
        ].map(([term, def]) => (
          <div key={term} style={{ marginTop: '14px' }}>
            <div style={{ fontWeight: 800, color: COLOR.navy, fontSize: '13.5px' }}>{term}</div>
            <div style={{ fontSize: '13.5px', color: COLOR.muted, lineHeight: 1.55 }}>{def}</div>
          </div>
        ))}
      </Card>
    </>
  ),
}

export default function AboutPortal({ section, onNavigate }) {
  const Content = SECTIONS[section]
  if (!Content) return null
  return <div style={{ maxWidth: '860px' }}><Content onNavigate={onNavigate} /></div>
}
