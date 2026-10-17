import { beforeEach, describe, expect, it } from 'vitest';
import { createPerson, deletePerson, listPeople } from '../../../src/use-cases/people';
import { createTask, getTask } from '../../../src/use-cases/tasks';
import { FakeClock, InMemoryPeople, InMemoryTaskRepository } from '../../support/in-memory';

const BOARD = 'b0000000-0000-4000-8000-000000000001';
const OTHER_BOARD = 'b0000000-0000-4000-8000-000000000002';
const pid = (n: number) => `c1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tid = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('personas del equipo (US6)', () => {
  let people: InMemoryPeople;
  let tasks: InMemoryTaskRepository;
  let deps: { people: InMemoryPeople; tasks: InMemoryTaskRepository; clock: FakeClock };

  beforeEach(() => {
    people = new InMemoryPeople();
    tasks = new InMemoryTaskRepository(people);
    deps = { people, tasks, clock: new FakeClock() };
  });

  const add = (n: number, name: string, boardId = BOARD) => createPerson(deps, boardId, { id: pid(n), name });

  it('añade una persona con el nombre recortado', async () => {
    const result = await add(1, '  Ana  ');
    expect(result.ok && result.value).toMatchObject({
      replayed: false,
      person: { id: pid(1), name: 'Ana', assignedTaskCount: 0 },
    });
  });

  it('el nombre debe tener entre 1 y 50 caracteres', async () => {
    expect(await add(1, '   ')).toEqual({
      ok: false,
      error: { code: 'VALIDATION_ERROR', issues: [{ field: 'name', rule: 'too_short', limit: 1 }] },
    });
    expect(await add(2, 'a'.repeat(51))).toEqual({
      ok: false,
      error: { code: 'VALIDATION_ERROR', issues: [{ field: 'name', rule: 'too_long', limit: 50 }] },
    });
    expect((await add(3, 'a'.repeat(50))).ok).toBe(true);
  });

  it('rechaza nombres repetidos sin distinguir mayúsculas ni espacios', async () => {
    await add(1, 'Ana');
    expect(await add(2, 'ana')).toEqual({ ok: false, error: { code: 'PERSON_NAME_TAKEN' } });
    expect(await add(3, ' Ana ')).toEqual({ ok: false, error: { code: 'PERSON_NAME_TAKEN' } });
  });

  it('el mismo nombre se permite en otro tablero', async () => {
    await add(1, 'Ana');
    expect((await add(2, 'Ana', OTHER_BOARD)).ok).toBe(true);
  });

  it('el mismo id con el mismo nombre es una repetición; con otro nombre, ID_CONFLICT', async () => {
    await add(1, 'Ana');
    const again = await add(1, 'Ana');
    expect(again.ok && again.value.replayed).toBe(true);
    expect(await add(1, 'Luis')).toEqual({ ok: false, error: { code: 'ID_CONFLICT' } });
  });

  it('lista las personas por nombre con su número de tareas asignadas', async () => {
    await add(1, 'Luis');
    await add(2, 'ana');
    await add(3, 'Berta');
    await createTask(deps, BOARD, { id: tid(1), title: 'Una', assigneeId: pid(1) });
    await createTask(deps, BOARD, { id: tid(2), title: 'Dos', assigneeId: pid(1) });

    const list = await listPeople(deps, BOARD);
    expect(list.map((p) => [p.name, p.assignedTaskCount])).toEqual([
      ['ana', 0],
      ['Berta', 0],
      ['Luis', 2],
    ]);
  });

  it('quitar a una persona deja sus tareas sin asignar y devuelve cuántas eran', async () => {
    await add(1, 'Luis');
    for (const n of [1, 2, 3]) {
      await createTask(deps, BOARD, { id: tid(n), title: `Tarea ${n}`, assigneeId: pid(1) });
    }

    expect(await deletePerson(deps, BOARD, pid(1))).toEqual({
      ok: true,
      value: { id: pid(1), unassignedTaskCount: 3 },
    });
    expect(await listPeople(deps, BOARD)).toEqual([]);
    const task = await getTask(deps, BOARD, tid(1));
    expect(task.ok && task.value).toMatchObject({ assigneeId: null, assignee: null });
  });

  it('quitar una persona inexistente o de otro tablero devuelve PERSON_NOT_FOUND', async () => {
    await add(1, 'Ana', OTHER_BOARD);
    expect(await deletePerson(deps, BOARD, pid(1))).toEqual({ ok: false, error: { code: 'PERSON_NOT_FOUND' } });
    expect(await deletePerson(deps, BOARD, pid(9))).toEqual({ ok: false, error: { code: 'PERSON_NOT_FOUND' } });
  });
});
