export default function Profile() {
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>

      {/* Company data */}
      <div className="card" style={{marginBottom:0}}>
        <div className="card-header"><span className="card-title">Datos de la empresa</span></div>
        <div className="card-body">
          {[
            ['Razón Social',     'Kleppe S.A.',              true],
            ['CUIT',             '30-XXXXXXXX-X',            true],
            ['Situación Fiscal', 'Responsable Inscripto',    true],
            ['Email',            'compras@kleppe.com.ar',    false],
            ['Teléfono',         '+54 299 XXX-XXXX',         false],
          ].map(([label, value, readonly]) => (
            <div key={label} className="form-field">
              <label>{label}</label>
              <input
                defaultValue={value}
                readOnly={readonly}
                style={readonly ? {background:'var(--gray-lt)', color:'var(--gray)'} : {}}
              />
            </div>
          ))}
          <button className="btn-primary">Guardar cambios</button>
        </div>
      </div>

      {/* Password */}
      <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-header"><span className="card-title">Cambiar contraseña</span></div>
          <div className="card-body">
            {[
              ['Contraseña actual',   'password', '••••••••'],
              ['Nueva contraseña',    'password', '••••••••'],
              ['Confirmar contraseña','password', '••••••••'],
            ].map(([label, type, ph]) => (
              <div key={label} className="form-field">
                <label>{label}</label>
                <input type={type} placeholder={ph}/>
              </div>
            ))}
            <button className="btn-primary">Actualizar contraseña</button>
          </div>
        </div>

        <div className="alert info">
          ℹ️ Si olvidaste tu contraseña, contactá a Wassington para recibir una contraseña temporal. Tu sesión se cierra automáticamente a los 10 minutos de inactividad.
        </div>

        {/* Account info */}
        <div className="card" style={{marginBottom:0}}>
          <div className="card-header"><span className="card-title">Información de cuenta</span></div>
          <div className="card-body">
            {[
              ['Distribuidor asignado', 'Wassington'],
              ['Región',               'Río Negro, Argentina'],
              ['Miembro desde',        'Junio 2026'],
              ['Último acceso',        'Hoy, 11:30 hs'],
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