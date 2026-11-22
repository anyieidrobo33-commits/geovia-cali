import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CATEGORIES, TRANSITIONS, canTransition, distanceMeters, isInsideCali, normalizeCode, REPORT_CODE_RE,
  validateDraft, validatePhotoFile, checkOnSite, CONDITIONS, type ReportDraft, type ReportStatus,
} from '../src/lib/domain';

const base: ReportDraft = {
  lat: 3.4516, lng: -76.532, accuracy: 8, source: 'gps', address: 'Calle 12', sector: 'San Pedro',
  category: 'hueco', severity: 'alta', description: 'Hueco profundo en el carril derecho.', reference: '',
  photoCount: 1, consent: true,
};

describe('RF09 · Validación de campos obligatorios y coordenadas', () => {
  it('acepta un reporte completo', () => {
    expect(validateDraft(base)).toEqual({});
  });
  it('exige ubicación', () => {
    expect(validateDraft({ ...base, lat: null, lng: null }).location).toMatch(/Marque/);
  });
  it('rechaza coordenadas fuera de Cali (Bogotá)', () => {
    expect(validateDraft({ ...base, lat: 4.711, lng: -74.072 }).location).toMatch(/Santiago de Cali/);
  });
  it('exige categoría', () => {
    expect(validateDraft({ ...base, category: '' }).category).toBeTruthy();
  });
  it('exige descripción mínima de 15 caracteres (sin contar espacios extremos)', () => {
    expect(validateDraft({ ...base, description: '   corto      ' }).description).toMatch(/15/);
    expect(validateDraft({ ...base, description: 'x'.repeat(15) }).description).toBeUndefined();
  });
  it('limita la descripción a 1000 caracteres', () => {
    expect(validateDraft({ ...base, description: 'x'.repeat(1001) }).description).toMatch(/1000/);
  });
  it('exige consentimiento solo en el envío final', () => {
    expect(validateDraft({ ...base, consent: false }).consent).toBeTruthy();
    expect(validateDraft({ ...base, consent: false }, 'details')).toEqual({});
  });
  it('valida por paso sin mezclar errores', () => {
    const e = validateDraft({ ...base, lat: null, category: '' }, 'location');
    expect(Object.keys(e)).toEqual(['location']);
  });
});

describe('RF02 · Fotografías', () => {
  it('exige entre 1 y 3 fotografías', () => {
    expect(validateDraft({ ...base, photoCount: 0 }).photos).toBeTruthy();
    expect(validateDraft({ ...base, photoCount: 4 }).photos).toBeTruthy();
    expect(validateDraft({ ...base, photoCount: 3 }).photos).toBeUndefined();
  });
  it('acepta JPG, PNG, WebP y HEIC', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
      expect(validatePhotoFile({ type, size: 1000 })).toBeNull();
  });
  it('rechaza archivos que no son imagen o están vacíos', () => {
    expect(validatePhotoFile({ type: 'application/pdf', size: 1000 })).toMatch(/no es una imagen/);
    expect(validatePhotoFile({ type: 'image/svg+xml', size: 1000 })).toMatch(/Formato/);
    expect(validatePhotoFile({ type: 'image/jpeg', size: 0 })).toMatch(/vacía/);
  });
  it('rechaza imágenes de más de 15 MB', () => {
    expect(validatePhotoFile({ type: 'image/jpeg', size: 16 * 1024 * 1024 })).toMatch(/15 MB/);
  });
});

describe('RF06 / RF10 · Matriz de transiciones de estado', () => {
  it('permite el flujo normal de moderación', () => {
    expect(canTransition('recibido', 'en_revision')).toBe(true);
    expect(canTransition('en_revision', 'validado')).toBe(true);
    expect(canTransition('validado', 'cerrado')).toBe(true);
  });
  it('impide saltar etapas', () => {
    expect(canTransition('recibido', 'validado')).toBe(false);
    expect(canTransition('recibido', 'cerrado')).toBe(false);
    expect(canTransition('rechazado', 'validado')).toBe(false);
  });
  it('coincide exactamente con la matriz definida en la base de datos', () => {
    const sql = readFileSync('supabase/migrations/001_esquema_geovia.sql', 'utf8');
    const block = sql.slice(sql.indexOf('insert into public.status_transitions'), sql.indexOf('on conflict do nothing'));
    const pairs = [...block.matchAll(/\('(\w+)',\s*'(\w+)'\)/g)].map((m) => `${m[1]}>${m[2]}`).sort();
    const ts = Object.entries(TRANSITIONS).flatMap(([from, tos]) => tos.map((to) => `${from}>${to}`)).sort();
    expect(pairs.length).toBeGreaterThan(0);
    expect(ts).toEqual(pairs);
  });
  it('ningún estado puede transitar a sí mismo', () => {
    for (const [from, tos] of Object.entries(TRANSITIONS)) expect(tos).not.toContain(from as ReportStatus);
  });
});

describe('Catálogo de categorías', () => {
  it('coincide con las categorías creadas en la base de datos', () => {
    const sql = readFileSync('supabase/migrations/001_esquema_geovia.sql', 'utf8');
    const block = sql.slice(sql.indexOf('insert into public.categories'), sql.indexOf('on conflict (code)'));
    const codes = [...block.matchAll(/\('(\w+)',\s*'/g)].map((m) => m[1]).sort();
    expect(CATEGORIES.map((c) => c.code).sort()).toEqual(codes);
  });
  it('cada categoría tiene color con contraste suficiente para texto blanco (≥ 4.5:1)', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const c of CATEGORIES) expect((1.05) / (lum(c.color) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Geografía', () => {
  it('reconoce puntos de Cali y descarta otras ciudades', () => {
    expect(isInsideCali(3.4516, -76.532)).toBe(true);   // Plaza de Caicedo
    expect(isInsideCali(3.3735, -76.5398)).toBe(true);  // Sur de Cali
    expect(isInsideCali(6.2442, -75.5812)).toBe(false); // Medellín
    expect(isInsideCali(Number.NaN, -76.5)).toBe(false);
  });
  it('calcula distancias con precisión de metros (Haversine)', () => {
    const d = distanceMeters([3.4516, -76.532], [3.4519, -76.532]);
    expect(d).toBeGreaterThan(32);
    expect(d).toBeLessThan(35);
  });
});

describe('Código de seguimiento', () => {
  it('valida el formato GVC-AAMM-XXXXX sin caracteres confundibles', () => {
    expect(REPORT_CODE_RE.test('GVC-2611-7K4QM')).toBe(true);
    expect(REPORT_CODE_RE.test('GVC-2611-7K4QO')).toBe(false); // O no se usa
    expect(REPORT_CODE_RE.test('GVC-2611-1K4QM')).toBe(false); // 1 no se usa
  });
  it('normaliza lo que escribe el usuario', () => {
    expect(normalizeCode('gvc 2611 7k4qm')).toBe('GVC-2611-7K4QM');
    expect(normalizeCode('26117K4QM')).toBe('GVC-2611-7K4QM');
    expect(normalizeCode(' GVC-2611-7K4QM ')).toBe('GVC-2611-7K4QM');
  });
});

describe('Actualizaciones ciudadanas · verificación en el sitio', () => {
  const dano: [number, number] = [3.488024, -76.525024];
  it('exige ubicación GPS', () => {
    expect(checkOnSite(dano, null).ok).toBe(false);
  });
  it('acepta estar a menos de 150 m con buena precisión', () => {
    const r = checkOnSite(dano, { lat: 3.4881, lng: -76.5251, accuracy: 12 });
    expect(r.ok).toBe(true);
    expect(r.distance).toBeLessThan(20);
  });
  it('rechaza estar lejos del daño', () => {
    const r = checkOnSite(dano, { lat: 3.4930, lng: -76.5250, accuracy: 10 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/150 m/);
  });
  it('rechaza un GPS impreciso aunque esté cerca', () => {
    const r = checkOnSite(dano, { lat: 3.488024, lng: -76.525024, accuracy: 180 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/precisión/);
  });
  it('los estados observados coinciden con el tipo update_condition de la base de datos', () => {
    const sql = readFileSync('supabase/migrations/003_actualizaciones_ciudadanas.sql', 'utf8');
    const m = sql.match(/create type public\.update_condition as enum \(([^)]*)\)/);
    const codes = [...(m?.[1] ?? '').matchAll(/'(\w+)'/g)].map((x) => x[1]).sort();
    expect(CONDITIONS.map((c) => c.code).sort()).toEqual(codes);
  });
});
