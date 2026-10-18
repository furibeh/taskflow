import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../support/test-app';

const TASK_A = 'f0000000-0000-4000-8000-00000000000a';
const TASK_B = 'f0000000-0000-4000-8000-00000000000b';
const ANA_A = 'c0000000-0000-4000-8000-00000000000a';
const ANA_B = 'c0000000-0000-4000-8000-00000000000b';

/**
 * Aislamiento entre tableros (US2, FR-108–FR-111, SC-102, research R27): con el código de un
 * tablero no se ve ni se modifica nada de otro, y los fallos son los mismos que si el recurso
 * no existiera.
 */
describe('aislamiento entre tableros (US2)', () => {
  let t: TestApp;
  let codeB: string;

  beforeAll(async () => {
    t = await buildTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  const as = (code: string) => ({ authorization: `Bearer ${code}` });
  const callA = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    t.app.inject({ method, url, headers: t.authHeader(), ...(payload ? { payload } : {}) });
  const callB = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    t.app.inject({ method, url, headers: as(codeB), ...(payload ? { payload } : {}) });

  beforeEach(async () => {
    // A: el tablero de la prueba ("Mi tablero"); B: creado desde la web.
    await t.reset();
    const created = await t.app.inject({
      method: 'POST',
      url: '/api/v1/boards',
      payload: { id: 'b0000000-0000-4000-8000-00000000000b', name: 'Equipo B' },
    });
    codeB = created.json().accessCode;

    await callA('POST', '/api/v1/people', { id: ANA_A, name: 'Ana' });
    await callA('POST', '/api/v1/tasks', { id: TASK_A, title: 'Solo A', description: 'Secreto', assigneeId: ANA_A });
    await callB('POST', '/api/v1/tasks', { id: TASK_B, title: 'Tarea de B' });
  });

  const taskA = async () => (await callA('GET', `/api/v1/tasks/${TASK_A}`)).json();

  it('con el código de B, una tarea de A no existe: GET, PATCH y DELETE dan 404 sin cambios', async () => {
    const before = await taskA();

    for (const res of [
      await callB('GET', `/api/v1/tasks/${TASK_A}`),
      await callB('PATCH', `/api/v1/tasks/${TASK_A}`, { title: 'Cambiada por B', status: 'done', assigneeId: null }),
      await callB('DELETE', `/api/v1/tasks/${TASK_A}`),
    ]) {
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('TASK_NOT_FOUND');
      expect(res.body).not.toContain('Solo A');
    }

    expect(await taskA()).toEqual(before);
  });

  it('con el código de B no se puede restaurar una tarea borrada de A', async () => {
    expect((await callA('DELETE', `/api/v1/tasks/${TASK_A}`)).statusCode).toBe(200);

    const res = await callB('POST', `/api/v1/tasks/${TASK_A}/restore`);
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('TASK_NOT_FOUND');

    expect((await callA('POST', `/api/v1/tasks/${TASK_A}/restore`)).statusCode).toBe(200);
  });

  it('con el código de B no se puede quitar a una persona de A', async () => {
    const res = await callB('DELETE', `/api/v1/people/${ANA_A}`);
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('PERSON_NOT_FOUND');
    expect((await callA('GET', '/api/v1/people')).json().items).toEqual([
      { id: ANA_A, name: 'Ana', assignedTaskCount: 1 },
    ]);
  });

  it('una tarea de B no se puede asignar a una persona de A (al crear ni al editar)', async () => {
    const create = await callB('POST', '/api/v1/tasks', {
      id: 'f0000000-0000-4000-8000-0000000000b2',
      title: 'Otra de B',
      assigneeId: ANA_A,
    });
    expect(create.statusCode).toBe(422);
    expect(create.json().code).toBe('ASSIGNEE_NOT_FOUND');

    const edit = await callB('PATCH', `/api/v1/tasks/${TASK_B}`, { assigneeId: ANA_A });
    expect(edit.statusCode).toBe(422);
    expect(edit.json().code).toBe('ASSIGNEE_NOT_FOUND');
    expect((await callB('GET', `/api/v1/tasks/${TASK_B}`)).json().assignee).toBeNull();
  });

  it('el listado, la búsqueda, los filtros y los recuentos de B solo contienen datos de B', async () => {
    const all = (await callB('GET', '/api/v1/tasks')).json();
    expect(all.items.map((task: { id: string }) => task.id)).toEqual([TASK_B]);
    expect(all.counts).toEqual({ pending: 1, in_progress: 0, done: 0 });

    const search = (await callB('GET', '/api/v1/tasks?q=Solo')).json();
    expect(search.items).toEqual([]);
    expect(search.counts).toEqual({ pending: 0, in_progress: 0, done: 0 });

    const byAssignee = await callB('GET', `/api/v1/tasks?assignee=${ANA_A}`);
    expect(byAssignee.statusCode).toBe(200);
    expect(byAssignee.json().items).toEqual([]);

    expect((await callB('GET', '/api/v1/people')).json().items).toEqual([]);
    expect((await callB('GET', '/api/v1/board')).json()).toMatchObject({
      name: 'Equipo B',
      taskCount: 1,
      personCount: 0,
    });
  });

  it('dos tableros pueden tener una persona con el mismo nombre (FR-110)', async () => {
    const res = await callB('POST', '/api/v1/people', { id: ANA_B, name: 'ana' });
    expect(res.statusCode).toBe(201);
    expect((await callB('GET', '/api/v1/people')).json().items).toEqual([
      { id: ANA_B, name: 'ana', assignedTaskCount: 0 },
    ]);
  });

  it('regenerar el enlace de A no afecta al de B (FR-111)', async () => {
    const oldA = t.accessCode;
    const rotated = await callA('POST', '/api/v1/board/access-code/regenerate');
    expect(rotated.statusCode).toBe(200);

    expect((await t.app.inject({ method: 'GET', url: '/api/v1/board', headers: as(oldA) })).statusCode).toBe(401);
    const b = await callB('GET', '/api/v1/board');
    expect(b.statusCode).toBe(200);
    expect(b.json().name).toBe('Equipo B');
  });

  it('reutilizar en B el id de una tarea o persona de A es 409 ID_CONFLICT sin revelar sus datos', async () => {
    // Los ids son globales (UUID): no se crea nada en B ni se toca A. Ver la nota del informe de T031.
    const task = await callB('POST', '/api/v1/tasks', { id: TASK_A, title: 'Intento' });
    expect(task.statusCode).toBe(409);
    expect(task.json().code).toBe('ID_CONFLICT');
    expect(task.body).not.toContain('Solo A');

    const person = await callB('POST', '/api/v1/people', { id: ANA_A, name: 'Otra' });
    expect(person.statusCode).toBe(409);
    expect(person.json().code).toBe('ID_CONFLICT');
    expect(person.body).not.toContain('Ana');

    expect((await taskA()).title).toBe('Solo A');
    expect((await callB('GET', '/api/v1/tasks')).json().items).toHaveLength(1);
  });
});
