import { describe, expect, it } from 'vitest';
import { GEOJSON_PROPERTIES, reportsToGeoJSON } from '../src/lib/opendata';

const base = {
  code: 'GVC-2611-C7VNG', category_code: 'hueco' as const, severity: 'alta' as const, status: 'validado' as const,
  sector: 'La Flora (Comuna 2)', address: 'Calle 50 Norte', description: 'Hueco amplio con la base expuesta.',
  lat: 3.4880241, lng: -76.5250241, supports_count: 3, created_at: '2026-11-22T12:00:00Z', updated_at: '2026-11-22T13:00:00Z',
  is_demo: false, created_by: '9b0c2d6e-1111-4c4c-9999-abcdefabcdef',
};

describe('Datos abiertos · GeoJSON', () => {
  const gj = reportsToGeoJSON([base, { ...base, code: 'GVC-2611-XXXXX', status: 'rechazado' as const }]);
  it('es una FeatureCollection con coordenadas [lng, lat]', () => {
    expect(gj.type).toBe('FeatureCollection');
    expect(gj.features[0].geometry.coordinates).toEqual([-76.525024, 3.488024]);
  });
  it('excluye los reportes rechazados', () => {
    expect(gj.features).toHaveLength(1);
  });
  it('no contiene datos personales', () => {
    const txt = JSON.stringify(gj);
    expect(txt).not.toContain(base.created_by);
    expect(GEOJSON_PROPERTIES.join(',')).not.toMatch(/created_by|email|usuario|autor/);
    expect(Object.keys(gj.features[0].properties).sort()).toEqual([...GEOJSON_PROPERTIES].sort());
  });
  it('declara licencia y fuente', () => {
    expect(gj.metadata.licencia).toBe('CC BY 4.0');
  });
});
