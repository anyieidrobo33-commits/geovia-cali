import { useEffect, useState } from 'react';
import { ClipboardCheck, CircleAlert } from 'lucide-react';
import { changeStatus, fetchNearby, type NearbyReport, type Report } from '../lib/api';
import { REASON_MIN, STATUSES, TRANSITIONS, categoryMeta, statusMeta, type ReportStatus } from '../lib/domain';
import { friendlyError } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { Spinner, StatusBadge } from './ui';

const QUICK_REASONS: Partial<Record<ReportStatus, string[]>> = {
  en_revision: ['Inicio de revisión de ubicación, fotografía y descripción.'],
  validado: ['Ubicación verificada en el mapa y evidencia fotográfica consistente.', 'Descripción completa y coherente con la fotografía.'],
  duplicado: ['Corresponde a la misma afectación de un reporte anterior cercano.'],
  rechazado: ['La ubicación no corresponde a la malla vial pública.', 'La fotografía no muestra una afectación vial identificable.', 'Contenido ajeno al propósito de la plataforma.'],
  cerrado: ['Seguimiento académico finalizado para el periodo de prueba.'],
};

const actionLabel: Record<ReportStatus, string> = {
  recibido: 'Recibido', en_revision: 'Pasar a revisión', validado: 'Validar', duplicado: 'Marcar duplicado',
  rechazado: 'Rechazar', cerrado: 'Cerrar',
};

/** Panel de moderación (RF06): solo visible para revisores; el servidor vuelve a verificar el rol. */
export default function ReviewActions({ report, onChanged }: { report: Report; onChanged: () => void }) {
  const toast = useToast();
  const [target, setTarget] = useState<ReportStatus | null>(null);
  const [reason, setReason] = useState('');
  const [dupOf, setDupOf] = useState<string>('');
  const [nearby, setNearby] = useState<NearbyReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = TRANSITIONS[report.status];

  useEffect(() => {
    if (target === 'duplicado') {
      fetchNearby(report.lat, report.lng, 150, report.id).then((n) => {
        setNearby(n);
        if (n[0]) setDupOf(n[0].id);
      }).catch(() => setNearby([]));
    }
  }, [target, report]);

  const submit = async () => {
    setError(null);
    if (!target) return;
    if (reason.trim().length < REASON_MIN) { setError(`El motivo debe tener al menos ${REASON_MIN} caracteres.`); return; }
    if (target === 'duplicado' && !dupOf) { setError('Seleccione el reporte principal.'); return; }
    setBusy(true);
    try {
      await changeStatus(report.id, target, reason, target === 'duplicado' ? dupOf : null);
      toast(`Estado actualizado: ${statusMeta(target).label}`);
      setTarget(null); setReason(''); setDupOf('');
      onChanged();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card-pad actions-box stack" aria-labelledby="mod-title">
      <div className="card-title"><ClipboardCheck size={20} color="var(--navy)" /><h2 id="mod-title" style={{ fontSize: '1.15rem' }}>Moderación</h2></div>
      <p className="small muted" style={{ margin: 0 }}>Estado actual: <StatusBadge status={report.status} />. Acciones permitidas según la matriz de transiciones:</p>
      <div className="row">
        {options.map((s) => (
          <button key={s} className={`btn btn-sm ${target === s ? 'btn-navy' : ''} ${s === 'rechazado' && target !== s ? 'btn-danger' : ''}`}
            aria-pressed={target === s} onClick={() => { setTarget(s); setReason(''); setError(null); }}>
            {actionLabel[s]}
          </button>
        ))}
      </div>
      {target && (
        <div className="stack" style={{ gap: 10 }}>
          <p className="small" style={{ margin: 0 }}>
            <b>{statusMeta(report.status).label} → {statusMeta(target).label}.</b> {STATUSES.find((s) => s.code === target)?.description}
          </p>
          {target === 'duplicado' && (
            <div className="field">
              <label className="label" htmlFor="dup">Reporte principal (a menos de 150 m)</label>
              {nearby.length ? (
                <select id="dup" className="select input" value={dupOf} onChange={(e) => setDupOf(e.target.value)}>
                  {nearby.map((n) => (
                    <option key={n.id} value={n.id}>{n.code} · {categoryMeta(n.category_code).name} · {Math.round(n.distance_m)} m · {statusMeta(n.status).label}</option>
                  ))}
                </select>
              ) : <p className="small muted" style={{ margin: 0 }}>No hay reportes cercanos para vincular.</p>}
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor="reason">Motivo (queda en la bitácora)</label>
            <div className="chips">
              {(QUICK_REASONS[target] ?? []).map((q) => (
                <button key={q} type="button" className="chip" onClick={() => setReason(q)} style={{ textAlign: 'left' }}>{q}</button>
              ))}
            </div>
            <textarea id="reason" className="textarea" style={{ minHeight: 80 }} value={reason} maxLength={500}
              onChange={(e) => setReason(e.target.value)} placeholder="Explique la decisión de forma breve y verificable." />
          </div>
          {error && <p className="error-text" role="alert"><CircleAlert size={16} />{error}</p>}
          <div className="row">
            <button className="btn" onClick={() => setTarget(null)} disabled={busy}>Cancelar</button>
            <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? <Spinner label="Guardando" /> : 'Confirmar cambio'}</button>
          </div>
        </div>
      )}
    </section>
  );
}
