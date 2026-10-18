import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/http/app';
import { FakeClockForApi } from '../support/fake-clock';
import { buildTestApp, type TestApp } from '../support/test-app';
import { expectMatchesContract } from './openapi';

/** Comprueba el estado real además del cuerpo (un 404 genérico también cumple Problem). */
const expectResponse = (operationId: string, status: number, res: { statusCode: number; json(): unknown }) => {
  expect(res.statusCode).toBe(status);
  expectMatchesContract(operationId, status, res.json());
};

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
    expectResponse('getBoard', 200, await t.app.inject({ method: 'GET', url: '/api/v1/board', headers: t.authHeader() }));
    expectResponse(
      'getBoard',
      401,
      await t.app.inject({ method: 'GET', url: '/api/v1/board', headers: { authorization: 'Bearer x' } }),
    );
  });

  it('createBoard 201, 200, 400 y 409; getPublicConfig 200', async () => {
    const post = (payload: object) => t.app.inject({ method: 'POST', url: '/api/v1/boards', payload });
    const id = 'e0000000-0000-4000-8000-000000000001';

    expectResponse('createBoard', 201, await post({ id, name: 'Equipo' }));
    expectResponse('createBoard', 200, await post({ id, name: 'Equipo' }));
    expectResponse('createBoard', 400, await post({ id, name: '' }));
    expectResponse('createBoard', 409, await post({ id, name: 'Otro' }));

    expectResponse('getPublicConfig', 200, await t.app.inject({ method: 'GET', url: '/api/v1/public-config' }));
  });

  it('createBoard 403 y 429', async () => {
    const appWith = async (enabled: boolean) => {
      const app = await buildApp({
        db: t.db,
        clock: new FakeClockForApi(),
        rateLimits: null,
        boardCreation: { enabled, perHour: 1 },
      });
      await app.ready();
      return app;
    };
    const post = (app: Awaited<ReturnType<typeof appWith>>, n: number) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/boards',
        payload: { id: `e0000000-0000-4000-8000-00000000001${n}`, name: 'Equipo' },
      });

    const disabled = await appWith(false);
    const limited = await appWith(true);
    try {
      expectResponse('createBoard', 403, await post(disabled, 1));
      await post(limited, 2);
      expectResponse('createBoard', 429, await post(limited, 3));
    } finally {
      await disabled.close();
      await limited.close();
    }
  });

  it('renameBoard 200, 400 y 401', async () => {
    const patch = (payload: object, headers: Record<string, string> = t.authHeader()) =>
      t.app.inject({ method: 'PATCH', url: '/api/v1/board', headers, payload });

    expectResponse('renameBoard', 200, await patch({ name: 'Diseño y UX' }));
    expectResponse('renameBoard', 400, await patch({ name: '' }));
    expectResponse('renameBoard', 401, await patch({ name: 'Diseño' }, { authorization: 'Bearer x' }));
  });

  it('deleteBoard 204 y 401', async () => {
    const del = (headers: Record<string, string>) => t.app.inject({ method: 'DELETE', url: '/api/v1/board', headers });
    const res = await del(t.authHeader());
    expect(res.statusCode).toBe(204);
    expectMatchesContract('deleteBoard', 204, res.body);
    expectResponse('deleteBoard', 401, await del(t.authHeader()));
  });
});
