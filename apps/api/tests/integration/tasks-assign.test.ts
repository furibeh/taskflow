import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectMatchesContract } from '../contract/openapi';
import { buildTestApp, type TestApp } from '../support/test-app';

const ID = 'a0000000-0000-4000-8000-000000000001';
const ANA = 'c1000000-0000-4000-8000-000000000001';
const LUIS = 'c1000000-0000-4000-8000-000000000002';

describe('asignación por la API (US3)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await buildTestApp();
  });

  beforeEach(async () => {
    await t.reset();
    for (const [id, name] of [[ANA, 'Ana'], [LUIS, 'Luis']]) {
      await t.app.inject({ method: 'POST', url: '/api/v1/people', headers: t.authHeader(), payload: { id, name } });
    }
  });

  afterAll(async () => {
    await t.close();
  });

  const patch = (payload: object) =>
    t.app.inject({ method: 'PATCH', url: `/api/v1/tasks/${ID}`, headers: t.authHeader(), payload });

  it('crea con responsable, reasigna y quita la asignación', async () => {
    const created = await t.app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: t.authHeader(),
      payload: { id: ID, title: 'Preparar demo', assigneeId: ANA },
    });
    expect(created.json().assignee).toEqual({ id: ANA, name: 'Ana' });

    const reassigned = await patch({ assigneeId: LUIS });
    expect(reassigned.statusCode).toBe(200);
    expect(reassigned.json().assignee).toEqual({ id: LUIS, name: 'Luis' });
    expectMatchesContract('updateTask', 200, reassigned.json());

    const unassigned = await patch({ assigneeId: null });
    expect(unassigned.json().assignee).toBeNull();
  });

  it('un responsable inexistente devuelve 422 ASSIGNEE_NOT_FOUND', async () => {
    await t.app.inject({ method: 'POST', url: '/api/v1/tasks', headers: t.authHeader(), payload: { id: ID, title: 'X' } });
    const res = await patch({ assigneeId: 'c9999999-0000-4000-8000-000000000000' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: 'ASSIGNEE_NOT_FOUND' });
    expectMatchesContract('updateTask', 422, res.json());
  });

  it('al quitar a la persona, sus tareas quedan sin asignar', async () => {
    await t.app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: t.authHeader(),
      payload: { id: ID, title: 'Preparar demo', assigneeId: ANA },
    });
    await t.app.inject({ method: 'DELETE', url: `/api/v1/people/${ANA}`, headers: t.authHeader() });
    const task = await t.app.inject({ method: 'GET', url: `/api/v1/tasks/${ID}`, headers: t.authHeader() });
    expect(task.json().assignee).toBeNull();
  });
});
