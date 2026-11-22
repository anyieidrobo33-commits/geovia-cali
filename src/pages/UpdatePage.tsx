import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, CircleAlert, CircleCheck, LocateFixed, MapPin, Send, ShieldCheck } from 'lucide-react';
import LiveCamera, { type LiveShot } from '../components/LiveCamera';
import { CategoryIcon, CenterState, Spinner, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchReportByCode, signedPhotoUrls, submitUpdate, uploadPhoto, type Report } from '../lib/api';
import {
  CONDITIONS, PUBLIC_STATUSES, UPDATE_COMMENT_MAX, UPDATE_MAX_ACCURACY_M, UPDATE_MAX_DISTANCE_M,
  categoryMeta, checkOnSite, type GpsFix, type UpdateCondition,
} from '../lib/domain';
import { friendlyError } from '../lib/supabase';

const FIX_MAX_AGE_MS = 5 * 60 * 1000;

export default function UpdatePage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { ensureSession, user } = useAuth();
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [refPhoto, setRefPhoto] = useState<string | null>(null);
  const [fix, setFix] = useState<(GpsFix & { at: number }) | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [shot, setShot] = useState<LiveShot | null>(null);
  const [condition, setCondition] = useState<UpdateCondition | ''>('');
  const [comment, setComment] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReportByCode(code.toUpperCase())
      .then(async (r) => {
        setReport(r);
        const p = r?.report_photos?.[0]?.storage_path;
        if (p) setRefPhoto((await signedPhotoUrls([p]).catch(() => ({} as Record<string, string>)))[p] ?? null);
      })
      .catch(() => setReport(null));
  }, [code, user?.id]);

  if (report === undefined) return <div className="container page"><Spinner label="Cargando reporte…" /></div>;
  const canUpdate = report && (PUBLIC_STATUSES.includes(report.status) || report.created_by === user?.id);
  if (!report || !canUpdate) {
    return (
      <div className="container container-narrow page">
        <CenterState icon={<CircleAlert size={30} />} title="Este reporte no se puede actualizar">
          <p>Solo se actualizan reportes publicados en el mapa.</p>
          <Link to="/comunidad" className="btn btn-navy">Ver reportes de la comunidad</Link>
        </CenterState>
      </div>
    );
  }

  const site = checkOnSite([report.lat, report.lng], fix);
  const fixFresh = fix ? Date.now() - fix.at < FIX_MAX_AGE_MS : false;
  const cat = categoryMeta(report.category_code);

  const locate = () => {
    if (!('geolocation' in navigator)) { setGpsError('Este dispositivo no permite obtener la ubicación.'); return; }
    setGpsBusy(true); setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() });
        setGpsBusy(false);
      },
      (err) => {
        setGpsBusy(false);
        setGpsError(err.code === err.PERMISSION_DENIED
          ? 'Debe permitir el acceso a la ubicación para actualizar un reporte (candado junto a la dirección web → Ubicación → Permitir).'
          : 'No fue posible obtener la ubicación. Verifique que el GPS esté encendido e intente de nuevo.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const ready = site.ok && fixFresh && shot && condition && consent;

  const send = async () => {
    setError(null);
    if (!fix || !site.ok) { setError(site.error ?? 'Verifique su ubicación.'); return; }
    if (!fixFresh) { setError('Su ubicación tiene más de 5 minutos. Verifíquela de nuevo.'); return; }
    if (!shot) { setError('Tome la foto del estado actual del daño.'); return; }
    if (!condition) { setError('Indique cómo está el daño ahora.'); return; }
    if (!consent) { setError('Debe aceptar el tratamiento de datos.'); return; }
    try {
      setSending('Preparando sesión segura…');
      const u = await ensureSession();
      setSending('Subiendo la foto…');
      const path = await uploadPhoto(u.id, `act-${crypto.randomUUID()}`, shot.blob);
      setSending('Registrando la actualización…');
      await submitUpdate({ reportId: report.id, condition, comment, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, photoPath: path, consent });
      toast('¡Gracias! Su actualización ya es visible para la comunidad');
      navigate(`/r/${report.code}#actualizaciones`, { replace: true });
    } catch (e) {
      setError(friendlyError(e));
      setSending(null);
    }
  };

  return (
    <div className="container container-narrow page stack" style={{ gap: 16 }}>
      <div>
        <Link to={`/r/${report.code}`} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><ArrowLeft size={16} />Volver al reporte</Link>
        <h1 style={{ margin: '6px 0 4px' }}>Actualizar reporte</h1>
        <p className="muted" style={{ margin: 0 }}>Cuéntele a la comunidad cómo está este daño hoy. Se requiere estar en el sitio y tomar la foto en el momento.</p>
      </div>

      <section className="card card-pad row" style={{ alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
        {refPhoto ? <img src={refPhoto} alt="Foto original del reporte" className="thumb" style={{ width: 72, height: 72 }} /> : <CategoryIcon code={cat.code} size={56} />}
        <div style={{ minWidth: 0 }}>
          <b style={{ color: 'var(--navy)' }}>{cat.name}</b> <StatusBadge status={report.status} />
          <div className="small muted">{report.address || ''}{report.sector ? ` · ${report.sector}` : ''}</div>
          <div className="small code-display">{report.code}</div>
        </div>
      </section>

      {/* Paso 1: ubicación */}
      <section className="card card-pad stack" aria-labelledby="u1">
        <div className="card-title"><MapPin size={20} color="var(--navy)" /><h2 id="u1" style={{ fontSize: '1.1rem' }}>1. Confirme que está en el sitio</h2></div>
        <p className="small muted" style={{ margin: 0 }}>Debe estar a menos de {UPDATE_MAX_DISTANCE_M} m del daño, con GPS de precisión ± {UPDATE_MAX_ACCURACY_M} m o mejor.</p>
        <button className="btn btn-navy btn-lg" onClick={locate} disabled={gpsBusy}>
          {gpsBusy ? <Spinner label="Obteniendo ubicación GPS…" /> : <><LocateFixed size={20} />{fix ? 'Verificar de nuevo' : 'Verificar mi ubicación'}</>}
        </button>
        {gpsError && <div className="alert alert-danger" role="alert"><CircleAlert size={18} />{gpsError}</div>}
        {fix && (
          <>
            <div className="gps-panel">
              <div className="fact"><dt>Distancia al daño</dt><dd>{site.distance ?? '—'} m</dd></div>
              <div className="fact"><dt>Precisión del GPS</dt><dd>± {Math.round(fix.accuracy)} m</dd></div>
            </div>
            {site.ok
              ? <div className="alert alert-success" role="status"><CircleCheck size={18} />Ubicación verificada: está en el sitio.</div>
              : <div className="alert alert-warning" role="alert"><CircleAlert size={18} />{site.error}</div>}
          </>
        )}
      </section>

      {/* Paso 2: foto en vivo */}
      <section className="card card-pad stack" aria-labelledby="u2" style={{ opacity: site.ok ? 1 : 0.55 }}>
        <div className="card-title"><Camera size={20} color="var(--navy)" /><h2 id="u2" style={{ fontSize: '1.1rem' }}>2. Tome la foto ahora</h2></div>
        <p className="small muted" style={{ margin: 0 }}>Solo se acepta una foto tomada en este momento con la cámara. Encuadre el mismo punto de la foto original.</p>
        {site.ok ? <LiveCamera onShot={setShot} /> : <p className="small" style={{ margin: 0 }}>Primero verifique su ubicación.</p>}
      </section>

      {/* Paso 3: estado */}
      <section className="card card-pad stack" aria-labelledby="u3">
        <div className="card-title"><h2 id="u3" style={{ fontSize: '1.1rem' }}>3. ¿Cómo está el daño ahora?</h2></div>
        <div className="cond-grid" role="radiogroup" aria-label="Estado observado">
          {CONDITIONS.map((c) => (
            <button key={c.code} type="button" role="radio" aria-checked={condition === c.code} className="cond-option" onClick={() => setCondition(c.code)}>
              <b>{c.label}</b><span>{c.hint}</span>
            </button>
          ))}
        </div>
        <div className="field">
          <label className="label" htmlFor="cmt">Comentario <span className="opt">(opcional)</span></label>
          <textarea id="cmt" className="textarea" style={{ minHeight: 80 }} maxLength={UPDATE_COMMENT_MAX} value={comment}
            onChange={(e) => setComment(e.target.value)} placeholder="Ej.: Con la lluvia de anoche el hueco se hizo más grande." />
          <span className="counter">{comment.length}/{UPDATE_COMMENT_MAX}</span>
        </div>
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="small">Autorizo el tratamiento de la foto y del comentario con fines académicos (Ley 1581 de 2012). Mi ubicación exacta
            solo se usa para verificar que estoy en el sitio y <b>no se publica</b>. <Link to="/acerca#privacidad" target="_blank">Política de privacidad</Link>.</span>
        </label>
      </section>

      {error && <div className="alert alert-danger" role="alert"><CircleAlert size={18} />{error}</div>}
      <p className="small muted row" style={{ gap: 6, margin: 0 }}><ShieldCheck size={16} />No necesita cuenta. Su ubicación y su identidad no se muestran en la comunidad.</p>

      <div className="wizard-nav">
        <button className="btn btn-primary btn-lg" onClick={send} disabled={!ready || Boolean(sending)} aria-busy={Boolean(sending)}>
          {sending ? <Spinner label={sending} /> : <><Send size={18} />Publicar actualización</>}
        </button>
      </div>
    </div>
  );
}
