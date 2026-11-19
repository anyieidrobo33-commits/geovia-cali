import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isConfigured } from '../lib/supabase';
import type { UserRole } from '../lib/domain';

interface Profile {
  id: string;
  display_name: string | null;
  role: UserRole;
  is_anonymous: boolean;
}

interface AuthState {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAnonymous: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  ensureSession: () => Promise<User>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) { setProfile(null); return; }
    const { data } = await supabase.from('profiles').select('id, display_name, role, is_anonymous').eq('id', uid).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Se difiere para no bloquear el callback de autenticación
      setTimeout(() => loadProfile(s?.user.id), 0);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  /** Garantiza una sesión: si no existe, crea una sesión anónima (sin datos personales). */
  const ensureSession = useCallback(async (): Promise<User> => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return data.session.user;
    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (error || !anon.user) throw error ?? new Error('No fue posible iniciar la sesión.');
    return anon.user;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(() => {
    const user = session?.user ?? null;
    const isAnonymous = Boolean(user?.is_anonymous);
    const role = profile?.role ?? 'ciudadano';
    return {
      ready, session, user, profile, isAnonymous,
      isStaff: !isAnonymous && (role === 'revisor' || role === 'admin'),
      isAdmin: !isAnonymous && role === 'admin',
      ensureSession,
      refreshProfile: () => loadProfile(user?.id),
      signOut,
    };
  }, [ready, session, profile, ensureSession, loadProfile, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
