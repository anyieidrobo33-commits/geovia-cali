import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap, Circle } from 'react-leaflet';
import { Camera, Filter, Flame, List, LocateFixed, Map as MapIcon, Plus, RefreshCw, X } from 'lucide-react';
import { HeatLayer } from 'leaflet.heat';
import type L from 'leaflet';
import { fetchReports, signedPhotoUrls, type Report } from '../lib/api';
import { CALI_CENTER, CATEGORIES, isPubliclyVisible, STATUSES, categoryMeta, type CategoryCode, type ReportStatus } from '../lib/domain';
import { categoryPin, TILE_ATTRIBUTION, TILE_URL, userLocationIcon } from '../components/mapIcons';
import { CategoryIcon, DemoBadge, Spinner, StatusBadge } from '../components/ui';
import SupportButton from '../components/SupportButton';
import { ReportListItem } from '../components/ReportListItem';
import { fmtDate } from '../lib/format';
import { friendlyError } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Range = 30 | 90 | 0;

/** Foto del reporte en la ventana del marcador (se firma solo al abrirla). */
function PopupPhoto({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { signedPhotoUrls([path]).then((u) => setUrl(u[path] ?? null)).catch(() => setUrl(null)); }, [path]);
  return url ? <img className="popup-photo" src={url} alt="Fotografía del daño" /> : <div className="popup-photo skeleton" />;
}

/** Zonas críticas: densidad de daños ponderada por severidad y apoyos ciudadanos. */
function HeatOverlay({ reports }: { reports: Report[] }) {
  const map = useMap();
  useEffect(() => {
    const sev = { baja: 0.45, media: 0.7, alta: 1 } as const;
    const pts = reports.map((r) => [r.lat, r.lng, Math.min(1, sev[r.severity] + (r.supports_count ?? 0) * 0.1)] as [number, number, number]);
    const layer = new HeatLayer(pts, {
      radius: 32, blur: 24, minOpacity: 0.35, max: 1,
      gradient: { 0.25: '#fde68a', 0.55: '#f59e0b', 0.8: '#dc2626', 1: '#7f1d1d' },
    });
    // Los tipos del plugin apuntan a Leaflet 2; en tiempo de ejecución es compatible con Leaflet 1.9.
    const asLayer = layer as unknown as L.Layer;
    asLayer.addTo(map);
    return () => { asLayer.remove(); };
  }, [reports, map]);
  return null;
}

/** Al cargar por primera vez, encuadra todos los reportes visibles. */
function FitToReports({ points }: { points: [number, number][] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    if (points.length === 1) map.setView(points[0], 16);
    else map.fitBounds(points, { paddingTopLeft: [30, 90], paddingBottomRight: [30, 90], maxZoom: 16 });
  }, [points, map]);
  return null;
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (target) map.flyTo(target, 16, { duration: 0.8 }); }, [target, map]);
  return null;
}

export default function MapPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [showFilters, setShowFilters] = useState(false);
  const [cats, setCats] = useState<Set<CategoryCode>>(new Set());
  const [sts, setSts] = useState<Set<ReportStatus>>(new Set());
  const [range, setRange] = useState<Range>(0);
  const [sector, setSector] = useState('');
  const [me, setMe] = useState<{ pos: [number, number]; acc: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [heat, setHeat] = useState(false);

  const load = async () => {
    setError(null);
    const t0 = performance.now();
    try {
      const data = await fetchReports({ limit: 1000 });
      setReports(data);
      setLoadMs(Math.round(performance.now() - t0));
    } catch (e) {
      setError(friendlyError(e));
      setReports([]);
    }
  };
  // Se recarga si cambia la sesión (un revisor ve más reportes que un visitante)
  useEffect(() => { load(); }, [user?.id]);

  const presentStatuses = useMemo(
    () => STATUSES.filter((s) => reports?.some((r) => r.status === s.code)),
    [reports],
  );

  const filtered = useMemo(() => {
    if (!reports) return [];
    const since = range ? Date.now() - range * 86400000 : 0;
    const q = sector.trim().toLowerCase();
    return reports.filter((r) =>
      (cats.size === 0 || cats.has(r.category_code)) &&
      (sts.size === 0 || sts.has(r.status)) &&
      (!since || new Date(r.created_at).getTime() >= since) &&
      (!q || `${r.sector ?? ''} ${r.address ?? ''} ${r.code}`.toLowerCase().includes(q)),
    );
  }, [reports, cats, sts, range, sector]);

  const reportPoints = useMemo(() => (reports ?? []).map((r) => [r.lat, r.lng] as [number, number]), [reports]);

  const activeFilters = cats.size + sts.size + (range ? 1 : 0) + (sector ? 1 : 0);

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v); else next.add(v);
    setter(next);
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setMe({ pos: [p.coords.latitude, p.coords.longitude], acc: p.coords.accuracy }); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const clearFilters = () => { setCats(new Set()); setSts(new Set()); setRange(0); setSector(''); };

  return (
    <div className="map-page">
      <MapContainer center={CALI_CENTER} zoom={13} minZoom={11} maxZoom={19} zoomControl={false}
        maxBounds={[[3.15, -76.85], [3.68, -76.3]]} style={{ visibility: view === 'map' ? 'visible' : 'hidden' }}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
        {filtered.map((r) => (
          <Marker key={r.id} position={[r.lat, r.lng]} icon={categoryPin(r.category_code, r.status)}
            title={`${categoryMeta(r.category_code).name} · ${r.sector ?? r.code}`} keyboard>
            <Popup autoPanPaddingTopLeft={[12, 78]} autoPanPaddingBottomRight={[12, 24]}
              eventHandlers={{ add: () => setOpenId(r.id), remove: () => setOpenId((o) => (o === r.id ? null : o)) }}>
              <div className="popup-title"><CategoryIcon code={r.category_code} size={26} />{categoryMeta(r.category_code).name}</div>
              <div className="row" style={{ gap: 6 }}>
                <StatusBadge status={r.status} />
                {r.is_demo && <DemoBadge />}
              </div>
              {openId === r.id && r.report_photos?.[0] && <PopupPhoto path={r.report_photos[0].storage_path} />}
              <p className="popup-desc">{r.description}</p>
              <div className="small muted" style={{ marginBottom: 8 }}>
                {r.sector ? `${r.sector} · ` : ''}{fmtDate(r.created_at)}
              </div>
              {isPubliclyVisible(r.status) && <div style={{ marginBottom: 6 }}><SupportButton reportId={r.id} count={r.supports_count ?? 0} /></div>}
              <div className="row" style={{ gap: 6 }}>
                <Link to={`/r/${r.code}`} className="btn btn-sm btn-navy" style={{ color: '#fff' }}>Ver detalle</Link>
                {isPubliclyVisible(r.status) && (
                  <Link to={`/r/${r.code}/actualizar`} className="btn btn-sm"><Camera size={14} />Actualizar</Link>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        {me && (
          <>
            <Circle center={me.pos} radius={me.acc} pathOptions={{ color: '#1971c2', weight: 1, fillOpacity: 0.08 }} />
            <Marker position={me.pos} icon={userLocationIcon} title="Su ubicación" />
          </>
        )}
        <FlyTo target={me?.pos ?? null} />
        {heat && <HeatOverlay reports={filtered} />}
        <FitToReports points={reportPoints} />
      </MapContainer>

      {view === 'list' && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'auto', background: 'var(--bg)', zIndex: 400, paddingTop: 72 }}>
          <div className="container container-narrow" style={{ paddingBottom: 24 }}>
            <h1 className="sr-only">Listado de reportes</h1>
            {filtered.length === 0 && reports && <p className="muted">No hay reportes con estos filtros.</p>}
            <div className="report-list">
              {filtered.map((r) => <ReportListItem key={r.id} report={r} />)}
            </div>
          </div>
        </div>
      )}

      <div className="map-toolbar">
        <div className="segmented floating" role="group" aria-label="Vista">
          <button aria-pressed={view === 'map'} onClick={() => setView('map')} aria-label="Ver mapa"><MapIcon size={16} /><span className="hide-xs">Mapa</span></button>
          <button aria-pressed={view === 'list'} onClick={() => setView('list')} aria-label="Ver lista"><List size={16} /><span className="hide-xs">Lista</span></button>
        </div>
        <button className="btn btn-sm floating" style={{ minHeight: 46 }} onClick={() => setShowFilters(true)} aria-expanded={showFilters}>
          <Filter size={16} />Filtros{activeFilters ? ` (${activeFilters})` : ''}
        </button>
        <div className="spacer" />
        <div className="floating map-count" aria-live="polite">
          {reports === null ? <Spinner size={16} label="Cargando" /> : <>{filtered.length}<span className="hide-xs"> reporte{filtered.length === 1 ? '' : 's'}</span></>}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert" style={{ position: 'absolute', zIndex: 550, top: 72, left: 12, right: 12 }}>
          {error} <button className="btn btn-sm" onClick={load}><RefreshCw size={14} />Reintentar</button>
        </div>
      )}

      {view === 'map' && (
        <>
          <div className="map-fab">
            <button className={`btn floating ${heat ? 'btn-amber' : ''}`} onClick={() => setHeat((h) => !h)} aria-pressed={heat}
              title="Mostrar zonas críticas (mapa de calor)"><Flame size={18} />Zonas críticas</button>
            <button className="btn floating icon-btn" onClick={locate} aria-label="Centrar en mi ubicación" title="Mi ubicación">
              {locating ? <Spinner size={18} /> : <LocateFixed size={20} />}
            </button>
            <Link to="/reportar" className="btn btn-primary" style={{ boxShadow: 'var(--shadow-lg)' }}><Plus size={20} />Reportar</Link>
          </div>
          <div className="map-legend floating" aria-label="Convenciones">
            <ul>
              {CATEGORIES.map((c) => (
                <li key={c.code}><span className="swatch" style={{ background: c.color }} />{c.name}</li>
              ))}
              <li className="muted" style={{ marginTop: 4 }}>Borde punteado: aún sin verificar</li>
              {heat && <li style={{ marginTop: 4, display: 'block' }}><b>Zonas críticas</b><div style={{ height: 8, borderRadius: 4, margin: '4px 0 2px', background: 'linear-gradient(90deg,#fde68a,#f59e0b,#dc2626,#7f1d1d)' }} /><span className="muted">menor → mayor concentración</span></li>}
            </ul>
            {loadMs !== null && <div className="muted" style={{ marginTop: 6 }}>{reports?.length ?? 0} marcadores cargados en {loadMs} ms</div>}
          </div>
        </>
      )}

      {showFilters && (
        <aside className="drawer" aria-label="Filtros">
          <div className="drawer-head">
            <h2>Filtrar reportes</h2>
            <div className="spacer" />
            <button className="btn btn-ghost icon-btn" onClick={() => setShowFilters(false)} aria-label="Cerrar filtros"><X size={20} /></button>
          </div>
          <div className="drawer-body">
            <div className="field">
              <label className="label" htmlFor="f-sector">Barrio, dirección o código</label>
              <input id="f-sector" className="input" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Ej.: San Fernando, Calle 5, GVC-…" />
            </div>
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ marginBottom: 6 }}>Tipo de afectación</legend>
              <div className="chips">
                {CATEGORIES.map((c) => (
                  <button key={c.code} className="chip" aria-pressed={cats.has(c.code)} onClick={() => toggle(cats, c.code, setCats)}>
                    <span className="swatch" style={{ background: c.color }} />{c.name}
                  </button>
                ))}
              </div>
            </fieldset>
            {presentStatuses.length > 1 && (
              <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="label" style={{ marginBottom: 6 }}>Estado</legend>
                <div className="chips">
                  {presentStatuses.map((s) => (
                    <button key={s.code} className="chip" aria-pressed={sts.has(s.code)} onClick={() => toggle(sts, s.code, setSts)}>{s.label}</button>
                  ))}
                </div>
              </fieldset>
            )}
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ marginBottom: 6 }}>Fecha de registro</legend>
              <div className="segmented" role="group">
                <button aria-pressed={range === 30} onClick={() => setRange(30)}>30 días</button>
                <button aria-pressed={range === 90} onClick={() => setRange(90)}>90 días</button>
                <button aria-pressed={range === 0} onClick={() => setRange(0)}>Todos</button>
              </div>
            </fieldset>
          </div>
          <div className="drawer-foot">
            <button className="btn" onClick={clearFilters} disabled={!activeFilters}>Limpiar</button>
            <button className="btn btn-navy" style={{ flex: 1 }} onClick={() => setShowFilters(false)}>Ver {filtered.length} resultados</button>
          </div>
        </aside>
      )}
    </div>
  );
}
