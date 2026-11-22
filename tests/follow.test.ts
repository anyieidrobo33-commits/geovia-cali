import { describe, expect, it } from 'vitest';
import { diffSnapshot } from '../src/lib/follow';
import type { FollowSnapshot } from '../src/lib/api';

const cur = (o: Partial<FollowSnapshot>): FollowSnapshot => ({
  id: 'r1', code: 'GVC-2611-C7VNG', category_code: 'hueco', sector: 'La Flora', status: 'recibido',
  history_count: 1, updates_count: 0, last_update_condition: null, last_change_at: '2026-11-22T15:00:00Z', ...o,
});

describe('Seguimiento · avisos de cambios', () => {
  it('sin estado previo solo registra la línea base (no avisa)', () => {
    expect(diffSnapshot(null, cur({ status: 'validado' }))).toEqual([]);
  });
  it('sin cambios no genera avisos', () => {
    expect(diffSnapshot({ status: 'recibido', history_count: 1, updates_count: 0 }, cur({}))).toEqual([]);
  });
  it('avisa el cambio de estado con el nombre legible', () => {
    const a = diffSnapshot({ status: 'recibido', history_count: 1, updates_count: 0 }, cur({ status: 'validado', history_count: 3 }));
    expect(a).toHaveLength(1);
    expect(a[0].text).toContain('Validado en el sistema');
    expect(a[0].kind).toBe('estado');
  });
  it('avisa nuevas actualizaciones ciudadanas con la última observación', () => {
    const a = diffSnapshot({ status: 'validado', history_count: 3, updates_count: 0 }, cur({ status: 'validado', history_count: 3, updates_count: 2, last_update_condition: 'reparado' }));
    expect(a).toHaveLength(1);
    expect(a[0].text).toMatch(/2 actualizaciones nuevas/);
    expect(a[0].text).toContain('Ya lo arreglaron');
  });
  it('genera claves estables para no duplicar avisos', () => {
    const prev = { status: 'recibido' as const, history_count: 1, updates_count: 0 };
    const c = cur({ status: 'en_revision', history_count: 2 });
    expect(diffSnapshot(prev, c)[0].key).toBe(diffSnapshot(prev, c)[0].key);
  });
});
