import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, History, Info, MapPin, Map as MapIcon, Plus, Search, ShieldCheck } from 'lucide-react';
import logoFull from '../assets/logo-full.png';
import { fetchStats, type Stats } from '../lib/api';
import { CATEGORIES } from '../lib/domain';
import { CategoryIcon } from '../components/ui';
import { InstallCard } from '../components/InstallCard';

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { fetchStats().then(setStats).catch(() => setStats(null)); }, []);

  const pend = (stats?.por_estado.recibido ?? 0) + (stats?.por_estado.en_revision ?? 0);
  const topCats = stats
    ? CATEGORIES.map((c) => ({ ...c, n: stats.por_categoria[c.code] ?? 0 })).filter((c) => c.n > 0).sort((a, b) => b.n - a.n).slice(0, 5)
    : [];
  const maxCat = Math.max(1, ...topCats.map((c) => c.n));

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="hero-kicker"><MapPin size={14} />Santiago de Cali · Malla vial</span>
            <h1>Cada reporte, una ubicación; <em>cada cambio, una historia.</em></h1>
            <p className="hero-lead">
              Reporte huecos, grietas, hundimientos y otras afectaciones visibles de las vías de Cali.
              Ubíquelos en el mapa, adjunte una foto y siga el estado de su reporte con un código.
            </p>
            <div className="hero-actions">
              <Link to="/reportar" className="btn btn-primary btn-lg"><Plus size={20} />Reportar una afectación</Link>
              <Link to="/mapa" className="btn btn-lg"><MapIcon size={20} />Ver el mapa</Link>
            </div>
            <p className="small muted" style={{ marginTop: 14 }}>
              No necesita crear una cuenta. Tarda menos de dos minutos.
            </p>
          </div>
          <img src={logoFull} alt="Logotipo de GeoVía Cali" className="hero-logo" width={360} height={322} />
        </div>
      </section>

      <div className="container">
        <section className="section" aria-labelledby="cifras">
          <h2 id="cifras" className="sr-only">Cifras del prototipo</h2>
          <div className="stats">
            <div className="stat"><b>{stats ? stats.total : '—'}</b><span>Reportes registrados</span></div>
            <div className="stat"><b>{stats ? stats.publicos : '—'}</b><span>Validados en el mapa</span></div>
            <div className="stat"><b>{stats ? pend : '—'}</b><span>En cola de revisión</span></div>
            <div className="stat"><b>{stats ? stats.ultimos_7d : '—'}</b><span>Nuevos en 7 días</span></div>
          </div>
        </section>

        <section className="section" aria-labelledby="como">
          <h2 id="como">¿Cómo funciona?</h2>
          <div className="steps">
            <div className="step">
              <div className="step-icon" style={{ background: 'var(--amber-50)', color: 'var(--amber-700)' }}><MapPin /></div>
              <h3>1. Ubique el daño</h3>
              <p className="muted" style={{ margin: 0 }}>Use el GPS de su celular o toque el mapa. Le avisamos si ya existe un reporte a menos de 30 m.</p>
            </div>
            <div className="step">
              <div className="step-icon" style={{ background: 'var(--green-50)', color: 'var(--green-700)' }}><Camera /></div>
              <h3>2. Describa y fotografíe</h3>
              <p className="muted" style={{ margin: 0 }}>Elija el tipo de afectación, descríbala y tome hasta 3 fotos. Borramos los metadatos de ubicación de la foto.</p>
            </div>
            <div className="step">
              <div className="step-icon" style={{ background: 'var(--navy-50)', color: 'var(--navy)' }}><History /></div>
              <h3>3. Haga seguimiento</h3>
              <p className="muted" style={{ margin: 0 }}>Reciba un código como <span className="kbd">GVC-2611-7K4QM</span> y consulte cada cambio de estado con su motivo y fecha.</p>
            </div>
          </div>
        </section>

        <section className="section grid-2">
          <div className="card card-pad">
            <div className="card-title"><Search size={20} color="var(--navy)" /><h2>¿Ya reportó?</h2></div>
            <p className="muted">Consulte el estado con su código de seguimiento.</p>
            <Link to="/seguimiento" className="btn btn-navy">Consultar un reporte</Link>
          </div>
          <div className="card card-pad">
            <div className="card-title"><MapIcon size={20} color="var(--navy)" /><h2>Afectaciones más reportadas</h2></div>
            {topCats.length ? (
              <div className="bars">
                {topCats.map((c) => (
                  <div key={c.code} className="bar-row">
                    <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><CategoryIcon code={c.code} size={20} />{c.name}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(c.n / maxCat) * 100}%`, background: c.color }} /></div>
                    <b style={{ textAlign: 'right' }}>{c.n}</b>
                  </div>
                ))}
              </div>
            ) : <p className="muted">Aún no hay suficientes datos.</p>}
          </div>
        </section>

        <section className="section">
          <InstallCard />
        </section>

        <section className="section">
          <div className="alert alert-info">
            <Info size={20} />
            <div>
              <p><b>GeoVía Cali es un prototipo académico</b> (Ingeniería de Sistemas, UNAD). No reemplaza los canales oficiales de la Alcaldía
                ni garantiza reparaciones. Para reportes oficiales use los canales de la Secretaría de Infraestructura. Ante una emergencia, llame al <b>123</b>.</p>
              <p className="row small" style={{ gap: 6 }}><ShieldCheck size={16} />Sus datos se tratan conforme a la Ley 1581 de 2012. <Link to="/acerca">Ver política de privacidad</Link></p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
