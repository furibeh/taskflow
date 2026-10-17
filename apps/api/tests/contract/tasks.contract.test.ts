import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
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
