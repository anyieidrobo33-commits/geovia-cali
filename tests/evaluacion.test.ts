import { describe, expect, it } from 'vitest';
import { DIAGNOSTIC, SUS_ITEMS, TASKS, susScore } from '../src/lib/evaluation';

describe('Evaluación con participantes', () => {
  it('la encuesta diagnóstica tiene las 15 preguntas del instrumento', () => {
    expect(DIAGNOSTIC).toHaveLength(15);
    expect(DIAGNOSTIC.map((q) => q.id)).toEqual(Array.from({ length: 15 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`));
  });
  it('la escala SUS tiene 10 ítems y se calcula según Brooke (1996)', () => {
    expect(SUS_ITEMS).toHaveLength(10);
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
    expect(susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0);
    expect(susScore([4, 2, 4, 2, 4, 2, 4, 2, 4, 2])).toBe(75);
  });
  it('las tareas de mapa y seguimiento se completan con reportes de campo reales', () => {
    expect(TASKS.find((t) => t.id === 'T2')!.doneRoute!.test('/r/GVC-2611-C7VNG')).toBe(true);
    expect(TASKS.find((t) => t.id === 'T3')!.doneRoute!.test('/r/GVC-2611-W2AGX')).toBe(true);
    expect(TASKS.find((t) => t.id === 'T3')!.doneRoute!.test('/r/GVC-2611-C7VNG')).toBe(false);
  });
});
