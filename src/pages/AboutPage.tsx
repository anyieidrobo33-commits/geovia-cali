import logoFull from '../assets/logo-full.png';

const REPO = import.meta.env.VITE_REPO_URL as string | undefined;

export default function AboutPage() {
  return (
    <div className="container container-narrow page prose">
      <img src={logoFull} alt="GeoVía Cali" width={200} style={{ marginBottom: 12 }} />
      <h1>Acerca de GeoVía Cali</h1>
      <p>
        GeoVía Cali es un <b>prototipo académico con nivel de madurez tecnológica TRL 5</b>, desarrollado como proyecto de grado del
        programa de Ingeniería de Sistemas de la Universidad Nacional Abierta y a Distancia (UNAD) bajo la metodología CDIO
        (Concebir, Diseñar, Implementar, Operar).
      </p>
      <p>
        Su propósito es organizar reportes ciudadanos de afectaciones visibles de la malla vial de Santiago de Cali mediante campos
        estandarizados, ubicación geográfica, evidencia fotográfica y una bitácora de cambios verificable.
      </p>

      <h2>Alcance y límites</h2>
      <ul>
        <li>No es un canal oficial de la Alcaldía de Santiago de Cali ni sustituye aplicativos institucionales existentes.</li>
        <li>No diagnostica estructuralmente el pavimento, no asigna obras ni garantiza reparaciones.</li>
        <li>El estado «Validado en el sistema» significa que el registro es consistente; no equivale a una inspección oficial.</li>
        <li>La severidad es una percepción ciudadana orientativa, no una clasificación técnica.</li>
        <li>Los registros marcados como «Dato de demostración» son simulados para la socialización del prototipo.</li>
      </ul>

      <h2 id="privacidad">Política de tratamiento de datos</h2>
      <p>En cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013:</p>
      <ul>
        <li><b>Datos tratados:</b> ubicación de la afectación, descripción, categoría, fotografías y, solo si crea una cuenta, correo electrónico y nombre o alias.</li>
        <li><b>Finalidad:</b> exclusivamente académica — registrar, visualizar, moderar y evaluar el funcionamiento del prototipo.</li>
        <li><b>Minimización:</b> reportar no exige cuenta ni datos personales. Las fotografías se procesan en su dispositivo y se eliminan sus metadatos (EXIF), incluida la ubicación GPS del teléfono.</li>
        <li><b>Seguridad:</b> conexiones cifradas (HTTPS), control de acceso por roles aplicado en la base de datos, fotografías en almacenamiento privado con enlaces temporales y contraseñas almacenadas con derivación criptográfica.</li>
        <li><b>Publicación:</b> solo los reportes validados se muestran públicamente, sin identificar a quien reportó.</li>
        <li><b>Derechos:</b> puede conocer, actualizar, rectificar o solicitar la supresión de sus datos escribiendo al equipo del proyecto.</li>
        <li><b>Retención:</b> los datos se conservan durante el periodo académico de validación del prototipo.</li>
      </ul>
      <p>Evite incluir en fotos o descripciones rostros, placas vehiculares u otra información que identifique a personas.</p>

      <h2>Equipo</h2>
      <ul>
        <li><b>Cristian Camilo Alvarado Cardona</b> — Ingeniería de Sistemas, UNAD</li>
        <li><b>Anyie Tatiana Idrobo García</b> — Ingeniería de Sistemas, UNAD</li>
      </ul>

      <h2>Tecnología</h2>
      <p>
        React + TypeScript + Vite · Leaflet con cartografía de OpenStreetMap · Supabase (PostgreSQL + PostGIS, autenticación,
        almacenamiento y políticas RLS) · Aplicación web progresiva (PWA) instalable · Despliegue en Vercel.
      </p>
      {REPO && <p>Código fuente: <a href={REPO} target="_blank" rel="noreferrer">{REPO}</a></p>}
      <p className="small muted">Versión {__APP_VERSION__} · Compilada el {__BUILD_DATE__}</p>
    </div>
  );
}
