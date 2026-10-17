import { describe, expect, it } from 'vitest';
import { dragAnnouncements } from '../../src/features/board/BoardDnd';

const active = (status: string) =>
  ({ id: 't1', data: { current: { task: { id: 't1', title: 'Preparar demo', status } } } }) as never;

describe('anuncios del arrastre con puntero (T145, FR-019a)', () => {
  it('al coger la tarjeta anuncia su columna de origen', () => {
    expect(dragAnnouncements.onDragStart({ active: active('in_progress') })).toBe(
      'Tarea cogida. Columna actual: En progreso.',
    );
  });

  it('al pasar sobre una columna y soltar anuncia su nombre', () => {
    expect(dragAnnouncements.onDragOver({ active: active('pending'), over: { id: 'done' } } as never)).toBe(
      'Sobre Hecha',
    );
    expect(dragAnnouncements.onDragEnd({ active: active('pending'), over: { id: 'done' } } as never)).toBe(
      'Tarea soltada en Hecha',
    );
    expect(dragAnnouncements.onDragEnd({ active: active('pending'), over: null } as never)).toBe(
      'Movimiento cancelado',
    );
  });
});
