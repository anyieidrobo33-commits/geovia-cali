import { useCallback, useEffect, useState } from 'react';
import { fetchMySupports, toggleSupport } from '../lib/api';
import { useAuth } from '../context/AuthContext';

// Caché compartida entre componentes durante la sesión
let mine: Set<string> | null = null;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Apoyos «Yo también lo vi» de la sesión actual. */
export function useSupports() {
  const { user, ensureSession } = useAuth();
  const [, force] = useState(0);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  useEffect(() => {
    if (!user) { mine = new Set(); loadedFor = null; notify(); return; }
    if (loadedFor === user.id) return;
    loadedFor = user.id;
    fetchMySupports().then((ids) => { mine = new Set(ids); notify(); }).catch(() => { mine = new Set(); });
  }, [user]);

  const toggle = useCallback(async (reportId: string) => {
    await ensureSession();
    const res = await toggleSupport(reportId);
    mine = new Set(mine ?? []);
    if (res.supported) mine.add(reportId); else mine.delete(reportId);
    notify();
    return res;
  }, [ensureSession]);

  return { has: (id: string) => Boolean(mine?.has(id)), toggle };
}
