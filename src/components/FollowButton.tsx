import { Bell, BellRing } from 'lucide-react';
import { follow, unfollow } from '../lib/follow';
import { useFollowStore } from '../hooks/useFollow';
import { useToast } from '../context/ToastContext';
import type { ReportStatus } from '../lib/domain';

/** Seguir un reporte: la campanita avisará cuando cambie su estado o lo actualicen. */
export default function FollowButton({ id, code, status, historyCount = 0, updatesCount = 0, size = 'sm' }: {
  id: string; code: string; status: ReportStatus; historyCount?: number; updatesCount?: number; size?: 'sm' | 'md';
}) {
  const { isFollowing } = useFollowStore();
  const toast = useToast();
  const on = isFollowing(id);
  const click = async () => {
    if (on) { unfollow(id); toast('Dejó de seguir este reporte'); return; }
    follow(id, code, { status, history_count: historyCount, updates_count: updatesCount });
    toast('Le avisaremos cuando este reporte cambie');
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch { /* el usuario puede activarlo después */ }
    }
  };
  return (
    <button type="button" className={`btn ${size === 'sm' ? 'btn-sm' : ''} ${on ? 'follow-on' : ''}`} onClick={click} aria-pressed={on}
      title={on ? 'Dejar de seguir' : 'Recibir avisos de este reporte'}>
      {on ? <BellRing size={size === 'sm' ? 16 : 18} /> : <Bell size={size === 'sm' ? 16 : 18} />}
      {on ? 'Siguiendo' : 'Seguir'}
    </button>
  );
}
