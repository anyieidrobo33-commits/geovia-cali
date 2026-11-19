import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && anonKey && url.startsWith('https://'));

export const supabase: SupabaseClient = createClient(
  url ?? 'https://no-configurado.supabase.co',
  anonKey ?? 'no-configurado',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'geovia-auth' },
  },
);

export const PHOTO_BUCKET = 'evidencias';

/** Convierte errores de Supabase/PostgreSQL en mensajes comprensibles (RNF03). */
export function friendlyError(err: unknown): string {
  const e = err as { message?: string; code?: string; status?: number } | null;
  const msg = e?.message ?? String(err ?? 'Error desconocido');
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg))
    return 'No hay conexión con el servidor. Revise su internet e intente de nuevo.';
  if (/Anonymous sign-ins are disabled/i.test(msg))
    return 'El registro sin cuenta está deshabilitado en el servidor. Cree una cuenta o pida al administrador activar "Anonymous sign-ins" en Supabase.';
  if (/Invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(msg)) return 'Debe confirmar su correo antes de ingresar (revise su bandeja de entrada).';
  if (/User already registered/i.test(msg)) return 'Ya existe una cuenta con ese correo. Use "Ingresar".';
  if (/Password should be at least/i.test(msg)) return 'La contraseña debe tener al menos 8 caracteres.';
  if (/rate limit/i.test(msg)) return 'Demasiados intentos seguidos. Espere un momento e intente de nuevo.';
  if (/JWT|token/i.test(msg) && e?.status === 401) return 'Su sesión expiró. Ingrese de nuevo.';
  if (/payload too large|exceeded the maximum allowed size/i.test(msg)) return 'La fotografía supera el tamaño permitido (5 MB).';
  if (/mime type/i.test(msg)) return 'Formato de imagen no admitido.';
  return msg;
}
