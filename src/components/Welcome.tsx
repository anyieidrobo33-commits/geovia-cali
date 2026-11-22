import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, ChevronRight, HandHeart, MapPin, ShieldCheck, Users, BellRing, X } from 'lucide-react';
import logoFull from '../assets/logo-full.png';

const KEY = 'geovia-bienvenida-v1';
export const resetWelcome = () => { try { localStorage.removeItem(KEY); } catch { /* */ } };

const SLIDES = [
  {
    icon: null,
    title: 'Bienvenido a GeoVía Cali',
    text: 'La plataforma ciudadana para reportar y hacer seguimiento a los daños de las vías de Cali. Cada reporte, una ubicación; cada cambio, una historia.',
    points: [] as { icon: typeof MapPin; text: string }[],
  },
  {
    icon: MapPin,
    title: 'Reporte en menos de 2 minutos',
    text: 'Sin crear cuenta. Ubique el daño con su GPS, elija el tipo, tome una foto y reciba un código de seguimiento.',
    points: [
      { icon: Camera, text: 'Sus fotos se envían sin la ubicación oculta del teléfono.' },
      { icon: ShieldCheck, text: 'Nunca publicamos quién reportó.' },
    ],
  },
  {
    icon: Users,
    title: 'Entre todos, mejor información',
    text: 'Apoye los daños que usted también ha visto, actualícelos desde el sitio con una foto del momento y siga los que le importan.',
    points: [
      { icon: HandHeart, text: '«Yo también lo vi» prioriza la revisión.' },
      { icon: BellRing, text: 'Le avisamos cuando un reporte que sigue cambie.' },
    ],
  },
];

/** Pantallas de bienvenida la primera vez que se abre la app. */
export default function Welcome() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [i, setI] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let seen = true;
    try { seen = localStorage.getItem(KEY) === '1'; } catch { /* */ }
    // Quien llega por un enlace compartido ve primero el reporte
    if (!seen && !pathname.startsWith('/r/') && !pathname.startsWith('/confirmacion') && !pathname.startsWith('/evaluar')) setShow(true);
  }, [pathname]);

  useEffect(() => { if (show) dialog.current?.focus(); }, [show, i]);

  if (!show) return null;
  const done = (to?: string) => {
    try { localStorage.setItem(KEY, '1'); } catch { /* */ }
    setShow(false);
    if (to) navigate(to);
  };
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title"
      onKeyDown={(e) => { if (e.key === 'Escape') done(); if (e.key === 'ArrowRight' && !last) setI(i + 1); if (e.key === 'ArrowLeft' && i) setI(i - 1); }}>
      <div className="welcome-card" ref={dialog} tabIndex={-1}>
        <button className="btn btn-ghost icon-btn welcome-skip" onClick={() => done()} aria-label="Omitir bienvenida"><X size={20} /></button>
        <div className="welcome-art">
          {s.icon ? <span className="welcome-icon"><s.icon size={44} /></span> : <img src={logoFull} alt="GeoVía Cali" className="welcome-logo" />}
        </div>
        <h2 id="welcome-title">{s.title}</h2>
        <p className="muted">{s.text}</p>
        {s.points.length > 0 && (
          <ul className="welcome-points">
            {s.points.map((p) => <li key={p.text}><p.icon size={18} />{p.text}</li>)}
          </ul>
        )}
        <div className="welcome-dots" aria-hidden="true">{SLIDES.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}</div>
        {last ? (
          <div className="stack" style={{ gap: 8 }}>
            <button className="btn btn-primary btn-lg btn-block" onClick={() => done('/reportar')}>Reportar un daño</button>
            <button className="btn btn-block" onClick={() => done('/mapa')}>Explorar el mapa</button>
          </div>
        ) : (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn btn-ghost" onClick={() => done()}>Omitir</button>
            <button className="btn btn-navy" onClick={() => setI(i + 1)}>Siguiente<ChevronRight size={18} /></button>
          </div>
        )}
        <p className="small muted" style={{ margin: '10px 0 0', textAlign: 'center' }}>Paso {i + 1} de {SLIDES.length}</p>
      </div>
    </div>
  );
}
