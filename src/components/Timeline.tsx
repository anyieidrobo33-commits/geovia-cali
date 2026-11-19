import type { HistoryEntry } from '../lib/api';
import { statusMeta } from '../lib/domain';
import { fmtDateTime, ROLE_LABEL } from '../lib/format';
import { StatusBadge } from './ui';

const toneColor: Record<string, string> = {
  info: 'var(--navy-600)', warning: 'var(--amber)', success: 'var(--green)',
  neutral: 'var(--violet)', danger: 'var(--red)', muted: '#6b7a8c',
};

/** Bitácora de estados (RF05 / RF10): fecha, rol responsable y motivo. */
export default function Timeline({ entries }: { entries: HistoryEntry[] }) {
  if (!entries.length) return <p className="muted">Sin movimientos registrados.</p>;
  const ordered = [...entries].reverse();
  return (
    <ol className="timeline" aria-label="Historial de cambios de estado, del más reciente al más antiguo">
      {ordered.map((h, i) => (
        <li key={h.id ?? `${h.created_at}-${i}`}>
          <span className="tl-dot" style={{ background: toneColor[statusMeta(h.to_status).tone] }} aria-hidden="true" />
          <div className="tl-head">
            <StatusBadge status={h.to_status} />
            {h.from_status && <span className="small muted">desde {statusMeta(h.from_status).label}</span>}
          </div>
          <div className="tl-meta">
            {fmtDateTime(h.created_at)} · {h.actor_role ? ROLE_LABEL[h.actor_role] : 'Sistema'}
          </div>
          <p className="tl-reason">{h.reason}</p>
        </li>
      ))}
    </ol>
  );
}
