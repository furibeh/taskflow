import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectMatchesContract } from '../contract/openapi';
import { buildTestApp, type TestApp } from '../support/test-app';

const ID = 'a0000000-0000-4000-8000-000000000001';

describe('PATCH /api/v1/tasks/{taskId}: estado (US2)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await buildTestApp();
  });

  beforeEach(async () => {
    await t.reset();
    await t.app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: t.authHeader(),
      payload: { id: ID, title: 'Preparar demo' },
    });
  });

  afterAll(async () => {
    await t.close();
  });

  const patch = (payload: unknown, id = ID) =>
    t.app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${id}`,
      headers: t.authHeader(),
      payload: payload as object,
    });

  it('cambia el estado y la tarea aparece en su nueva columna', async () => {
    t.clock.advance(1_000);
    const res = await patch({ status: 'done' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: ID, status: 'done' });
    expect(res.json().updatedAt).not.toBe(res.json().createdAt);
    expectMatchesContract('updateTask', 200, res.json());

    const list = await t.app.inject({ method: 'GET', url: '/api/v1/tasks', headers: t.authHeader() });
    expect(list.json().counts).toEqual({ pending: 0, in_progress: 0, done: 1 });
  });

  it('rechaza un estado desconocido', async () => {
    const res = await patch({ status: 'archived' });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors).toEqual([{ field: 'status', rule: 'invalid_value' }]);
    expectMatchesContract('updateTask', 400, res.json());
  });

  it('rechaza un cuerpo vacío', async () => {
    const res = await patch({});
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rechaza campos desconocidos', async () => {
    const res = await patch({ status: 'done', priority: 'alta' });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors).toEqual([{ field: 'priority', rule: 'unknown_field' }]);
  });

  it('una tarea inexistente devuelve 404 TASK_NOT_FOUND', async () => {
    const res = await patch({ status: 'done' }, 'a0000000-0000-4000-8000-000000000099');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'TASK_NOT_FOUND' });
    expectMatchesContract('updateTask', 404, res.json());
  });
});
