import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectMatchesContract } from '../contract/openapi';
import { buildTestApp, type TestApp } from '../support/test-app';

const pid = (n: number) => `c1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tid = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('/api/v1/people (US6)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await buildTestApp();
  });

  beforeEach(async () => {
    await t.reset();
  });

  afterAll(async () => {
    await t.close();
  });

  const addPerson = (payload: object) =>
    t.app.inject({ method: 'POST', url: '/api/v1/people', headers: t.authHeader(), payload });

  it('POST crea (201), repite (200) y valida', async () => {
    const created = await addPerson({ id: pid(1), name: ' Ana ' });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({ id: pid(1), name: 'Ana', assignedTaskCount: 0 });
    expectMatchesContract('createPerson', 201, created.json());

    const replay = await addPerson({ id: pid(1), name: 'Ana' });
    expect(replay.statusCode).toBe(200);
    expectMatchesContract('createPerson', 200, replay.json());

    const conflict = await addPerson({ id: pid(1), name: 'Luis' });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({ code: 'ID_CONFLICT' });

    const taken = await addPerson({ id: pid(2), name: 'ANA' });
    expect(taken.statusCode).toBe(409);
    expect(taken.json()).toMatchObject({ code: 'PERSON_NAME_TAKEN' });
    expectMatchesContract('createPerson', 409, taken.json());

    const invalid = await addPerson({ id: pid(3), name: 'a'.repeat(51) });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().errors).toEqual([{ field: 'name', rule: 'too_long', limit: 50 }]);
    expectMatchesContract('createPerson', 400, invalid.json());
  });

  it('dos altas simultáneas de "Ana" y "ANA": una 201 y otra 409 PERSON_NAME_TAKEN', async () => {
    const [a, b] = await Promise.all([
      addPerson({ id: pid(1), name: 'Ana' }),
      addPerson({ id: pid(2), name: 'ANA' }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    const rejected = a.statusCode === 409 ? a : b;
    expect(rejected.json()).toMatchObject({ code: 'PERSON_NAME_TAKEN' });
  });

  it('GET lista por nombre con el número de tareas asignadas', async () => {
    await addPerson({ id: pid(1), name: 'Luis' });
    await addPerson({ id: pid(2), name: 'Ana' });
    await t.app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: t.authHeader(),
      payload: { id: tid(1), title: 'Una', assigneeId: pid(1) },
    });

    const res = await t.app.inject({ method: 'GET', url: '/api/v1/people', headers: t.authHeader() });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([
      { id: pid(2), name: 'Ana', assignedTaskCount: 0 },
      { id: pid(1), name: 'Luis', assignedTaskCount: 1 },
    ]);
    expectMatchesContract('listPeople', 200, res.json());
  });

  it('DELETE quita a la persona y deja sus tareas sin asignar', async () => {
    await addPerson({ id: pid(1), name: 'Luis' });
    for (const n of [1, 2]) {
      await t.app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: t.authHeader(),
        payload: { id: tid(n), title: `Tarea ${n}`, assigneeId: pid(1) },
      });
    }

    const res = await t.app.inject({ method: 'DELETE', url: `/api/v1/people/${pid(1)}`, headers: t.authHeader() });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: pid(1), unassignedTaskCount: 2 });
    expectMatchesContract('deletePerson', 200, res.json());

    const task = await t.app.inject({ method: 'GET', url: `/api/v1/tasks/${tid(1)}`, headers: t.authHeader() });
    expect(task.json().assignee).toBeNull();

    const missing = await t.app.inject({ method: 'DELETE', url: `/api/v1/people/${pid(1)}`, headers: t.authHeader() });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: 'PERSON_NOT_FOUND' });
    expectMatchesContract('deletePerson', 404, missing.json());
  });
});
