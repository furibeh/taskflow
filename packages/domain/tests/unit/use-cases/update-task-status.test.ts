import { beforeEach, describe, expect, it } from 'vitest';
import { TASK_STATUSES } from '../../../src/tasks/task';
import { createTask, getTask, updateTask } from '../../../src/use-cases/tasks';
import { FakeClock, InMemoryPeople, InMemoryTaskRepository } from '../../support/in-memory';

const BOARD = 'b0000000-0000-4000-8000-000000000001';
const OTHER_BOARD = 'b0000000-0000-4000-8000-000000000002';
const ID = 'a0000000-0000-4000-8000-000000000001';

describe('updateTask: cambio de estado (US2)', () => {
  let people: InMemoryPeople;
  let deps: { tasks: InMemoryTaskRepository; people: InMemoryPeople; clock: FakeClock };

  beforeEach(async () => {
    people = new InMemoryPeople();
    deps = { tasks: new InMemoryTaskRepository(people), people, clock: new FakeClock() };
    await createTask(deps, BOARD, { id: ID, title: 'Preparar demo' });
    deps.clock.advance(60_000);
  });

  it.each(
    TASK_STATUSES.flatMap((from) => TASK_STATUSES.filter((to) => to !== from).map((to) => [from, to])),
  )('permite pasar de %s a %s, con o sin responsable', async (from, to) => {
    deps.tasks.forceStatus(ID, from);
    const result = await updateTask(deps, BOARD, ID, { status: to });
    expect(result.ok && result.value.status).toBe(to);
    expect(result.ok && result.value.assigneeId).toBeNull();
    expect(result.ok && result.value.updatedAt).toEqual(deps.clock.now());
  });

  it('el cambio persiste', async () => {
    await updateTask(deps, BOARD, ID, { status: 'done' });
    const stored = await getTask(deps, BOARD, ID);
    expect(stored.ok && stored.value.status).toBe('done');
  });

  it('cambiar al mismo estado no hace nada ni cambia updatedAt', async () => {
    const before = await getTask(deps, BOARD, ID);
    const result = await updateTask(deps, BOARD, ID, { status: 'pending' });
    expect(result.ok && result.value.updatedAt).toEqual(before.ok && before.value.updatedAt);
  });

  it('rechaza un estado desconocido', async () => {
    const result = await updateTask(deps, BOARD, ID, { status: 'archived' as never });
    expect(result).toEqual({
      ok: false,
      error: { code: 'VALIDATION_ERROR', issues: [{ field: 'status', rule: 'invalid_value' }] },
    });
  });

  it('devuelve TASK_NOT_FOUND para una tarea inexistente o de otro tablero', async () => {
    expect(await updateTask(deps, OTHER_BOARD, ID, { status: 'done' })).toEqual({
      ok: false,
      error: { code: 'TASK_NOT_FOUND' },
    });
    expect(
      await updateTask(deps, BOARD, 'a0000000-0000-4000-8000-000000000099', { status: 'done' }),
    ).toEqual({ ok: false, error: { code: 'TASK_NOT_FOUND' } });
  });
});
