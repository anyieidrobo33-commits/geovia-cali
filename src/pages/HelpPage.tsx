import { Link } from 'react-router-dom';
import { Camera, History, LifeBuoy, MapPin, Search, Smartphone } from 'lucide-react';
import { STATUSES } from '../lib/domain';
import { StatusBadge } from '../components/ui';

const FAQ: { q: string; a: string }[] = [
  { q: '¿Necesito crear una cuenta para reportar?', a: 'No. Puede reportar sin registrarse: la app crea una sesión anónima en su dispositivo. Si desea ver sus reportes desde varios dispositivos, puede crear una cuenta en «Ingresar → Crear cuenta».' },
  { q: '¿Por qué no veo mi reporte en el mapa?', a: 'El mapa público solo muestra reportes validados por un revisor. Mientras tanto, usted sí lo ve en «Mis reportes» y con borde punteado en el mapa de su dispositivo. Puede consultar su estado en cualquier momento con el código.' },
  { q: 'La app dice que ya existe un reporte cerca. ¿Qué hago?', a: 'Si es el mismo daño, no hace falta reportarlo otra vez: abra el código sugerido y consulte su estado. Si es un daño distinto (por ejemplo, otro hueco unos metros más adelante), continúe normalmente.' },
  { q: 'No me deja usar el GPS.', a: 'Revise que el navegador tenga permiso de ubicación (ícono del candado junto a la dirección web). También puede tocar el mapa en el punto exacto del daño y arrastrar el marcador para ajustarlo.' },
  { q: '¿Qué pasa con la ubicación que guarda la foto?', a: 'La app procesa la foto en su teléfono antes de enviarla: la reduce de tamaño y elimina los metadatos (EXIF), incluida la ubicación GPS y el modelo del teléfono. Solo se guarda la ubicación que usted marca para el daño.' },
  { q: 'Perdí la señal mientras llenaba el reporte.', a: 'Su borrador (ubicación, tipo y descripción) queda guardado en el dispositivo. Cuando vuelva la conexión, abra «Reportar», adjunte de nuevo la foto si cerró la app y envíe.' },
  { q: 'Olvidé mi código de seguimiento.', a: 'En «Seguimiento» aparecen los códigos enviados desde ese dispositivo. Si tiene cuenta, los encuentra en «Mis reportes».' },
  { q: '¿Cómo actualizo un reporte que ya existe?', a: 'Abra Comunidad o el mapa, elija el reporte y toque «Actualizar». Debe estar en el sitio: la app verifica con el GPS que esté a menos de 150 m del daño, con precisión de ± 100 m o mejor. Luego tome la foto en el momento con la cámara (no se aceptan fotos de la galería), indique si sigue igual, empeoró, mejoró o ya lo arreglaron, y publique.' },
  { q: '¿Por qué no puedo usar una foto de la galería al actualizar?', a: 'Para que la comunidad confíe en la información: una foto tomada en el momento y en el lugar demuestra el estado actual del daño. Su ubicación exacta solo se usa para verificar que está en el sitio y no se publica.' },
  { q: '¿GeoVía Cali repara las vías?', a: 'No. GeoVía Cali organiza y hace visibles los reportes ciudadanos con evidencia y trazabilidad. Para solicitudes oficiales use los canales de la Secretaría de Infraestructura de Cali. Ante una emergencia, llame al 123.' },
  { q: '¿Cómo instalo la app en el celular?', a: 'Android (Chrome): botón «Instalar app» o menú ⋮ → «Instalar aplicación». iPhone (Safari): botón Compartir → «Agregar a pantalla de inicio». El ícono queda junto a sus otras aplicaciones.' },
];

export default function HelpPage() {
  return (
    <div className="container container-narrow page">
      <div className="page-head">
        <div>
          <h1 className="row" style={{ gap: 10 }}><LifeBuoy size={30} />Centro de ayuda</h1>
          <p>Todo lo que necesita para reportar y hacer seguimiento en menos de dos minutos.</p>
        </div>
      </div>

      <section className="card card-pad stack" aria-labelledby="guia">
        <h2 id="guia" style={{ fontSize: '1.2rem', margin: 0 }}>Guía rápida</h2>
        <ol className="stack" style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li><b><MapPin size={16} style={{ verticalAlign: 'text-bottom' }} /> Ubique:</b> toque <Link to="/reportar">Reportar</Link> y use su GPS o toque el mapa.</li>
          <li><b>Describa:</b> elija el tipo de daño, la severidad que percibe y escriba qué ve (mínimo 15 caracteres).</li>
          <li><b><Camera size={16} style={{ verticalAlign: 'text-bottom' }} /> Fotografíe:</b> entre 1 y 3 fotos donde se vea el daño, sin rostros ni placas.</li>
          <li><b>Envíe:</b> acepte el tratamiento de datos y guarde el código que recibe.</li>
          <li><b><Search size={16} style={{ verticalAlign: 'text-bottom' }} /> Siga:</b> consulte el estado en <Link to="/seguimiento">Seguimiento</Link>.</li>
        </ol>
      </section>

      <section className="section" aria-labelledby="estados">
        <h2 id="estados" className="row" style={{ gap: 8 }}><History size={22} />¿Qué significa cada estado?</h2>
        <div className="stack">
          {STATUSES.map((s) => (
            <div key={s.code} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 12 }}>
              <span style={{ minWidth: 190 }}><StatusBadge status={s.code} /></span>
              <span className="small">{s.description}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="faq">
        <h2 id="faq">Preguntas frecuentes</h2>
        <div className="stack" style={{ gap: 8 }}>
          {FAQ.map((f) => (
            <details key={f.q} className="card" style={{ padding: '12px 16px' }}>
              <summary style={{ fontWeight: 650, cursor: 'pointer', color: 'var(--navy)' }}>{f.q}</summary>
              <p className="small" style={{ margin: '8px 0 0' }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="alert alert-info">
        <Smartphone size={18} />
        <span>¿Algo no funciona como espera? Escriba al equipo de GeoVía Cali indicando el código del reporte, su teléfono y navegador.</span>
      </div>
    </div>
  );
}
