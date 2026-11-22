import { useEffect, useState } from 'react';
import { HandHeart } from 'lucide-react';
import { useSupports } from '../hooks/useSupports';
import { useToast } from '../context/ToastContext';
import { friendlyError } from '../lib/supabase';

/** «Yo también lo vi»: respalda un reporte; los más apoyados se priorizan en la revisión. */
export default function SupportButton({ reportId, count, size = 'sm', onChange }: {
  reportId: string; count: number; size?: 'sm' | 'md'; onChange?: (n: number) => void;
}) {
  const { has, toggle } = useSupports();
  const toast = useToast();
  const [n, setN] = useState(count);
  const [busy, setBusy] = useState(false);
  useEffect(() => setN(count), [count]);
  const active = has(reportId);

  const click = async () => {
    setBusy(true);
    try {
      const r = await toggle(reportId);
      setN(r.count);
      onChange?.(r.count);
      toast(r.supported ? 'Gracias: su apoyo ayuda a priorizar este daño' : 'Apoyo retirado');
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className={`btn ${size === 'sm' ? 'btn-sm' : ''} support-btn ${active ? 'is-active' : ''}`}
      onClick={click} disabled={busy} aria-pressed={active}
      title={active ? 'Quitar mi apoyo' : 'Yo también lo vi: apoyar este reporte'}>
      <HandHeart size={size === 'sm' ? 16 : 18} />
      <span>{active ? 'Lo apoyé' : 'Yo también lo vi'}</span>
      <span className="support-count" aria-label={`${n} apoyos`}>{n}</span>
    </button>
  );
}
