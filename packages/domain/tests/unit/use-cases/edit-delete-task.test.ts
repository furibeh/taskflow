import { beforeEach, describe, expect, it } from 'vitest';
import { deletePerson } from '../../../src/use-cases/people';
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  purgeDeletedTasks,
  restoreTask,
  updateTask,
} from '../../../src/use-cases/tasks';
import { FakeClock, InMemoryPeople, InMemoryTaskRepository } from '../../support/in-memory';

const BOARD = 'b0000000-0000-4000-8000-000000000001';
const ID = 'a0000000-0000-4000-8000-000000000001';

describe('editar, borrar y deshacer (US5)', () => {
  let people: InMemoryPeople;
  let deps: { tasks: InMemoryTaskRepository; people: InMemoryPeople; clock: FakeClock };
  let ana: string;

  beforeEach(async () => {
    people = new InMemoryPeople();
    deps = { tasks: new InMemoryTaskRepository(people), people, clock: new FakeClock() };
    ana = people.add(BOARD, 'Ana');
    await createTask(deps, BOARD, { id: ID, title: 'Preparar demo', description: 'Slides', assigneeId: ana });
    await updateTask(deps, BOARD, ID, { status: 'in_progress' });
  });

  it('edita título y descripción sin cambiar estado ni responsable', async () => {
    deps.clock.advance(1_000);
    const result = await updateTask(deps, BOARD, ID, { title: '  Demo final ', description: 'Con datos' });
    expect(result.ok && result.value).toMatchObject({
      title: 'Demo final',
      description: 'Con datos',
      status: 'in_progress',
      assigneeId: ana,
      updatedAt: deps.clock.now(),
    });
  });

  it('la edición aplica las mismas reglas que la creación', async () => {
    expect(await updateTask(deps, BOARD, ID, { title: ' ', description: 'x'.repeat(5001) })).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        issues: [
          { field: 'title', rule: 'too_short', limit: 1 },
          { field: 'description', rule: 'too_long', limit: 5000 },
        ],
      },
    });
    const stored = await getTask(deps, BOARD, ID);
    expect(stored.ok && stored.value.title).toBe('Preparar demo');
  });

  it('borrar oculta la tarea y devuelve el límite para deshacer (borrado + 15 s)', async () => {
    const result = await deleteTask(deps, BOARD, ID);
    expect(result).toEqual({
      ok: true,
      value: { id: ID, undoUntil: new Date(deps.clock.now().getTime() + 15_000) },
    });
    expect((await listTasks(deps, BOARD)).items).toEqual([]);
    expect(await getTask(deps, BOARD, ID)).toEqual({ ok: false, error: { code: 'TASK_NOT_FOUND' } });
    expect(await updateTask(deps, BOARD, ID, { status: 'done' })).toEqual({
      ok: false,
      error: { code: 'TASK_NOT_FOUND' },
    });
    expect(await deleteTask(deps, BOARD, ID)).toEqual({ ok: false, error: { code: 'TASK_NOT_FOUND' } });
  });

  it('restaurar dentro de los 15 s recupera todos los datos', async () => {
    const before = await getTask(deps, BOARD, ID);
    await deleteTask(deps, BOARD, ID);
    deps.clock.advance(14_000);

    const restored = await restoreTask(deps, BOARD, ID);
    expect(restored).toEqual(before);
    expect((await listTasks(deps, BOARD)).items).toHaveLength(1);
  });

  it('pasados 15 s devuelve UNDO_EXPIRED', async () => {
    await deleteTask(deps, BOARD, ID);
    deps.clock.advance(15_001);
    expect(await restoreTask(deps, BOARD, ID)).toEqual({ ok: false, error: { code: 'UNDO_EXPIRED' } });
  });

  it('si su responsable fue quitado durante la ventana, se restaura sin asignar (FR-013d)', async () => {
    await deleteTask(deps, BOARD, ID);
    await deletePerson(deps, BOARD, ana);
    const restored = await restoreTask(deps, BOARD, ID);
    expect(restored.ok && restored.value).toMatchObject({ assigneeId: null, assignee: null });
  });

  it('restaurar una tarea no borrada o inexistente devuelve TASK_NOT_FOUND', async () => {
    expect(await restoreTask(deps, BOARD, ID)).toEqual({ ok: false, error: { code: 'TASK_NOT_FOUND' } });
  });

  it('la purga elimina físicamente lo borrado hace más de 15 s, según el reloj', async () => {
    await deleteTask(deps, BOARD, ID);
    deps.clock.advance(10_000);
    expect(await purgeDeletedTasks(deps)).toBe(0);
    deps.clock.advance(6_000);
    expect(await purgeDeletedTasks(deps)).toBe(1);
    expect(deps.tasks.count()).toBe(0);
    expect(await restoreTask(deps, BOARD, ID)).toEqual({ ok: false, error: { code: 'TASK_NOT_FOUND' } });
  });
});
