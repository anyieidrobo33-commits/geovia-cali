import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileDown, RefreshCw, Search, Users } from 'lucide-react';
import { fetchReports, type Report } from '../lib/api';
import { reportsToCsv, downloadText } from '../lib/csv';
import { CATEGORIES, STATUSES, categoryMeta, type ReportStatus } from '../lib/domain';
import { fmtDate, fmtRelative } from '../lib/format';
import { friendlyError } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CategoryIcon, DemoBadge, Spinner, StatusBadge } from '../components/ui';

type Tab = 'pendientes' | ReportStatus | 'todos';

export default function PanelPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pendientes');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [hideDemo, setHideDemo] = useState(false);

  const load = async () => {
    setError(null);
    try { setReports(await fetchReports({ limit: 2000 })); } catch (e) { setError(friendlyError(e)); setReports([]); }
  };
  useEffect(() => { load(); }, []);

  const base = useMemo(() => (reports ?? []).filter((r) => !hideDemo || !r.is_demo), [reports, hideDemo]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: base.length, pendientes: 0 };
    for (const r of base) {
      c[r.status] = (c[r.status] ?? 0) + 1;
      if (r.status === 'recibido' || r.status === 'en_revision') c.pendientes++;
    }
    return c;
  }, [base]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = base.filter((r) =>
      (tab === 'todos' || (tab === 'pendientes' ? r.status === 'recibido' || r.status === 'en_revision' : r.status === tab)) &&
      (!cat || r.category_code === cat) &&
      (!term || `${r.code} ${r.sector ?? ''} ${r.address ?? ''} ${r.description}`.toLowerCase().includes(term)),
    );
    // Cola priorizada: primero los más apoyados por la ciudadanía; a igual apoyo, los más antiguos
    return tab === 'pendientes'
      ? [...list].sort((a, b) => (b.supports_count ?? 0) - (a.supports_count ?? 0) || a.created_at.localeCompare(b.created_at))
      : list;
  }, [base, tab, cat, q]);

  const byCat = useMemo(() => CATEGORIES.map((c) => ({ ...c, n: base.filter((r) => r.category_code === c.code).length })).sort((a, b) => b.n - a.n), [base]);
  const maxCat = Math.max(1, ...byCat.map((c) => c.n));
  const validRate = base.length ? Math.round(((counts.validado ?? 0) + (counts.cerrado ?? 0)) / base.length * 100) : 0;

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`geovia-cali-reportes-${stamp}.csv`, reportsToCsv(rows));
    toast(`${rows.length} reportes exportados (sin datos personales)`);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pendientes', label: 'Pendientes' },
    ...STATUSES.map((s) => ({ key: s.code as Tab, label: s.label })),
    { key: 'todos', label: 'Todos' },
  ];

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Panel de revisión</h1>
          <p>Moderación de reportes, trazabilidad e indicadores de la plataforma.</p>
        </div>
        <div className="row">
          {isAdmin && <Link to="/panel/usuarios" className="btn"><Users size={18} />Usuarios y roles</Link>}
          <button className="btn" onClick={load}><RefreshCw size={18} />Actualizar</button>
          <button className="btn btn-navy" onClick={exportCsv} disabled={!rows.length}><FileDown size={18} />Exportar CSV</button>
        </div>
      </div>

      {error && <div className="alert alert-danger" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b>{counts.todos}</b><span>Reportes totales</span></div>
        <div className="stat"><b style={{ color: 'var(--amber-700)' }}>{counts.pendientes}</b><span>Pendientes de revisión</span></div>
        <div className="stat"><b style={{ color: 'var(--green)' }}>{validRate}%</b><span>Validados o cerrados</span></div>
        <div className="stat"><b>{counts.duplicado ?? 0}</b><span>Duplicados vinculados</span></div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: undefined, marginBottom: 16 }}>
        <section className="card card-pad">
          <h2 style={{ fontSize: '1.05rem' }}>Reportes por tipo de afectación</h2>
          <div className="bars">
            {byCat.map((c) => (
              <div key={c.code} className="bar-row">
                <span className="row" style={{ gap: 6, flexWrap: 'nowrap', overflow: 'hidden' }}><CategoryIcon code={c.code} size={20} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span></span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(c.n / maxCat) * 100}%`, background: c.color }} /></div>
                <b style={{ textAlign: 'right' }}>{c.n}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="card card-pad">
          <h2 style={{ fontSize: '1.05rem' }}>Reportes por estado</h2>
          <div className="bars">
            {STATUSES.map((s) => (
              <div key={s.code} className="bar-row">
                <span><StatusBadge status={s.code} /></span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${((counts[s.code] ?? 0) / Math.max(1, counts.todos)) * 100}%`, background: 'var(--navy-600)' }} /></div>
                <b style={{ textAlign: 'right' }}>{counts[s.code] ?? 0}</b>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="tabs" role="tablist" aria-label="Estado">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label} <span className="count-pill">{counts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--ink-3)' }} aria-hidden="true" />
          <input className="input" style={{ paddingLeft: 38 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, barrio, dirección o texto" aria-label="Buscar" />
        </div>
        <select className="select input" style={{ flex: '0 1 240px' }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Tipo de afectación">
          <option value="">Todos los tipos</option>
          {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <label className="check small" style={{ alignItems: 'center' }}>
          <input type="checkbox" checked={hideDemo} onChange={(e) => setHideDemo(e.target.checked)} />Ocultar datos de demostración
        </label>
      </div>

      {reports === null ? <Spinner label="Cargando reportes…" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Tipo</th>
                <th scope="col">Sector</th>
                <th scope="col">Estado</th>
                <th scope="col">Severidad</th>
                <th scope="col" title="Apoyos «Yo también lo vi»">Apoyos</th>
                <th scope="col">Registrado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => navigate(`/r/${r.code}`)}>
                  <td><Link to={`/r/${r.code}`} className="code-display" onClick={(e) => e.stopPropagation()}>{r.code}</Link>{r.is_demo && <><br /><DemoBadge /></>}</td>
                  <td><span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><CategoryIcon code={r.category_code} size={22} />{categoryMeta(r.category_code).name}</span></td>
                  <td>{r.sector || '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ textTransform: 'capitalize' }}>{r.severity}</td>
                  <td><b>{r.supports_count ?? 0}</b></td>
                  <td title={fmtDate(r.created_at)}>{fmtRelative(r.created_at)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 28 }}>No hay reportes en esta vista.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
