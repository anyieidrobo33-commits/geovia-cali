import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Clock, Database, Download, FileDown, FileJson, HandHeart, MapPinned, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import { fetchPublicStats, fetchReports, type PublicStats } from '../lib/api';
import { CATEGORIES, CONDITIONS, SEVERITIES, STATUSES, categoryMeta } from '../lib/domain';
import { reportsToCsv, downloadText } from '../lib/csv';
import { reportsToGeoJSON } from '../lib/opendata';
import { friendlyError } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { CategoryIcon, ConditionBadge, Spinner, StatusBadge } from '../components/ui';

const monthFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Barras horizontales de un solo tono; la identidad la dan la etiqueta y el ícono, no el color. */
function HBars({ rows, unit = 'reportes' }: { rows: { key: string; label: React.ReactNode; n: number }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="muted small" style={{ margin: 0 }}>Aún no hay datos.</p>;
  return (
    <div className="hbars" role="list">
      {rows.map((r) => (
        <div key={r.key} className="hbar" role="listitem" title={`${r.n} ${unit}`}>
          <div className="hbar-label">{r.label}</div>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(r.n / max) * 100}%` }} /></div>
          <div className="hbar-value">{r.n}</div>
        </div>
      ))}
    </div>
  );
}

/** Tendencia semanal: columnas de un solo tono, base en cero, tooltip por columna y tabla alternativa. */
function WeeklyChart({ data }: { data: { semana: string; n: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, pad = { l: 34, r: 8, t: 14, b: 28 };
  const raw = Math.max(1, ...data.map((d) => d.n));
  const step = Math.max(1, Math.ceil(raw / 4));
  const max = step * Math.ceil(raw / step);
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const bw = (W - pad.l - pad.r) / data.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Reportes registrados por semana, últimas 12 semanas" className="weekly">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * bw + 2;
          const h = Math.max(0, y(0) - y(d.n));
          const r = Math.min(4, h / 2, (bw - 4) / 2);
          return (
            <g key={d.semana} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              {d.n > 0 && (
                <path className={`col ${hover === i ? 'is-hover' : ''}`}
                  d={`M${x},${y(0)} V${y(d.n) + r} Q${x},${y(d.n)} ${x + r},${y(d.n)} H${x + bw - 4 - r} Q${x + bw - 4},${y(d.n)} ${x + bw - 4},${y(d.n) + r} V${y(0)} Z`} />
              )}
              {i % 2 === 1 && <text x={x + (bw - 4) / 2} y={H - 8} textAnchor="middle" className="axis">{monthFmt.format(new Date(d.semana))}</text>}
              <title>{`Semana del ${monthFmt.format(new Date(d.semana))}: ${d.n} reporte${d.n === 1 ? '' : 's'}`}</title>
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} className="baseline" />
      </svg>
      {hover !== null && (
        <p className="small" style={{ margin: '4px 0 0' }} aria-live="polite">
          Semana del <b>{monthFmt.format(new Date(data[hover].semana))}</b>: <b>{data[hover].n}</b> reporte{data[hover].n === 1 ? '' : 's'}
        </p>
      )}
      <details className="small" style={{ marginTop: 6 }}>
        <summary>Ver como tabla</summary>
        <table className="table" style={{ marginTop: 6 }}>
          <thead><tr><th>Semana</th><th>Reportes</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.semana}><td>{monthFmt.format(new Date(d.semana))}</td><td>{d.n}</td></tr>)}</tbody>
        </table>
      </details>
    </>
  );
}

export default function StatsPage() {
  const toast = useToast();
  const [s, setS] = useState<PublicStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = () => { setError(null); fetchPublicStats().then(setS).catch((e) => setError(friendlyError(e))); };
  useEffect(load, []);

  const cats = useMemo(() => s ? CATEGORIES.map((c) => ({ key: c.code, n: s.por_categoria[c.code] ?? 0,
    label: <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><CategoryIcon code={c.code} size={20} />{c.name}</span> }))
    .filter((c) => c.n > 0).sort((a, b) => b.n - a.n) : [], [s]);

  const download = async (kind: 'geojson' | 'csv') => {
    setDownloading(kind);
    try {
      const rows = (await fetchReports({ limit: 5000 })).filter((r) => r.status !== 'rechazado');
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === 'geojson') downloadText(`geovia-cali-${stamp}.geojson`, JSON.stringify(reportsToGeoJSON(rows), null, 2), 'application/geo+json');
      else downloadText(`geovia-cali-${stamp}.csv`, reportsToCsv(rows));
      toast(`${rows.length} reportes descargados (sin datos personales)`);
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setDownloading(null); }
  };

  if (error) return <div className="container page"><div className="alert alert-danger" role="alert">{error} <button className="btn btn-sm" onClick={load}><RefreshCw size={14} />Reintentar</button></div></div>;
  if (!s) return <div className="container page"><Spinner label="Calculando estadísticas…" /></div>;

  const pctVer = s.total ? Math.round((s.verificados / s.total) * 100) : 0;

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1 className="row" style={{ gap: 10 }}><BarChart3 size={30} />Estadísticas de la ciudad</h1>
          <p>Así va la malla vial de Cali según los reportes ciudadanos. Datos agregados, sin información personal.</p>
        </div>
        <div className="row">
          <button className="btn btn-navy" disabled={pdfBusy} onClick={async () => {
            setPdfBusy(true);
            try { const { cityPdf } = await import('../lib/pdf'); await cityPdf(s); }
            catch { toast('No fue posible generar el PDF', 'error'); } finally { setPdfBusy(false); }
          }}>{pdfBusy ? <Spinner size={16} /> : <FileDown size={18} />}Informe PDF</button>
          <Link to="/mapa" className="btn"><MapPinned size={18} />Ver zonas críticas</Link>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b>{s.total}</b><span>Reportes visibles</span></div>
        <div className="stat"><b>{pctVer}%</b><span>Verificados por revisores ({s.verificados})</span></div>
        <div className="stat"><b>{s.apoyos}</b><span><HandHeart size={13} style={{ verticalAlign: '-2px' }} /> Apoyos «Yo también lo vi»</span></div>
        <div className="stat"><b>{s.actualizaciones}</b><span>Actualizaciones en el sitio</span></div>
      </div>
      <div className="stats" style={{ marginBottom: 20 }}>
        <div className="stat"><b>{s.sin_verificar}</b><span>Pendientes de verificación</span></div>
        <div className="stat"><b>{s.horas_validacion_mediana ?? '—'}{s.horas_validacion_mediana != null && <small style={{ fontSize: '0.9rem' }}> h</small>}</b><span><Clock size={13} style={{ verticalAlign: '-2px' }} /> Mediana hasta la verificación</span></div>
        <div className="stat"><b>{s.reparados_segun_ciudadanos}</b><span><Wrench size={13} style={{ verticalAlign: '-2px' }} /> Reparados según ciudadanos</span></div>
        <div className="stat"><b>{s.por_severidad.alta ?? 0}</b><span>Daños de severidad alta</span></div>
      </div>

      <section className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.1rem' }}>Reportes registrados por semana</h2>
        <p className="small muted" style={{ marginTop: -4 }}>Últimas 12 semanas</p>
        <WeeklyChart data={s.por_semana} />
      </section>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <section className="card card-pad">
          <h2 style={{ fontSize: '1.1rem' }}>Tipos de daño más reportados</h2>
          <HBars rows={cats} />
        </section>
        <section className="card card-pad">
          <h2 style={{ fontSize: '1.1rem' }}>Barrios con más reportes</h2>
          <HBars rows={s.top_sectores.map((t) => ({ key: t.sector, n: t.n, label: t.sector }))} />
        </section>
        <section className="card card-pad">
          <h2 style={{ fontSize: '1.1rem' }}>Estado de verificación</h2>
          <HBars rows={STATUSES.filter((x) => x.code !== 'rechazado').map((x) => ({ key: x.code, n: s.por_estado[x.code] ?? 0, label: <StatusBadge status={x.code} /> })).filter((r) => r.n > 0)} />
        </section>
        <section className="card card-pad">
          <h2 style={{ fontSize: '1.1rem' }}>Severidad percibida</h2>
          <HBars rows={SEVERITIES.map((x) => ({ key: x.code, n: s.por_severidad[x.code] ?? 0, label: x.label }))} />
          <h2 style={{ fontSize: '1.1rem', marginTop: 18 }}>Lo que observan los ciudadanos en el sitio</h2>
          <HBars unit="actualizaciones" rows={CONDITIONS.map((c) => ({ key: c.code, n: s.condiciones[c.code] ?? 0, label: <ConditionBadge condition={c.code} /> })).filter((r) => r.n > 0)} />
        </section>
      </div>

      <section className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.1rem' }} className="row"><HandHeart size={20} />Los más apoyados por la ciudadanía</h2>
        {s.mas_apoyados.length === 0 ? <p className="small muted" style={{ margin: 0 }}>Aún no hay apoyos. Abra un reporte y toque «Yo también lo vi».</p> : (
          <ol className="stack" style={{ margin: 0, paddingLeft: '1.2em' }}>
            {s.mas_apoyados.map((m) => (
              <li key={m.code}>
                <Link to={`/r/${m.code}`} className="row" style={{ gap: 8, textDecoration: 'none' }}>
                  <CategoryIcon code={m.category_code} size={22} /><b>{categoryMeta(m.category_code).name}</b>
                  <span className="muted small">{m.sector ?? ''}</span><StatusBadge status={m.status} />
                  <span className="badge tone-warning"><HandHeart size={12} />{m.apoyos}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card card-pad stack" id="datos-abiertos">
        <h2 style={{ fontSize: '1.1rem', margin: 0 }} className="row"><Database size={20} />Datos abiertos</h2>
        <p className="small" style={{ margin: 0 }}>
          Descargue los reportes visibles para analizarlos en QGIS, ArcGIS, Excel o Power BI. Licencia <b>CC BY 4.0</b> (cite «GeoVía Cali»).
        </p>
        <div className="row">
          <button className="btn btn-navy" onClick={() => download('geojson')} disabled={Boolean(downloading)}>
            {downloading === 'geojson' ? <Spinner label="Preparando…" /> : <><FileJson size={18} />Descargar GeoJSON</>}
          </button>
          <button className="btn" onClick={() => download('csv')} disabled={Boolean(downloading)}>
            {downloading === 'csv' ? <Spinner label="Preparando…" /> : <><Download size={18} />Descargar CSV</>}
          </button>
        </div>
        <p className="small muted row" style={{ gap: 6, margin: 0 }}><ShieldCheck size={16} />Incluye código, tipo, severidad, estado, barrio, dirección aproximada, descripción, apoyos, fechas y coordenadas. Nunca incluye datos de quien reportó.</p>
      </section>
    </div>
  );
}
