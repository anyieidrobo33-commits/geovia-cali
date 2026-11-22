// Capa de servicios: todas las operaciones con la base de datos pasan por aquí.
import { supabase, PHOTO_BUCKET } from './supabase';
import type { CategoryCode, ReportStatus, Severity, UpdateCondition, UserRole } from './domain';

export interface Report {
  id: string;
  code: string;
  created_by: string | null;
  category_code: CategoryCode;
  severity: Severity;
  description: string;
  reference: string | null;
  lat: number;
  lng: number;
  location_accuracy_m: number | null;
  location_source: 'gps' | 'mapa';
  address: string | null;
  sector: string | null;
  status: ReportStatus;
  duplicate_of: string | null;
  is_demo: boolean;
  supports_count: number;
  created_at: string;
  updated_at: string;
  report_photos?: { id: string; storage_path: string }[];
}

export interface HistoryEntry {
  id?: number;
  from_status: ReportStatus | null;
  to_status: ReportStatus;
  actor_role: UserRole | null;
  reason: string;
  created_at: string;
}

export interface PublicTracking {
  id: string;
  code: string;
  category_code: CategoryCode;
  severity: Severity;
  status: ReportStatus;
  sector: string | null;
  created_at: string;
  updated_at: string;
  is_demo: boolean;
  full_access: boolean;
  history: HistoryEntry[];
}

export interface NearbyReport {
  id: string;
  code: string;
  category_code: CategoryCode;
  status: ReportStatus;
  distance_m: number;
  created_at: string;
}

export interface Stats {
  total: number;
  actualizaciones?: number;
  publicos: number;
  ultimos_7d: number;
  por_estado: Partial<Record<ReportStatus, number>>;
  por_categoria: Partial<Record<CategoryCode, number>>;
}

const REPORT_COLUMNS =
  'id, code, created_by, category_code, severity, description, reference, lat, lng, location_accuracy_m, location_source, address, sector, status, duplicate_of, is_demo, supports_count, created_at, updated_at';

export interface ReportFilters {
  statuses?: ReportStatus[];
  categories?: CategoryCode[];
  sinceDays?: number | null;
  onlyMine?: string | null;
  limit?: number;
}

export async function fetchReports(f: ReportFilters = {}): Promise<Report[]> {
  let q = supabase.from('reports').select(`${REPORT_COLUMNS}, report_photos(id, storage_path)`)
    .order('created_at', { ascending: false })
    .limit(f.limit ?? 1000);
  if (f.statuses?.length) q = q.in('status', f.statuses);
  if (f.categories?.length) q = q.in('category_code', f.categories);
  if (f.sinceDays) q = q.gte('created_at', new Date(Date.now() - f.sinceDays * 86400000).toISOString());
  if (f.onlyMine) q = q.eq('created_by', f.onlyMine);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Report[];
}

export async function fetchReportByCode(code: string): Promise<Report | null> {
  const { data, error } = await supabase.from('reports')
    .select(`${REPORT_COLUMNS}, report_photos(id, storage_path)`)
    .eq('code', code).maybeSingle();
  if (error) throw error;
  return data as Report | null;
}

export async function fetchReportCodeById(id: string): Promise<string | null> {
  const { data } = await supabase.from('reports').select('code').eq('id', id).maybeSingle();
  return (data?.code as string) ?? null;
}

export async function trackByCode(code: string): Promise<PublicTracking | null> {
  const { data, error } = await supabase.rpc('get_report_by_code', { p_code: code });
  if (error) throw error;
  return (data as PublicTracking) ?? null;
}

export async function fetchHistory(reportId: string): Promise<HistoryEntry[]> {
  const { data, error } = await supabase.from('status_history')
    .select('id, from_status, to_status, actor_role, reason, created_at')
    .eq('report_id', reportId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HistoryEntry[];
}

export async function fetchNearby(lat: number, lng: number, radius = 30, exclude?: string): Promise<NearbyReport[]> {
  const { data, error } = await supabase.rpc('nearby_reports', {
    p_lat: lat, p_lng: lng, p_radius_m: radius, p_days: 120, p_exclude: exclude ?? null,
  });
  if (error) throw error;
  return (data ?? []) as NearbyReport[];
}

export async function fetchStats(): Promise<Stats> {
  const { data, error } = await supabase.rpc('report_stats');
  if (error) throw error;
  return data as Stats;
}

export async function signedPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const item of data ?? []) if (item.signedUrl && item.path) out[item.path] = item.signedUrl;
  return out;
}

export async function uploadPhoto(userId: string, folder: string, blob: Blob): Promise<string> {
  const path = `${userId}/${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg', cacheControl: '3600', upsert: false,
  });
  if (error) throw error;
  return path;
}

export interface SubmitPayload {
  category: CategoryCode;
  severity: Severity;
  description: string;
  reference: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  source: 'gps' | 'mapa';
  address: string;
  sector: string;
  photoPaths: string[];
  consent: boolean;
}

export async function submitReport(p: SubmitPayload): Promise<{ id: string; code: string }> {
  const { data, error } = await supabase.rpc('submit_report', {
    p_category: p.category,
    p_severity: p.severity,
    p_description: p.description.trim(),
    p_reference: p.reference.trim() || null,
    p_lat: p.lat,
    p_lng: p.lng,
    p_accuracy: p.accuracy,
    p_source: p.source,
    p_address: p.address || null,
    p_sector: p.sector || null,
    p_photo_paths: p.photoPaths,
    p_consent: p.consent,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { id: string; code: string };
}

export async function changeStatus(reportId: string, status: ReportStatus, reason: string, duplicateOf?: string | null) {
  const { data, error } = await supabase.rpc('change_report_status', {
    p_report_id: reportId, p_new_status: status, p_reason: reason.trim(), p_duplicate_of: duplicateOf ?? null,
  });
  if (error) throw error;
  return data as HistoryEntry;
}

export interface AppUser {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  is_anonymous: boolean;
  created_at: string;
  reports_count: number;
}

export async function listUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase.rpc('list_users');
  if (error) throw error;
  return (data ?? []) as AppUser[];
}

export async function setUserRole(userId: string, role: UserRole) {
  const { error } = await supabase.rpc('set_user_role', { p_user: userId, p_role: role });
  if (error) throw error;
}

// Códigos enviados desde este dispositivo (para "Mis reportes" aun sin cuenta)
const LOCAL_CODES_KEY = 'geovia-mis-codigos';
export function rememberCode(code: string) {
  try {
    const list = getRememberedCodes().filter((c) => c !== code);
    localStorage.setItem(LOCAL_CODES_KEY, JSON.stringify([code, ...list].slice(0, 50)));
  } catch { /* almacenamiento no disponible */ }
}
export function getRememberedCodes(): string[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_CODES_KEY) ?? '[]'); } catch { return []; }
}

// ---------------------------------------------------------------------
// Actualizaciones ciudadanas y feed comunitario
// ---------------------------------------------------------------------
export interface ReportUpdate {
  id: string;
  report_id: string;
  condition: UpdateCondition;
  comment: string | null;
  distance_m: number;
  photo_path: string;
  created_at: string;
}

export async function fetchUpdates(reportId: string): Promise<ReportUpdate[]> {
  const { data, error } = await supabase.from('report_updates')
    .select('id, report_id, condition, comment, distance_m, photo_path, created_at')
    .eq('report_id', reportId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReportUpdate[];
}

export async function submitUpdate(p: {
  reportId: string; condition: UpdateCondition; comment: string;
  lat: number; lng: number; accuracy: number; photoPath: string; consent: boolean;
}): Promise<{ id: string; distance_m: number }> {
  const { data, error } = await supabase.rpc('submit_report_update', {
    p_report_id: p.reportId, p_condition: p.condition, p_comment: p.comment.trim() || null,
    p_lat: p.lat, p_lng: p.lng, p_accuracy: p.accuracy, p_photo_path: p.photoPath, p_consent: p.consent,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as { id: string; distance_m: number };
}

export interface FeedItem {
  tipo: 'reporte' | 'validacion' | 'actualizacion';
  fecha: string;
  report_id: string;
  code: string;
  category_code: CategoryCode;
  sector: string | null;
  address: string | null;
  texto: string | null;
  estado: ReportStatus;
  condicion: UpdateCondition | null;
  foto: string | null;
  n_updates: number;
  ultima_condicion: UpdateCondition | null;
  is_demo: boolean;
  apoyos: number;
}

export async function fetchFeed(limit = 40): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc('community_feed', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as FeedItem[];
}

// ---------------------------------------------------------------------
// Apoyos «Yo también lo vi» y estadísticas públicas
// ---------------------------------------------------------------------
export async function toggleSupport(reportId: string): Promise<{ supported: boolean; count: number }> {
  const { data, error } = await supabase.rpc('toggle_support', { p_report_id: reportId });
  if (error) throw error;
  return data as { supported: boolean; count: number };
}

export async function fetchMySupports(): Promise<string[]> {
  const { data, error } = await supabase.rpc('my_supported_reports');
  if (error) throw error;
  return ((data ?? []) as (string | { my_supported_reports: string })[]).map((x) => (typeof x === 'string' ? x : x.my_supported_reports));
}

export interface PublicStats {
  total: number;
  verificados: number;
  sin_verificar: number;
  actualizaciones: number;
  apoyos: number;
  reparados_segun_ciudadanos: number;
  horas_validacion_mediana: number | null;
  por_semana: { semana: string; n: number }[];
  por_categoria: Partial<Record<CategoryCode, number>>;
  por_estado: Partial<Record<ReportStatus, number>>;
  por_severidad: Partial<Record<Severity, number>>;
  top_sectores: { sector: string; n: number }[];
  mas_apoyados: { code: string; category_code: CategoryCode; sector: string | null; apoyos: number; status: ReportStatus }[];
  condiciones: Partial<Record<UpdateCondition, number>>;
}

export async function fetchPublicStats(): Promise<PublicStats> {
  const { data, error } = await supabase.rpc('public_stats');
  if (error) throw error;
  return data as PublicStats;
}

// ---------------------------------------------------------------------
// Seguimiento de reportes (notificaciones)
// ---------------------------------------------------------------------
export interface FollowSnapshot {
  id: string;
  code: string;
  category_code: CategoryCode;
  sector: string | null;
  status: ReportStatus;
  history_count: number;
  updates_count: number;
  last_update_condition: UpdateCondition | null;
  last_change_at: string;
}

export async function fetchFollowStatus(ids: string[]): Promise<FollowSnapshot[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.rpc('follow_status', { p_ids: ids });
  if (error) throw error;
  return (data ?? []) as FollowSnapshot[];
}
