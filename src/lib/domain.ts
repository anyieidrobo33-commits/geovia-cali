// Reglas de dominio compartidas por la interfaz y espejo de las reglas del servidor.
// Las reglas definitivas se aplican en PostgreSQL (migración 001); aquí se replican
// para dar retroalimentación inmediata al usuario. Las pruebas en tests/ verifican
// que ambas versiones coincidan.

export type ReportStatus = 'recibido' | 'en_revision' | 'validado' | 'duplicado' | 'rechazado' | 'cerrado';
export type UserRole = 'ciudadano' | 'revisor' | 'admin';
export type Severity = 'baja' | 'media' | 'alta';
export type CategoryCode =
  | 'hueco' | 'grieta' | 'hundimiento' | 'desgaste'
  | 'alcantarilla' | 'senalizacion' | 'anden' | 'otro';

export interface CategoryMeta {
  code: CategoryCode;
  name: string;
  hint: string;
  color: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { code: 'hueco',        name: 'Hueco o bache',             hint: 'Cavidad en la vía',             color: '#C4410C' },
  { code: 'grieta',       name: 'Grietas o fisuras',         hint: 'Fisuras en el pavimento',       color: '#6741D9' },
  { code: 'hundimiento',  name: 'Hundimiento',               hint: 'Calzada asentada',              color: '#A61E4D' },
  { code: 'desgaste',     name: 'Desgaste de la capa',       hint: 'Material suelto o descascarado', color: '#8C6418' },
  { code: 'alcantarilla', name: 'Tapa o sumidero dañado',    hint: 'Tapa rota, hundida o ausente',  color: '#1864AB' },
  { code: 'senalizacion', name: 'Señalización vial borrada', hint: 'Demarcación deteriorada',       color: '#9A6700' },
  { code: 'anden',        name: 'Andén o bordillo dañado',   hint: 'Borde contiguo a la vía',       color: '#237A35' },
  { code: 'otro',         name: 'Otra afectación',           hint: 'No está en la lista',           color: '#495057' },
];

export const categoryMeta = (code: string): CategoryMeta =>
  CATEGORIES.find((c) => c.code === code) ?? CATEGORIES[CATEGORIES.length - 1];

export interface StatusMeta {
  code: ReportStatus;
  label: string;
  description: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted';
}

export const STATUSES: StatusMeta[] = [
  { code: 'recibido',    label: 'Recibido',               tone: 'info',    description: 'Los datos obligatorios fueron aceptados. El reporte espera revisión.' },
  { code: 'en_revision', label: 'En revisión',            tone: 'warning', description: 'Un revisor verifica la ubicación, la fotografía y la consistencia del reporte.' },
  { code: 'validado',    label: 'Validado en el sistema', tone: 'success', description: 'El registro es consistente y aparece en el mapa público. No equivale a una inspección oficial.' },
  { code: 'duplicado',   label: 'Duplicado',              tone: 'neutral', description: 'Coincide con otro reporte de la misma afectación; se conserva vinculado.' },
  { code: 'rechazado',   label: 'Rechazado',              tone: 'danger',  description: 'No cumple los criterios: ubicación fuera de la vía, contenido ajeno o ilegible.' },
  { code: 'cerrado',     label: 'Cerrado',                tone: 'muted',   description: 'Finalizó el seguimiento académico de este reporte.' },
];

export const statusMeta = (code: string): StatusMeta =>
  STATUSES.find((s) => s.code === code) ?? STATUSES[0];

export const PUBLIC_STATUSES: ReportStatus[] = ['validado', 'cerrado'];

/** Tabla 7.2 de la especificación: transiciones autorizadas (espejo de status_transitions). */
export const TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  recibido:    ['en_revision', 'rechazado'],
  en_revision: ['validado', 'duplicado', 'rechazado'],
  validado:    ['cerrado', 'en_revision'],
  duplicado:   ['cerrado', 'en_revision'],
  rechazado:   ['en_revision'],
  cerrado:     ['en_revision'],
};

export const canTransition = (from: ReportStatus, to: ReportStatus): boolean =>
  TRANSITIONS[from]?.includes(to) ?? false;

export const SEVERITIES: { code: Severity; label: string; hint: string }[] = [
  { code: 'baja',  label: 'Baja',  hint: 'Molesta, pero se puede transitar con normalidad.' },
  { code: 'media', label: 'Media', hint: 'Obliga a reducir la velocidad o desviarse.' },
  { code: 'alta',  label: 'Alta',  hint: 'Representa un riesgo evidente para vehículos o peatones.' },
];

/** Límite geográfico aceptado (Distrito de Santiago de Cali, zona urbana y rural cercana). */
export const CALI_BOUNDS = { minLat: 3.25, maxLat: 3.58, minLng: -76.72, maxLng: -76.42 } as const;
export const CALI_CENTER: [number, number] = [3.4372, -76.5225];

export const isInsideCali = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= CALI_BOUNDS.minLat && lat <= CALI_BOUNDS.maxLat &&
  lng >= CALI_BOUNDS.minLng && lng <= CALI_BOUNDS.maxLng;

export const DESCRIPTION_MIN = 15;
export const DESCRIPTION_MAX = 1000;
export const REFERENCE_MAX = 200;
export const REASON_MIN = 10;
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_INPUT_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const DUPLICATE_RADIUS_M = 30;

export const REPORT_CODE_RE = /^GVC-\d{4}-[2-9A-HJ-NP-Z]{5}$/;

/** Normaliza lo que la persona escribe al consultar un código. */
export function normalizeCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const body = raw.startsWith('GVC') ? raw.slice(3) : raw;
  if (body.length < 9) return input.trim().toUpperCase();
  return `GVC-${body.slice(0, 4)}-${body.slice(4, 9)}`;
}

export interface ReportDraft {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  source: 'gps' | 'mapa';
  address: string;
  sector: string;
  category: CategoryCode | '';
  severity: Severity;
  description: string;
  reference: string;
  photoCount: number;
  consent: boolean;
}

export type DraftErrors = Partial<Record<'location' | 'category' | 'description' | 'reference' | 'photos' | 'consent', string>>;

/** RF09: validación de campos obligatorios y coordenadas. */
export function validateDraft(d: ReportDraft, step: 'location' | 'details' | 'photos' | 'all' = 'all'): DraftErrors {
  const e: DraftErrors = {};
  const check = (s: typeof step) => step === 'all' || step === s;

  if (check('location')) {
    if (d.lat == null || d.lng == null) e.location = 'Marque en el mapa el lugar exacto de la afectación.';
    else if (!isInsideCali(d.lat, d.lng)) e.location = 'La ubicación debe estar dentro de Santiago de Cali.';
  }
  if (check('details')) {
    if (!d.category) e.category = 'Seleccione el tipo de afectación.';
    const len = d.description.trim().length;
    if (len < DESCRIPTION_MIN) e.description = `Describa el daño con al menos ${DESCRIPTION_MIN} caracteres (lleva ${len}).`;
    else if (len > DESCRIPTION_MAX) e.description = `La descripción no puede superar ${DESCRIPTION_MAX} caracteres.`;
    if (d.reference.length > REFERENCE_MAX) e.reference = `El punto de referencia admite hasta ${REFERENCE_MAX} caracteres.`;
  }
  if (check('photos')) {
    if (d.photoCount < 1) e.photos = 'Adjunte al menos una fotografía del daño.';
    else if (d.photoCount > MAX_PHOTOS) e.photos = `Puede adjuntar máximo ${MAX_PHOTOS} fotografías.`;
  }
  if (step === 'all' && !d.consent) e.consent = 'Debe aceptar el tratamiento de datos para enviar.';
  return e;
}

/** Valida un archivo de imagen antes de comprimirlo (RF02). */
export function validatePhotoFile(file: { type: string; size: number }): string | null {
  const type = file.type.toLowerCase();
  if (!type.startsWith('image/')) return 'El archivo no es una imagen.';
  if (!ACCEPTED_PHOTO_TYPES.includes(type) && type !== 'image/heic' && type !== 'image/heif')
    return 'Formato no admitido. Use JPG, PNG o WebP.';
  if (file.size > MAX_PHOTO_INPUT_BYTES) return 'La imagen supera 15 MB.';
  if (file.size === 0) return 'La imagen está vacía.';
  return null;
}

/** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
export function distanceMeters(a: [number, number], b: [number, number]): number {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
