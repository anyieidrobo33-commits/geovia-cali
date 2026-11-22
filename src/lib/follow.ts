// Seguimiento local de reportes y bandeja de avisos (sin cuenta: se guarda en el dispositivo).
import { conditionMeta, statusMeta } from './domain';
import { fetchFollowStatus, type FollowSnapshot } from './api';

const FOLLOW_KEY = 'geovia-seguidos';
const INBOX_KEY = 'geovia-avisos';
const MAX_INBOX = 40;

export interface Followed { id: string; code: string; snap: Pick<FollowSnapshot, 'status' | 'history_count' | 'updates_count'> | null; }
export interface Aviso { key: string; code: string; text: string; at: string; read: boolean; kind: 'estado' | 'actualizacion'; }

const listeners = new Set<() => void>();
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const emit = () => listeners.forEach((l) => l());

function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? '') as T; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* almacenamiento lleno o bloqueado */ }
}

export const getFollowed = (): Followed[] => read<Followed[]>(FOLLOW_KEY, []);
export const isFollowing = (id: string) => getFollowed().some((f) => f.id === id);
export const getInbox = (): Aviso[] => read<Aviso[]>(INBOX_KEY, []);
export const unreadCount = () => getInbox().filter((a) => !a.read).length;

export function follow(id: string, code: string, snap: Followed['snap'] = null) {
  const list = getFollowed().filter((f) => f.id !== id);
  write(FOLLOW_KEY, [{ id, code, snap }, ...list].slice(0, 50));
  emit();
}
export function unfollow(id: string) {
  write(FOLLOW_KEY, getFollowed().filter((f) => f.id !== id));
  emit();
}
export function markAllRead() {
  write(INBOX_KEY, getInbox().map((a) => ({ ...a, read: true })));
  emit();
}
export function clearInbox() { write(INBOX_KEY, []); emit(); }

/** Compara el estado guardado con el actual y genera avisos (función pura, probada en tests). */
export function diffSnapshot(prev: Followed['snap'], cur: FollowSnapshot): Omit<Aviso, 'read'>[] {
  if (!prev) return [];
  const out: Omit<Aviso, 'read'>[] = [];
  if (cur.status !== prev.status) {
    out.push({ key: `${cur.id}-s-${cur.history_count}`, code: cur.code, kind: 'estado', at: cur.last_change_at,
      text: `${cur.code} pasó a «${statusMeta(cur.status).label}».` });
  }
  if (cur.updates_count > prev.updates_count) {
    const n = cur.updates_count - prev.updates_count;
    const cond = cur.last_update_condition ? ` Última observación: ${conditionMeta(cur.last_update_condition).label}.` : '';
    out.push({ key: `${cur.id}-u-${cur.updates_count}`, code: cur.code, kind: 'actualizacion', at: cur.last_change_at,
      text: `${cur.code}: ${n === 1 ? 'nueva actualización' : `${n} actualizaciones nuevas`} desde el sitio.${cond}` });
  }
  return out;
}

let checking = false;
/** Consulta el servidor, genera avisos nuevos y devuelve cuántos hubo. */
export async function checkFollowed(): Promise<number> {
  if (checking) return 0;
  const list = getFollowed();
  if (!list.length) return 0;
  checking = true;
  try {
    const current = await fetchFollowStatus(list.map((f) => f.id));
    const byId = new Map(current.map((c) => [c.id, c]));
    const inbox = getInbox();
    const known = new Set(inbox.map((a) => a.key));
    const fresh: Aviso[] = [];
    const next = list.map((f) => {
      const cur = byId.get(f.id);
      if (!cur) return f;
      for (const a of diffSnapshot(f.snap, cur)) if (!known.has(a.key)) fresh.push({ ...a, read: false });
      return { ...f, snap: { status: cur.status, history_count: cur.history_count, updates_count: cur.updates_count } };
    });
    write(FOLLOW_KEY, next);
    if (fresh.length) {
      write(INBOX_KEY, [...fresh, ...inbox].slice(0, MAX_INBOX));
      notifySystem(fresh);
    }
    emit();
    return fresh.length;
  } catch {
    return 0;
  } finally {
    checking = false;
  }
}

function notifySystem(items: Aviso[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const body = items.length === 1 ? items[0].text : `${items.length} novedades en los reportes que sigue.`;
  try {
    navigator.serviceWorker?.getRegistration().then((reg) => {
      if (reg) reg.showNotification('GeoVía Cali', { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'geovia-avisos' });
      else new Notification('GeoVía Cali', { body, icon: '/icons/icon-192.png' });
    });
  } catch { /* notificaciones no disponibles */ }
}
