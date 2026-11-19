import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, escapeCsv, reportsToCsv, type ExportableReport } from '../src/lib/csv';

const row: ExportableReport & { created_by: string } = {
  code: 'GVC-2611-7K4QM', category_code: 'hueco', severity: 'alta', status: 'validado',
  sector: 'San Fernando', address: 'Calle 5, Carrera 34', lat: 3.437021, lng: -76.544183,
  description: 'Hueco "grande" en el carril', created_at: '2026-11-19T12:00:00Z', updated_at: '2026-11-19T13:00:00Z',
  is_demo: false, created_by: '9b0c2d6e-1111-4c4c-9999-abcdefabcdef',
};

describe('RF08 · Exportación sin datos personales', () => {
  const csv = reportsToCsv([row]);
  it('no incluye el identificador de quien reportó', () => {
    expect(csv).not.toContain(row.created_by);
    expect(CSV_COLUMNS.join(',')).not.toMatch(/created_by|autor|usuario|email/);
  });
  it('incluye encabezados y nombres legibles', () => {
    expect(csv).toContain('codigo,categoria,severidad,estado');
    expect(csv).toContain('Hueco o bache');
    expect(csv).toContain('Validado en el sistema');
  });
  it('escapa comillas y comas correctamente', () => {
    expect(csv).toContain('"Hueco ""grande"" en el carril"');
    expect(csv).toContain('"Calle 5, Carrera 34"');
  });
  it('incluye BOM UTF-8 para Excel', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
  it('neutraliza fórmulas (inyección CSV)', () => {
    expect(escapeCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCsv('+57 300')).toBe("'+57 300");
  });
});
