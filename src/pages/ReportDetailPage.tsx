import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { ArrowLeft, Copy, ExternalLink, History, ImageOff, Lock, MapPin, RefreshCw, SearchX, X } from 'lucide-react';
import {
  fetchHistory, fetchReportByCode, fetchReportCodeById, signedPhotoUrls, trackByCode,
  type HistoryEntry, type PublicTracking, type Report,
} from '../lib/api';
import { categoryMeta, SEVERITIES, statusMeta } from '../lib/domain';
import { fmtCoord, fmtDateTime } from '../lib/format';
import { friendlyError } from '../lib/supabase';
import { categoryPin, TILE_ATTRIBUTION, TILE_URL } from '../components/mapIcons';
import Timeline from '../components/Timeline';
import ReviewActions from '../components/ReviewActions';
import { CategoryIcon, CenterState, DemoBadge, Spinner, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function ReportDetailPage() {
  const { code = '' } = useParams();
  const { isStaff, user } = useAuth();
  const toast = useToast();
  const [tracking, setTracking] = useState<PublicTracking | null | undefined>(undefined);
  const [report, setReport] = useState<Report | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [dupCode, setDupCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const t = await trackByCode(code.toUpperCase());
      setTracking(t);
      if (t?.full_access) {
        const r = await fetchReportByCode(t.code);
        setReport(r);
        if (r) {
          const [h, urls] = await Promise.all([
            fetchHistory(r.id),
            signedPhotoUrls((r.report_photos ?? []).map((p) => p.storage_path)).catch(() => ({} as Record<string, string>)),
          ]);
          setHistory(h);
          setPhotos(Object.values(urls));
          setDupCode(r.duplicate_of ? await fetchReportCodeById(r.duplicate_of) : null);
        }
      } else {
        setReport(null);
        setHistory(t?.history ?? []);
      }
    } catch (e) {
      setError(friendlyError(e));
      setTracking(null);
    }
  }, [code]);

  useEffect(() => { load(); }, [load, user?.id]);

  if (tracking === undefined) return <div className="container page"><Spinner label="Consultando reporte…" /></div>;
  if (error) {
    return (
      <div className="container container-narrow page">
        <div className="alert alert-danger" role="alert">{error} <button className="btn btn-sm" onClick={load}><RefreshCw size={14} />Reintentar</button></div>
      </div>
    );
  }
  if (!tracking) {
    return (
      <div className="container container-narrow page">
        <CenterState icon={<SearchX size={30} />} title="No encontramos ese código">
          <p>Verifique que esté escrito como <span className="kbd">GVC-AAMM-XXXXX</span>.</p>
          <Link to="/seguimiento" className="btn btn-navy">Buscar otro código</Link>
        </CenterState>
      </div>
    );
  }

  const meta = statusMeta(tracking.status);
  const cat = categoryMeta(tracking.category_code);

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <Link to={isStaff ? '/panel' : '/mapa'} className="btn btn-ghost btn-sm" style={{ marginLeft: -8, marginBottom: 6 }}>
            <ArrowLeft size={16} />{isStaff ? 'Volver al panel' : 'Volver al mapa'}
          </Link>
          <h1 className="row" style={{ gap: 10, marginBottom: 6 }}><CategoryIcon code={cat.code} size={38} />{cat.name}</h1>
          <div className="row">
            <span className="code-display">{tracking.code}</span>
            <button className="btn btn-ghost btn-sm" aria-label="Copiar código" onClick={() => navigator.clipboard?.writeText(tracking.code).then(() => toast('Código copiado'))}><Copy size={14} /></button>
            <StatusBadge status={tracking.status} />
            {tracking.is_demo && <DemoBadge />}
          </div>
        </div>
      </div>

      <div className={`alert alert-${meta.tone === 'success' ? 'success' : meta.tone === 'danger' ? 'danger' : meta.tone === 'warning' ? 'warning' : 'info'}`} style={{ marginBottom: 16 }}>
        <div><b>{meta.label}:</b> {meta.description}</div>
      </div>

      <div className="detail-grid">
        <div className="stack" style={{ gap: 16 }}>
          {report ? (
            <section className="card card-pad stack">
              <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Descripción</h2>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{report.description}</p>
              {report.reference && <p className="small" style={{ margin: 0 }}><b>Referencia:</b> {report.reference}</p>}
              <dl className="facts" style={{ margin: 0 }}>
                <div className="fact"><dt>Severidad percibida</dt><dd>{SEVERITIES.find((s) => s.code === report.severity)?.label}</dd></div>
                <div className="fact"><dt>Registrado</dt><dd>{fmtDateTime(report.created_at)}</dd></div>
                <div className="fact"><dt>Barrio o sector</dt><dd>{report.sector || '—'}</dd></div>
                <div className="fact"><dt>Dirección aprox.</dt><dd>{report.address || '—'}</dd></div>
                <div className="fact"><dt>Origen ubicación</dt><dd>{report.location_source === 'gps' ? `GPS${report.location_accuracy_m ? ` (±${Math.round(report.location_accuracy_m)} m)` : ''}` : 'Marcada en mapa'}</dd></div>
                <div className="fact"><dt>Última actualización</dt><dd>{fmtDateTime(report.updated_at)}</dd></div>
              </dl>
              {dupCode && (
                <p className="small" style={{ margin: 0 }}>Vinculado como duplicado de <Link to={`/r/${dupCode}`} className="code-display">{dupCode}</Link>.</p>
              )}
            </section>
          ) : (
            <section className="card card-pad">
              <div className="row" style={{ gap: 8 }}><Lock size={18} color="var(--ink-3)" /><b>Detalle reservado</b></div>
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                Este reporte aún no es público. Solo su autor (desde el dispositivo o la cuenta con que lo envió) y los revisores ven la descripción,
                la ubicación y las fotografías. El historial de estados sí es consultable con el código.
              </p>
            </section>
          )}

          {report && (
            <section className="card card-pad stack">
              <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Evidencia fotográfica</h2>
              {photos.length ? (
                <div className="gallery">
                  {photos.map((u, i) => (
                    <button key={u} onClick={() => setZoom(u)} aria-label={`Ampliar fotografía ${i + 1}`}>
                      <img src={u} alt={`Fotografía ${i + 1} del reporte ${tracking.code}`} loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted row small" style={{ margin: 0 }}><ImageOff size={16} />{tracking.is_demo ? 'Registro de demostración sin fotografía.' : 'No hay fotografías disponibles.'}</p>
              )}
            </section>
          )}

          {report && (
            <section className="card card-pad stack">
              <div className="row"><h2 style={{ fontSize: '1.15rem', margin: 0, flex: 1 }}>Ubicación</h2>
                <a className="btn btn-sm" href={`https://www.google.com/maps/search/?api=1&query=${report.lat},${report.lng}`} target="_blank" rel="noreferrer"><ExternalLink size={14} />Abrir en Maps</a>
              </div>
              <div className="mini-map">
                <MapContainer center={[report.lat, report.lng]} zoom={17} scrollWheelZoom={false} dragging={!('ontouchstart' in window)}>
                  <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
                  <Marker position={[report.lat, report.lng]} icon={categoryPin(report.category_code)} />
                </MapContainer>
              </div>
              <p className="small muted row" style={{ margin: 0 }}><MapPin size={14} />{fmtCoord(report.lat, report.lng)}</p>
            </section>
          )}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          {isStaff && report && <ReviewActions report={report} onChanged={load} />}
          <section className="card card-pad">
            <div className="card-title"><History size={20} color="var(--navy)" /><h2 style={{ fontSize: '1.15rem' }}>Historial de estados</h2></div>
            <Timeline entries={history} />
          </section>
        </div>
      </div>

      {zoom && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Fotografía ampliada" onClick={() => setZoom(null)}>
          <button className="btn close" onClick={() => setZoom(null)} aria-label="Cerrar"><X size={20} /></button>
          <img src={zoom} alt="Fotografía ampliada del reporte" />
        </div>
      )}
    </div>
  );
}
