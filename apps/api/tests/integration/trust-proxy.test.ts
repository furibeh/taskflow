import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/http/app';
import { FakeClockForApi } from '../support/fake-clock';
import { buildTestApp, type TestApp } from '../support/test-app';
import { createTestDb } from '../support/test-db';

const PROXY = '172.28.0.10';

describe('IP real del cliente detrás del proxy (T135, plan D11)', () => {
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

  const limitedApp = async (trustProxy: readonly string[]) => {
    const app = await buildApp({
      db,
      clock: new FakeClockForApi(),
      rateLimits: { global: 100, writes: 100, unauthorized: 2 },
      trustProxy,
    });
    await app.ready();
    return app;
  };

  const boardRequest = (
    app: Awaited<ReturnType<typeof limitedApp>>,
    remoteAddress: string,
    forwardedFor: string,
    authorization: string,
  ) =>
    app.inject({
      method: 'GET',
      url: '/api/v1/board',
      remoteAddress,
      headers: { authorization, 'x-forwarded-for': forwardedFor },
    });

  it('20 fallos de un cliente detrás del proxy de confianza no bloquean a otro cliente', async () => {
    const app = await limitedApp([PROXY]);
    try {
      for (let i = 0; i < 3; i++) await boardRequest(app, PROXY, '203.0.113.1', 'Bearer incorrecto');
      expect((await boardRequest(app, PROXY, '203.0.113.1', 'Bearer incorrecto')).statusCode).toBe(429);

      const other = await boardRequest(app, PROXY, '198.51.100.7', `Bearer ${t.accessCode}`);
      expect(other.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('X-Forwarded-For se ignora si la conexión no viene de un proxy de confianza (anti suplantación)', async () => {
    const app = await limitedApp([PROXY]);
    try {
      // Un atacante conectado directamente cambia de IP falsa en cada intento: sigue contando como él.
      for (let i = 0; i < 2; i++) await boardRequest(app, '10.9.9.9', `203.0.113.${i}`, 'Bearer incorrecto');
      expect((await boardRequest(app, '10.9.9.9', '203.0.113.99', 'Bearer incorrecto')).statusCode).toBe(429);
    } finally {
      await app.close();
    }
  });

  it('sin proxies de confianza se usa la IP de la conexión, como antes', async () => {
    const app = await limitedApp([]);
    try {
      for (let i = 0; i < 2; i++) await boardRequest(app, PROXY, `203.0.113.${i}`, 'Bearer incorrecto');
      expect((await boardRequest(app, PROXY, '198.51.100.7', `Bearer ${t.accessCode}`)).statusCode).toBe(429);
    } finally {
      await app.close();
    }
  });
});
