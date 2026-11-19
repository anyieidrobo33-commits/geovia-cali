// RF08: exportación de resumen SIN datos personales (no incluye autor ni identificadores de usuario).
import { categoryMeta, statusMeta } from './domain';

export interface ExportableReport {
  code: string;
  category_code: string;
  severity: string;
  status: string;
  sector: string | null;
  address: string | null;
  lat: number;
  lng: number;
  description: string;
  created_at: string;
  updated_at: string;
  is_demo: boolean;
}

export const CSV_COLUMNS = [
  'codigo', 'categoria', 'severidad', 'estado', 'sector', 'direccion_aproximada',
  'latitud', 'longitud', 'descripcion', 'fecha_registro', 'ultima_actualizacion', 'dato_demostracion',
] as const;

export function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Neutraliza fórmulas al abrir el archivo en hojas de cálculo (inyección CSV)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",;\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function reportsToCsv(rows: ExportableReport[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) {
    lines.push([
      r.code,
      categoryMeta(r.category_code).name,
      r.severity,
      statusMeta(r.status).label,
      r.sector,
      r.address,
      r.lat.toFixed(6),
      r.lng.toFixed(6),
      r.description,
      r.created_at,
      r.updated_at,
      r.is_demo ? 'sí' : 'no',
    ].map(escapeCsv).join(','));
  }
  // BOM para que Excel reconozca UTF-8 (tildes y eñes)
  return '﻿' + lines.join('\r\n');
}

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
