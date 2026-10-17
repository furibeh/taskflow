import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { buildTestApp, type TestApp } from '../support/test-app';
import { expectMatchesContract } from './openapi';

describe('contrato del tablero (feature 002)', () => {
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

  it('getBoard 200 (con nombre y recuentos) y 401', async () => {
    await t.app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: t.authHeader(),
      payload: { id: 'a0000000-0000-4000-8000-000000000001', title: 'Tarea' },
    });
    const ok = await t.app.inject({ method: 'GET', url: '/api/v1/board', headers: t.authHeader() });
    expectMatchesContract('getBoard', 200, ok.json());

    const invalid = await t.app.inject({ method: 'GET', url: '/api/v1/board', headers: { authorization: 'Bearer x' } });
    expectMatchesContract('getBoard', 401, invalid.json());
  });
});
