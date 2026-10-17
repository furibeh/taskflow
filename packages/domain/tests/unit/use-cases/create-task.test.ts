import { beforeEach, describe, expect, it } from 'vitest';
import { createTask } from '../../../src/use-cases/tasks';
import { FakeClock, InMemoryPeople, InMemoryTaskRepository } from '../../support/in-memory';

const BOARD = 'b0000000-0000-4000-8000-000000000001';
const OTHER_BOARD = 'b0000000-0000-4000-8000-000000000002';
const ID = 'a0000000-0000-4000-8000-000000000001';

describe('createTask', () => {
  let people: InMemoryPeople;
  let deps: { tasks: InMemoryTaskRepository; people: InMemoryPeople; clock: FakeClock };

  beforeEach(() => {
    people = new InMemoryPeople();
    deps = { tasks: new InMemoryTaskRepository(people), people, clock: new FakeClock() };
  });

  const create = (input: Partial<Parameters<typeof createTask>[2]> = {}) =>
    createTask(deps, BOARD, { id: ID, title: 'Preparar demo', ...input });

  it('crea la tarea en Pendiente con título recortado y normalizado', async () => {
    const result = await create({ title: '  Revisión  ', description: 'Slides' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.replayed).toBe(false);
    expect(result.value.task).toMatchObject({
      id: ID,
      boardId: BOARD,
      title: 'Revisión',
      description: 'Slides',
      status: 'pending',
      assigneeId: null,
      assignee: null,
    });
    expect(result.value.task.createdAt).toEqual(deps.clock.now());
    expect(result.value.task.updatedAt).toEqual(deps.clock.now());
  });

  it('rechaza un título vacío o solo con espacios', async () => {
    for (const title of ['', '   ', '\n\t']) {
      const result = await create({ title });
      expect(result).toEqual({
        ok: false,
        error: { code: 'VALIDATION_ERROR', issues: [{ field: 'title', rule: 'too_short', limit: 1 }] },
      });
    }
  });

  it('acepta 200 caracteres y rechaza 201', async () => {
    expect((await create({ title: 'a'.repeat(200) })).ok).toBe(true);
    const result = await create({ id: ID.replace(/1$/, '2'), title: 'a'.repeat(201) });
    expect(result).toEqual({
      ok: false,
      error: { code: 'VALIDATION_ERROR', issues: [{ field: 'title', rule: 'too_long', limit: 200 }] },
    });
  });

  it('cuenta un emoji como un carácter', async () => {
    expect((await create({ title: '😀'.repeat(200) })).ok).toBe(true);
  });

  it('la descripción es opcional y admite hasta 5000 caracteres', async () => {
    const empty = await create();
    expect(empty.ok && empty.value.task.description).toBe('');

    const max = await create({ id: ID.replace(/1$/, '3'), description: 'x'.repeat(5000) });
    expect(max.ok).toBe(true);

    const tooLong = await create({ id: ID.replace(/1$/, '4'), description: 'x'.repeat(5001) });
    expect(tooLong).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        issues: [{ field: 'description', rule: 'too_long', limit: 5000 }],
      },
    });
  });

  it('informa de todos los campos inválidos a la vez', async () => {
    const result = await create({ title: ' ', description: 'x'.repeat(5001) });
    expect(!result.ok && result.error.code === 'VALIDATION_ERROR' && result.error.issues).toHaveLength(2);
  });

  it('el mismo id con los mismos datos devuelve la tarea existente (repetición idempotente)', async () => {
    await create({ description: 'Slides' });
    deps.clock.advance(5_000);
    const again = await create({ title: ' Preparar demo ', description: 'Slides' });

    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.replayed).toBe(true);
    expect(again.value.task.createdAt).toEqual(new Date('2026-10-17T10:00:00Z'));
    expect(deps.tasks.count()).toBe(1);
  });

  it('el mismo id con datos distintos devuelve ID_CONFLICT', async () => {
    await create();
    expect(await create({ title: 'Otra cosa' })).toEqual({ ok: false, error: { code: 'ID_CONFLICT' } });
  });

  it('un id ya usado en otro tablero devuelve ID_CONFLICT', async () => {
    await createTask(deps, OTHER_BOARD, { id: ID, title: 'De otro tablero' });
    expect(await create()).toEqual({ ok: false, error: { code: 'ID_CONFLICT' } });
  });

  it('asigna un responsable existente del tablero', async () => {
    const ana = people.add(BOARD, 'Ana');
    const result = await create({ assigneeId: ana });
    expect(result.ok && result.value.task.assignee).toEqual({ id: ana, name: 'Ana' });
  });

  it('rechaza un responsable inexistente o de otro tablero', async () => {
    const foreign = people.add(OTHER_BOARD, 'Luis');
    expect(await create({ assigneeId: foreign })).toEqual({
      ok: false,
      error: { code: 'ASSIGNEE_NOT_FOUND' },
    });
    expect(deps.tasks.count()).toBe(0);
  });
});
