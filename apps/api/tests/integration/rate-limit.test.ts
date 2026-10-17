import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/http/app';
import { buildTestApp, type TestApp } from '../support/test-app';
import { FakeClockForApi } from '../support/fake-clock';
import { createTestDb } from '../support/test-db';
import { expectMatchesContract } from '../contract/openapi';

const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('límites de peticiones (D5)', () => {
  // Se reutiliza la preparación del tablero; la app con límites bajos comparte la base de datos.
  let t: TestApp;
  const db = createTestDb();

  beforeAll(async () => {
    t = await buildTestApp();
  });

  beforeEach(async () => {
    await t.reset();
  });

  afterAll(async () => {
    await t.close();
    await db.destroy();
  });

  const limitedApp = async (limits: { global: number; writes: number; unauthorized: number }) => {
    const app = await buildApp({ db, clock: new FakeClockForApi(), rateLimits: limits });
    await app.ready();
    return app;
  };

  it('supera el límite global → 429 RATE_LIMITED con Retry-After', async () => {
    const app = await limitedApp({ global: 3, writes: 100, unauthorized: 100 });
    try {
      const statuses: number[] = [];
      let last;
      for (let i = 0; i < 4; i++) {
        last = await app.inject({ method: 'GET', url: '/api/v1/tasks', headers: t.authHeader() });
        statuses.push(last.statusCode);
      }
      expect(statuses).toEqual([200, 200, 200, 429]);
      expect(last!.headers['retry-after']).toBeDefined();
      expect(last!.headers['content-type']).toContain('application/problem+json');
      expect(last!.json()).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
      expectMatchesContract('listTasks', 429, last!.json());
    } finally {
      await app.close();
    }
  });

  it('las escrituras tienen su propio límite, más estricto', async () => {
    const app = await limitedApp({ global: 100, writes: 2, unauthorized: 100 });
    try {
      const post = (n: number) =>
        app.inject({
          method: 'POST',
          url: '/api/v1/tasks',
          headers: t.authHeader(),
          payload: { id: id(n), title: `Tarea ${n}` },
        });
      expect((await post(1)).statusCode).toBe(201);
      expect((await post(2)).statusCode).toBe(201);
      expect((await post(3)).statusCode).toBe(429);
      // Las lecturas siguen permitidas.
      expect((await app.inject({ method: 'GET', url: '/api/v1/tasks', headers: t.authHeader() })).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('demasiados 401 desde una IP bloquean temporalmente esa IP', async () => {
    const app = await limitedApp({ global: 100, writes: 100, unauthorized: 2 });
    try {
      const bad = () =>
        app.inject({ method: 'GET', url: '/api/v1/board', headers: { authorization: 'Bearer incorrecto' } });
      expect((await bad()).statusCode).toBe(401);
      expect((await bad()).statusCode).toBe(401);
      expect((await bad()).statusCode).toBe(429);
      // Ni siquiera un código válido pasa mientras dura el bloqueo (frena la fuerza bruta).
      const good = await app.inject({ method: 'GET', url: '/api/v1/board', headers: t.authHeader() });
      expect(good.statusCode).toBe(429);
    } finally {
      await app.close();
    }
  });
});
