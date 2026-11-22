#!/usr/bin/env node
// =====================================================================
// GeoVía Cali · Carga de los reportes de campo (registro fotográfico real)
//
// Cada reporte se envía exactamente como lo haría un ciudadano SIN cuenta:
//   1. abre una sesión anónima nueva (un "usuario sin cuenta" por reporte),
//   2. sube la fotografía a su carpeta privada del bucket "evidencias",
//   3. registra el reporte con la función submit_report (mismas validaciones
//      que la app: ubicación en Cali, descripción, foto, consentimiento).
// Los reportes quedan en estado "Recibido", listos para la moderación.
//
// Uso:
//   npm run cargar:reportes              → carga los 9 reportes
//   npm run cargar:reportes -- --prueba  → solo valida archivos y datos, no envía nada
//
// Requiere VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local (o en el entorno)
// y "Allow anonymous sign-ins" activado en Supabase.
// Es idempotente: si ya existe un reporte de la misma categoría a menos de 5 m, lo omite.
// =====================================================================
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seedDir = join(root, 'supabase', 'seed', 'reportes_campo');
const dryRun = process.argv.includes('--prueba') || process.argv.includes('--dry-run');

// --- Variables de entorno (.env.local → .env → entorno) ----------------
for (const file of ['.env.local', '.env']) {
  const p = join(root, file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

// --- Validación local (espejo de las reglas del servidor) ---------------
const CATEGORIAS = ['hueco', 'grieta', 'hundimiento', 'desgaste', 'alcantarilla', 'senalizacion', 'anden', 'otro'];
const dentroDeCali = (lat, lng) => lat >= 3.25 && lat <= 3.58 && lng >= -76.72 && lng <= -76.42;

const reportes = JSON.parse(readFileSync(join(seedDir, 'reportes.json'), 'utf8'));
let errores = 0;
for (const [i, r] of reportes.entries()) {
  const problemas = [];
  if (!CATEGORIAS.includes(r.categoria)) problemas.push(`categoría "${r.categoria}" no válida`);
  if (!dentroDeCali(r.lat, r.lng)) problemas.push('coordenadas fuera de Cali');
  if (r.descripcion.trim().length < 15) problemas.push('descripción menor a 15 caracteres');
  if (!existsSync(join(seedDir, r.foto))) problemas.push(`no existe la foto ${r.foto}`);
  if (problemas.length) { errores++; console.error(`✗ Reporte ${i + 1}: ${problemas.join('; ')}`); }
}
if (errores) process.exit(1);
console.log(`✓ ${reportes.length} reportes válidos (categoría, ubicación, descripción y fotografía).`);

if (dryRun) {
  console.log('Modo prueba: no se envió nada.');
  process.exit(0);
}
if (!url || !anonKey) {
  console.error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (archivo .env.local).');
  process.exit(1);
}

// --- Envío -------------------------------------------------------------
const nuevoCliente = () =>
  createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

const publico = nuevoCliente();
const resumen = [];

for (const [i, r] of reportes.entries()) {
  const etiqueta = `${String(i + 1).padStart(2, '0')} · ${r.categoria} · ${r.sector}`;
  try {
    const { data: cercanos, error: eCerca } = await publico.rpc('nearby_reports', {
      p_lat: r.lat, p_lng: r.lng, p_radius_m: 5, p_days: 730, p_exclude: null,
    });
    if (eCerca) throw eCerca;
    const previo = (cercanos ?? []).find((n) => n.category_code === r.categoria);
    if (previo) {
      console.log(`↷ ${etiqueta}: ya existe (${previo.code}), se omite.`);
      resumen.push({ ...r, codigo: previo.code, estado: 'omitido' });
      continue;
    }

    // 1. Ciudadano sin cuenta: sesión anónima propia
    const ciudadano = nuevoCliente();
    const { data: sesion, error: eAuth } = await ciudadano.auth.signInAnonymously();
    if (eAuth) throw eAuth;
    const uid = sesion.user.id;

    // 2. Fotografía en su carpeta privada
    const ruta = `${uid}/${randomUUID()}/${randomUUID()}.jpg`;
    const { error: eFoto } = await ciudadano.storage.from('evidencias')
      .upload(ruta, readFileSync(join(seedDir, r.foto)), { contentType: 'image/jpeg', upsert: false });
    if (eFoto) throw eFoto;

    // 3. Registro con las mismas validaciones de la app
    const { data, error: eRep } = await ciudadano.rpc('submit_report', {
      p_category: r.categoria,
      p_severity: r.severidad,
      p_description: r.descripcion,
      p_reference: r.referencia,
      p_lat: r.lat,
      p_lng: r.lng,
      p_accuracy: null,
      p_source: 'mapa',
      p_address: r.direccion,
      p_sector: r.sector,
      p_photo_paths: [ruta],
      p_consent: true,
    });
    if (eRep) throw eRep;
    const codigo = (Array.isArray(data) ? data[0] : data).code;
    console.log(`✓ ${etiqueta}: ${codigo}`);
    resumen.push({ ...r, codigo, estado: 'creado' });
    await ciudadano.auth.signOut();
  } catch (e) {
    console.error(`✗ ${etiqueta}: ${e.message ?? e}`);
    resumen.push({ ...r, codigo: null, estado: 'error' });
  }
}

const creados = resumen.filter((x) => x.estado === 'creado').length;
const omitidos = resumen.filter((x) => x.estado === 'omitido').length;
const fallidos = resumen.filter((x) => x.estado === 'error').length;
console.log(`\nResultado: ${creados} creados · ${omitidos} omitidos (ya existían) · ${fallidos} con error.`);
console.log('Los reportes nuevos están en estado "Recibido": un revisor los valida desde Panel → Pendientes.');
process.exit(fallidos ? 1 : 0);
