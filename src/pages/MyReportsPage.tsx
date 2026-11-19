import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Plus } from 'lucide-react';
import { fetchReports, getRememberedCodes, signedPhotoUrls, trackByCode, type Report } from '../lib/api';
import { friendlyError } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ReportListItem } from '../components/ReportListItem';
import { CenterState, Spinner } from '../components/ui';

type Row = Pick<Report, 'code' | 'category_code' | 'status' | 'sector' | 'address' | 'created_at' | 'is_demo'> & { thumb?: string };

export default function MyReportsPage() {
  const { user, isAnonymous, ready } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const own = user ? await fetchReports({ onlyMine: user.id, limit: 200 }) : [];
        const firstPhotos = own.map((r) => r.report_photos?.[0]?.storage_path).filter(Boolean) as string[];
        const urls = await signedPhotoUrls(firstPhotos).catch(() => ({} as Record<string, string>));
        const list: Row[] = own.map((r) => ({ ...r, thumb: r.report_photos?.[0] ? urls[r.report_photos[0].storage_path] : undefined }));
        // Códigos enviados desde este dispositivo con otra sesión
        const known = new Set(list.map((r) => r.code));
        const extra = getRememberedCodes().filter((c) => !known.has(c));
        const tracked = await Promise.all(extra.map((c) => trackByCode(c).catch(() => null)));
        for (const t of tracked) if (t) list.push({ ...t, address: null });
        list.sort((a, b) => b.created_at.localeCompare(a.created_at));
        setRows(list);
      } catch (e) {
        setError(friendlyError(e));
        setRows([]);
      }
    })();
  }, [user, ready]);

  return (
    <div className="container container-narrow page">
      <div className="page-head">
        <div>
          <h1>Mis reportes</h1>
          <p>{isAnonymous || !user ? 'Reportes enviados desde este dispositivo.' : 'Reportes asociados a su cuenta y a este dispositivo.'}</p>
        </div>
        <Link to="/reportar" className="btn btn-primary"><Plus size={18} />Nuevo reporte</Link>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {rows === null ? <Spinner label="Cargando sus reportes…" /> : rows.length === 0 ? (
        <CenterState icon={<Inbox size={30} />} title="Aún no ha enviado reportes">
          <p>Cuando reporte una afectación, aparecerá aquí con su estado actualizado.</p>
          <Link to="/reportar" className="btn btn-primary"><Plus size={18} />Reportar una afectación</Link>
        </CenterState>
      ) : (
        <div className="report-list">
          {rows.map((r) => <ReportListItem key={r.code} report={r} thumbUrl={r.thumb} />)}
        </div>
      )}
      {(isAnonymous || !user) && rows && rows.length > 0 && (
        <p className="small muted" style={{ marginTop: 16 }}>
          Consejo: guarde sus códigos. Si borra los datos del navegador, podrá consultarlos igualmente en <Link to="/seguimiento">Seguimiento</Link>.
        </p>
      )}
    </div>
  );
}
