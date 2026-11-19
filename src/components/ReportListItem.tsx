import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Report } from '../lib/api';
import { categoryMeta } from '../lib/domain';
import { fmtDate } from '../lib/format';
import { CategoryIcon, DemoBadge, StatusBadge } from './ui';

export function ReportListItem({ report: r, thumbUrl }: { report: Pick<Report, 'code' | 'category_code' | 'status' | 'sector' | 'address' | 'created_at' | 'is_demo'>; thumbUrl?: string }) {
  return (
    <Link to={`/r/${r.code}`} className="report-item">
      {thumbUrl ? <img className="thumb" src={thumbUrl} alt="" loading="lazy" /> : <CategoryIcon code={r.category_code} size={44} />}
      <div className="ri-main">
        <div className="ri-title">{categoryMeta(r.category_code).name} <StatusBadge status={r.status} />{r.is_demo && <DemoBadge />}</div>
        <div className="ri-sub">
          <span className="code-display">{r.code}</span> · {r.sector || r.address || 'Sin barrio'} · {fmtDate(r.created_at)}
        </div>
      </div>
      <ChevronRight size={20} color="var(--ink-3)" aria-hidden="true" />
    </Link>
  );
}
