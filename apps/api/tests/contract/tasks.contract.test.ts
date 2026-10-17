import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../support/test-app';
import { expectMatchesContract } from './openapi';

const ID = 'a0000000-0000-4000-8000-000000000001';

describe('contrato de tareas (US1)', () => {
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

  const post = (payload: object) =>
    t.app.inject({ method: 'POST', url: '/api/v1/tasks', headers: t.authHeader(), payload });

  it('createTask 201, 200, 400 y 409', async () => {
    const created = await post({ id: ID, title: 'Preparar demo', description: 'Slides' });
    expectMatchesContract('createTask', 201, created.json());

    const replay = await post({ id: ID, title: 'Preparar demo', description: 'Slides' });
    expectMatchesContract('createTask', 200, replay.json());

    const invalid = await post({ id: ID, title: '' });
    expectMatchesContract('createTask', 400, invalid.json());

    const conflict = await post({ id: ID, title: 'Distinto' });
    expectMatchesContract('createTask', 409, conflict.json());
  });

  it('listTasks 200', async () => {
    await post({ id: ID, title: 'Preparar demo' });
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/tasks', headers: t.authHeader() });
    expectMatchesContract('listTasks', 200, res.json());
  });

  it('getTask 200 y 404', async () => {
    await post({ id: ID, title: 'Preparar demo' });
    const found = await t.app.inject({ method: 'GET', url: `/api/v1/tasks/${ID}`, headers: t.authHeader() });
    expectMatchesContract('getTask', 200, found.json());

    const missing = await t.app.inject({
      method: 'GET',
      url: '/api/v1/tasks/a0000000-0000-4000-8000-000000000009',
      headers: t.authHeader(),
    });
    expectMatchesContract('getTask', 404, missing.json());
  });
});

describe('contrato: respuestas de error de forma (convergencia T139)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await buildTestApp();
    await t.reset();
  });

  afterAll(async () => {
    await t.close();
  });

  const big = 'x'.repeat(17 * 1024);

  it('createTask y updateTask declaran 413 para cuerpos de más de 16 KiB', async () => {
    const created = await t.app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: t.authHeader(),
      payload: { id: ID, title: 'Hola', description: big },
    });
    expect(created.statusCode).toBe(413);
    expectMatchesContract('createTask', 413, created.json());

    const updated = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${ID}`,
      headers: t.authHeader(),
      payload: { description: big },
    });
    expect(updated.statusCode).toBe(413);
    expectMatchesContract('updateTask', 413, updated.json());
  });

  it('getTask declara 400 para un id que no es UUID', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/tasks/123', headers: t.authHeader() });
    expect(res.statusCode).toBe(400);
    expectMatchesContract('getTask', 400, res.json());
  });
});
