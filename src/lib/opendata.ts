// Datos abiertos: GeoJSON de reportes públicos SIN datos personales.
import { categoryMeta, statusMeta } from './domain';
import type { Report } from './api';

export const GEOJSON_PROPERTIES = [
  'codigo', 'categoria', 'categoria_nombre', 'severidad', 'estado', 'estado_nombre',
  'sector', 'direccion_aproximada', 'descripcion', 'apoyos', 'fecha_registro', 'ultima_actualizacion', 'dato_demostracion',
] as const;

type PublicReport = Pick<Report, 'code' | 'category_code' | 'severity' | 'status' | 'sector' | 'address' | 'description'
  | 'lat' | 'lng' | 'supports_count' | 'created_at' | 'updated_at' | 'is_demo'>;

export function reportsToGeoJSON(rows: PublicReport[]) {
  return {
    type: 'FeatureCollection' as const,
    name: 'geovia_cali_reportes',
    metadata: {
      fuente: 'GeoVía Cali — reportes ciudadanos de la malla vial de Santiago de Cali',
      licencia: 'CC BY 4.0',
      generado: new Date().toISOString(),
      nota: 'Sin datos personales. «Validado» indica consistencia del registro, no inspección oficial.',
    },
    features: rows.filter((r) => r.status !== 'rechazado').map((r) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [Number(r.lng.toFixed(6)), Number(r.lat.toFixed(6))] },
      properties: {
        codigo: r.code,
        categoria: r.category_code,
        categoria_nombre: categoryMeta(r.category_code).name,
        severidad: r.severity,
        estado: r.status,
        estado_nombre: statusMeta(r.status).label,
        sector: r.sector,
        direccion_aproximada: r.address,
        descripcion: r.description,
        apoyos: r.supports_count ?? 0,
        fecha_registro: r.created_at,
        ultima_actualizacion: r.updated_at,
        dato_demostracion: r.is_demo,
      },
    })),
  };
}
