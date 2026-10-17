import { beforeEach, describe, expect, it } from 'vitest';
import { createTask, updateTask } from '../../../src/use-cases/tasks';
import { FakeClock, InMemoryPeople, InMemoryTaskRepository } from '../../support/in-memory';

const BOARD = 'b0000000-0000-4000-8000-000000000001';
const OTHER_BOARD = 'b0000000-0000-4000-8000-000000000002';
const ID = 'a0000000-0000-4000-8000-000000000001';

describe('asignación de tareas (US3)', () => {
  let people: InMemoryPeople;
  let deps: { tasks: InMemoryTaskRepository; people: InMemoryPeople; clock: FakeClock };
  let ana: string;
  let luis: string;

  beforeEach(() => {
    people = new InMemoryPeople();
    deps = { tasks: new InMemoryTaskRepository(people), people, clock: new FakeClock() };
    ana = people.add(BOARD, 'Ana');
    luis = people.add(BOARD, 'Luis');
  });

  it('crea una tarea ya asignada', async () => {
    const result = await createTask(deps, BOARD, { id: ID, title: 'Preparar demo', assigneeId: ana });
    expect(result.ok && result.value.task.assignee).toEqual({ id: ana, name: 'Ana' });
  });

  it('reasigna y deja sin asignar conservando el estado', async () => {
    await createTask(deps, BOARD, { id: ID, title: 'Preparar demo', assigneeId: ana });
    await updateTask(deps, BOARD, ID, { status: 'in_progress' });

    const reassigned = await updateTask(deps, BOARD, ID, { assigneeId: luis });
    expect(reassigned.ok && reassigned.value.assignee).toEqual({ id: luis, name: 'Luis' });

    const unassigned = await updateTask(deps, BOARD, ID, { assigneeId: null });
    expect(unassigned.ok && unassigned.value).toMatchObject({
      assigneeId: null,
      assignee: null,
      status: 'in_progress',
    });
  });

  it('rechaza un responsable inexistente o de otro tablero sin modificar la tarea', async () => {
    await createTask(deps, BOARD, { id: ID, title: 'Preparar demo', assigneeId: ana });
    const foreign = people.add(OTHER_BOARD, 'Eva');

    for (const assigneeId of [foreign, 'c9999999-0000-4000-8000-000000000000']) {
      expect(await updateTask(deps, BOARD, ID, { assigneeId })).toEqual({
        ok: false,
        error: { code: 'ASSIGNEE_NOT_FOUND' },
      });
    }
    expect(await createTask(deps, BOARD, { id: ID.replace(/1$/, '2'), title: 'Otra', assigneeId: foreign })).toEqual({
      ok: false,
      error: { code: 'ASSIGNEE_NOT_FOUND' },
    });
  });

  it('una tarea sin responsable puede pasar a En progreso y a Hecha (FR-015)', async () => {
    await createTask(deps, BOARD, { id: ID, title: 'Sin dueño' });
    expect((await updateTask(deps, BOARD, ID, { status: 'in_progress' })).ok).toBe(true);
    const done = await updateTask(deps, BOARD, ID, { status: 'done' });
    expect(done.ok && done.value).toMatchObject({ status: 'done', assigneeId: null });
  });
});
