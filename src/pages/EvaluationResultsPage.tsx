import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileDown, QrCode, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { Spinner } from '../components/ui';
import { escapeCsv } from '../lib/csv';
import { DIAGNOSTIC, SUS_ITEMS, TASKS, fetchEvaluations, type EvaluationRow } from '../lib/evaluation';

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const susGrade = (x: number) => (x >= 85 ? 'Excelente' : x >= 71 ? 'Buena' : x >= 51 ? 'Aceptable (OK)' : 'Por mejorar');

function Bars({ rows, total }: { rows: [string, number][]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="hbars hbars-eval" role="list">
      {rows.map(([label, n]) => (
        <div key={label} className="hbar" role="listitem">
          <div className="hbar-label" title={label}>{label}</div>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(n / max) * 100}%` }} /></div>
          <div className="hbar-value">{n} · {pct(n, total)}</div>
        </div>
      ))}
    </div>
  );
}

function toCsv(rows: EvaluationRow[]): string {
  const head = ['id', 'fecha', 'dispositivo', ...DIAGNOSTIC.map((q) => q.id),
    ...TASKS.flatMap((t) => [`${t.id}_completada`, `${t.id}_con_ayuda`, `${t.id}_segundos`]), 'T4_respuesta',
    ...SUS_ITEMS.map((_, i) => `SUS${i + 1}`), 'SUS_puntaje', 'lo_mas_util', 'mejoraria'];
  const lines = [head.join(',')];
  rows.forEach((r, idx) => {
    const t = (id: string) => r.tasks?.find((x) => x.id === id);
    lines.push([
      `P${String(idx + 1).padStart(2, '0')}`, r.created_at, r.device ?? '',
      ...DIAGNOSTIC.map((q) => { const v = r.diagnostic[q.id]; return Array.isArray(v) ? v.join(' | ') : v ?? ''; }),
      ...TASKS.flatMap((x) => { const k = t(x.id); return k ? [k.completed ? 'si' : 'no', k.help ? 'si' : 'no', k.seconds] : ['', '', '']; }),
      t('T4')?.answer ?? '',
      ...(r.sus ?? Array(10).fill('')), r.sus_score ?? '', r.liked ?? '', r.improve ?? '',
    ].map(escapeCsv).join(','));
  });
  return '﻿' + lines.join('\n');
}

export default function EvaluationResultsPage() {
  const [rows, setRows] = useState<EvaluationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const link = `${window.location.origin}/evaluar`;

  const load = () => { setRows(null); fetchEvaluations().then(setRows).catch(() => setError('No se pudieron cargar los resultados.')); };
  useEffect(load, []);
  useEffect(() => { QRCode.toDataURL(link, { margin: 1, width: 360 }).then(setQr).catch(() => setQr(null)); }, [link]);

  const a = useMemo(() => {
    if (!rows) return null;
    const withTasks = rows.filter((r) => r.tasks && r.tasks.length);
    const tasks = TASKS.map((t) => {
      const rs = withTasks.map((r) => r.tasks!.find((x) => x.id === t.id)).filter(Boolean) as NonNullable<EvaluationRow['tasks']>;
      const ok = rs.filter((x) => x.completed);
      return { t, n: rs.length, ok: ok.length, alone: ok.filter((x) => !x.help).length, med: median(ok.map((x) => x.seconds)) };
    });
    const sus = withTasks.map((r) => Number(r.sus_score)).filter((x) => !Number.isNaN(x));
    const totalTasks = tasks.reduce((s, x) => s + x.n, 0);
    const totalAlone = tasks.reduce((s, x) => s + x.alone, 0);
    return { withTasks, tasks, sus, susMean: sus.length ? sus.reduce((s, x) => s + x, 0) / sus.length : 0, totalTasks, totalAlone };
  }, [rows]);

  const download = () => {
    if (!rows) return;
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const el = document.createElement('a'); el.href = url; el.download = `geovia-evaluacion-${new Date().toISOString().slice(0, 10)}.csv`; el.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container page">
      <Link to="/panel" className="small row" style={{ gap: 4, marginBottom: 8 }}><ArrowLeft size={16} />Volver al panel</Link>
      <div className="page-head">
        <div><h1>Resultados de la evaluación</h1><p>Respuestas anónimas registradas desde <span className="kbd">/evaluar</span>.</p></div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={load}><RefreshCw size={18} />Actualizar</button>
          <button className="btn btn-navy" onClick={download} disabled={!rows?.length}><FileDown size={18} />Exportar CSV</button>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card card-pad">
          <h2 className="card-title"><QrCode size={18} /> Enlace para participantes</h2>
          <p className="small" style={{ wordBreak: 'break-all' }}><a href={link}>{link}</a></p>
          {qr && <img src={qr} alt="Código QR del enlace de evaluación" width={180} height={180} />}
        </section>
        {a && (
          <section className="card card-pad">
            <h2 className="card-title">Resumen</h2>
            <div className="stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="stat"><b>{rows!.length}</b><span>Encuestas diagnósticas</span></div>
              <div className="stat"><b>{a.withTasks.length}</b><span>Probaron la app</span></div>
              <div className="stat"><b>{pct(a.totalAlone, a.totalTasks)}</b><span>Tareas completadas sin ayuda (meta ≥ 80 %)</span></div>
              <div className="stat"><b>{a.sus.length ? a.susMean.toFixed(1) : '—'}</b><span>SUS promedio {a.sus.length ? `· ${susGrade(a.susMean)}` : ''}</span></div>
            </div>
          </section>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      {!rows && !error && <Spinner label="Cargando resultados…" />}

      {a && rows!.length > 0 && (
        <>
          <section className="section card card-pad">
            <h2 className="card-title">Tareas de uso</h2>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Tarea</th><th>Participantes</th><th>Completada</th><th>Sin ayuda</th><th>Tiempo mediano</th></tr></thead>
              <tbody>{a.tasks.map((x) => (
                <tr key={x.t.id}><td>{x.t.id}. {x.t.title}</td><td>{x.n}</td><td>{pct(x.ok, x.n)}</td><td>{pct(x.alone, x.n)}</td><td>{x.ok ? fmtTime(x.med) : '—'}</td></tr>
              ))}</tbody>
            </table></div>
          </section>

          <section className="section">
            <h2>Encuesta diagnóstica (n = {rows!.length})</h2>
            <div className="grid-2" style={{ alignItems: 'start' }}>
              {DIAGNOSTIC.filter((q) => q.kind !== 'open').map((q) => {
                const counts = new Map<string, number>(q.options!.map((o) => [o, 0]));
                rows!.forEach((r) => { const v = r.diagnostic[q.id]; (Array.isArray(v) ? v : v ? [v] : []).forEach((o) => counts.set(o, (counts.get(o) ?? 0) + 1)); });
                return (
                  <div key={q.id} className="card card-pad">
                    <h3 style={{ fontSize: '0.98rem', marginTop: 0 }}>{q.id}. {q.text}</h3>
                    <Bars rows={[...counts.entries()]} total={rows!.length} />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="section card card-pad">
            <h2 className="card-title">Respuestas abiertas</h2>
            {[['P15. Qué debería mejorar en los mecanismos actuales', (r: EvaluationRow) => r.diagnostic.P15 as string],
              ['Lo más útil de GeoVía Cali', (r: EvaluationRow) => r.liked],
              ['Qué mejoraría de GeoVía Cali', (r: EvaluationRow) => r.improve]].map(([title, get]) => {
              const list = rows!.map(get as (r: EvaluationRow) => string | null).filter((x): x is string => Boolean(x && x.trim()));
              return (
                <div key={title as string} style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: '0.98rem' }}>{title as string} ({list.length})</h3>
                  {list.length ? <ul className="small">{list.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted small">Sin respuestas.</p>}
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
