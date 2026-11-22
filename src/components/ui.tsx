import { ArrowDownToLine, CircleDot, CircleHelp, Footprints, Grid3x3, Layers, LoaderCircle, Signpost, Zap, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { categoryMeta, conditionMeta, statusMeta } from '../lib/domain';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  hueco: CircleDot,
  grieta: Zap,
  hundimiento: ArrowDownToLine,
  desgaste: Layers,
  alcantarilla: Grid3x3,
  senalizacion: Signpost,
  anden: Footprints,
  otro: CircleHelp,
};

export function CategoryIcon({ code, size = 30 }: { code: string; size?: number }) {
  const meta = categoryMeta(code);
  const Icon = CATEGORY_ICONS[meta.code] ?? CircleHelp;
  return (
    <span className="cat-icon" style={{ background: meta.color, width: size, height: size }} aria-hidden="true">
      <Icon size={Math.round(size * 0.56)} strokeWidth={2.4} />
    </span>
  );
}

export function CategoryLabel({ code }: { code: string }) {
  return (
    <span className="cat-chip">
      <CategoryIcon code={code} size={24} />
      {categoryMeta(code).name}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <span className={`badge tone-${m.tone}`} title={m.description}>
      <span className="dot" aria-hidden="true" />
      {m.label}
    </span>
  );
}

export function DemoBadge() {
  return <span className="badge badge-demo" title="Registro simulado para demostración; no corresponde a un reporte ciudadano real.">Dato de demostración</span>;
}

export function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  return (
    <span role="status" className="row" style={{ gap: 8 }}>
      <LoaderCircle size={size} className="spinner" aria-hidden="true" />
      {label ? <span>{label}</span> : <span className="sr-only">Cargando…</span>}
    </span>
  );
}

export function CenterState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="center-state">
      <div className="big-icon" aria-hidden="true">{icon}</div>
      <h2 style={{ margin: 0 }}>{title}</h2>
      {children}
    </div>
  );
}

export function ConditionBadge({ condition }: { condition: string }) {
  const c = conditionMeta(condition);
  return <span className={`badge tone-${c.tone}`}><span className="dot" aria-hidden="true" />{c.label}</span>;
}
