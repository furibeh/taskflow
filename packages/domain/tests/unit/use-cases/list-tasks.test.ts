import { beforeEach, describe, expect, it } from 'vitest';
import { createTask, getTask, listTasks } from '../../../src/use-cases/tasks';
import { FakeClock, InMemoryPeople, InMemoryTaskRepository } from '../../support/in-memory';

const BOARD = 'b0000000-0000-4000-8000-000000000001';
const OTHER_BOARD = 'b0000000-0000-4000-8000-000000000002';
const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('listTasks y getTask', () => {
  let deps: { tasks: InMemoryTaskRepository; people: InMemoryPeople; clock: FakeClock };

  beforeEach(() => {
    const people = new InMemoryPeople();
    deps = { tasks: new InMemoryTaskRepository(people), people, clock: new FakeClock() };
  });

  const seed = async (boardId: string, n: number, title: string) => {
    const result = await createTask(deps, boardId, { id: id(n), title });
    deps.clock.advance(1_000);
    if (!result.ok) throw new Error(result.error.code);
  };

  it('devuelve las tareas del tablero de la más reciente a la más antigua, con recuentos', async () => {
    await seed(BOARD, 1, 'Primera');
    await seed(BOARD, 2, 'Segunda');
    await seed(OTHER_BOARD, 3, 'De otro tablero');
    deps.tasks.forceStatus(id(1), 'done');

    const { items, counts } = await listTasks(deps, BOARD);

    expect(items.map((t) => t.title)).toEqual(['Segunda', 'Primera']);
    expect(counts).toEqual({ pending: 1, in_progress: 0, done: 1 });
  });

  it('un tablero sin tareas devuelve lista vacía y recuentos a cero', async () => {
    expect(await listTasks(deps, BOARD)).toEqual({
      items: [],
      counts: { pending: 0, in_progress: 0, done: 0 },
    });
  });

  it('getTask devuelve la tarea o TASK_NOT_FOUND si no existe o es de otro tablero', async () => {
    await seed(BOARD, 1, 'Primera');
    await seed(OTHER_BOARD, 2, 'Ajena');

    const found = await getTask(deps, BOARD, id(1));
    expect(found.ok && found.value.title).toBe('Primera');
    expect(await getTask(deps, BOARD, id(2))).toEqual({ ok: false, error: { code: 'TASK_NOT_FOUND' } });
    expect(await getTask(deps, BOARD, id(99))).toEqual({ ok: false, error: { code: 'TASK_NOT_FOUND' } });
  });
});
