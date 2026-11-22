import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing, CheckCheck, CircleDot, Camera } from 'lucide-react';
import { checkFollowed, getFollowed, markAllRead } from '../lib/follow';
import { useFollowStore } from '../hooks/useFollow';
import { fmtRelative } from '../lib/format';

const POLL_MS = 90_000;

/** Campanita: revisa periódicamente los reportes seguidos y muestra la bandeja de avisos. */
export default function NotificationBell() {
  const { inbox, unread } = useFollowStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  const [, force] = useState(0);

  useEffect(() => {
    checkFollowed();
    const t = setInterval(() => { if (!document.hidden) checkFollowed(); }, POLL_MS);
    const onVis = () => { if (!document.hidden) checkFollowed(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const nFollowed = getFollowed().length;

  return (
    <div className="bell" ref={ref}>
      <button className="btn btn-sm btn-ghost icon-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        aria-label={unread ? `Avisos: ${unread} sin leer` : 'Avisos'}>
        {unread ? <BellRing size={20} /> : <Bell size={20} />}
        {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Avisos de reportes seguidos">
          <div className="bell-head">
            <b>Avisos</b>
            <span className="small muted">{nFollowed} reporte{nFollowed === 1 ? '' : 's'} seguido{nFollowed === 1 ? '' : 's'}</span>
            <span className="spacer" />
            {unread > 0 && <button className="btn btn-sm btn-ghost" onClick={markAllRead}><CheckCheck size={16} />Leídos</button>}
          </div>
          {inbox.length === 0 ? (
            <p className="small muted" style={{ padding: '12px 14px', margin: 0 }}>
              {nFollowed ? 'Sin novedades por ahora. Le avisaremos cuando cambie un reporte que sigue.' : 'Toque «Seguir» en un reporte para recibir avisos cuando cambie. Sus propios reportes se siguen automáticamente.'}
            </p>
          ) : (
            <ul className="bell-list">
              {inbox.map((a) => (
                <li key={a.key} className={a.read ? '' : 'unread'}>
                  <Link to={`/r/${a.code}`} onClick={() => { setOpen(false); markAllRead(); }}>
                    {a.kind === 'estado' ? <CircleDot size={16} /> : <Camera size={16} />}
                    <span><span className="small">{a.text}</span><br /><span className="muted" style={{ fontSize: '0.75rem' }}>{fmtRelative(a.at)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {perm === 'default' && (
            <button className="btn btn-sm btn-navy" style={{ margin: 10 }} onClick={async () => { await Notification.requestPermission(); force((n) => n + 1); }}>
              Activar avisos en este dispositivo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
