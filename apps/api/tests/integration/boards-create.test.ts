import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/http/app';
import { FakeClockForApi } from '../support/fake-clock';
import { buildTestApp, type TestApp } from '../support/test-app';
import { createTestDb, truncateAll } from '../support/test-db';

const ID = 'e0000000-0000-4000-8000-000000000001';
const CODE = /^[A-Za-z0-9_-]{43}$/;

const id = (n: number) => `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('crear un tablero desde la web (US1, FR-102–FR-107)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await buildTestApp({ captureLogs: true });
  });

  beforeEach(async () => {
    await t.reset();
    t.logs.length = 0;
  });

  afterAll(async () => {
    await t.close();
  });

  const create = (payload: object, headers: Record<string, string> = {}) =>
    t.app.inject({ method: 'POST', url: '/api/v1/boards', payload, headers });

  it('crea el tablero sin autenticación y devuelve el código una sola vez', async () => {
    const res = await create({ id: ID, name: '  Equipo Diseño ' });

    expect(res.statusCode).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    const body = res.json();
    expect(body).toEqual({ id: ID, name: 'Equipo Diseño', accessCode: expect.stringMatching(CODE) });

    const board = await t.app.inject({
      method: 'GET',
      url: '/api/v1/board',
      headers: { authorization: `Bearer ${body.accessCode}` },
    });
    expect(board.json()).toMatchObject({ id: ID, name: 'Equipo Diseño', taskCount: 0, personCount: 0 });

    // El código nunca aparece en los logs (D13).
    expect(t.logs.join('\n')).not.toContain(body.accessCode);
  });

  it('una repetición con el mismo id y nombre responde 200 sin código y no crea otro tablero', async () => {
    const first = await create({ id: ID, name: 'Equipo Diseño' });
    const replay = await create({ id: ID, name: ' Equipo Diseño' });

    expect(replay.statusCode).toBe(200);
    expect(replay.headers['cache-control']).toBe('no-store');
    expect(replay.json()).toEqual({ id: ID, name: 'Equipo Diseño' });
    expect(replay.body).not.toContain(first.json().accessCode);
    expect(await t.db.selectFrom('board').select('id').where('id', '=', ID).execute()).toHaveLength(1);
  });

  it('el mismo id con otro nombre es 409 ID_CONFLICT', async () => {
    await create({ id: ID, name: 'Equipo Diseño' });
    const res = await create({ id: ID, name: 'Otro' });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('ID_CONFLICT');
  });

  it.each([
    ['vacío', { id: ID, name: '   ' }, { field: 'name', rule: 'too_short', limit: 1 }],
    ['de 61 caracteres', { id: ID, name: 'a'.repeat(61) }, { field: 'name', rule: 'too_long', limit: 60 }],
  ])('rechaza un nombre %s sin crear nada', async (_label, payload, issue) => {
    const res = await create(payload);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR', errors: [issue] });
    expect(await t.db.selectFrom('board').select('id').where('id', '=', ID).execute()).toEqual([]);
  });

  it('rechaza campos extra, como un código propuesto por el cliente', async () => {
    const res = await create({ id: ID, name: 'Equipo', accessCode: 'a'.repeat(43) });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('ignora un Authorization válido: crea un tablero nuevo, no toca el actual', async () => {
    const res = await create({ id: ID, name: 'Otro equipo' }, t.authHeader());
    expect(res.statusCode).toBe(201);
    const current = await t.app.inject({ method: 'GET', url: '/api/v1/board', headers: t.authHeader() });
    expect(current.json().name).toBe('Mi tablero');
  });

  it('public-config indica que la creación está activada, sin autenticación', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/public-config' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ boardCreationEnabled: true });
  });
});

describe('interruptor y límite de creación (FR-105, FR-106, D12)', () => {
  const db = createTestDb();
  const PROXY = '172.28.0.10';

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await truncateAll(db);
  });

  const appWith = async (boardCreation: { enabled: boolean; perHour: number }) => {
    const app = await buildApp({ db, clock: new FakeClockForApi(), rateLimits: null, trustProxy: [PROXY], boardCreation });
    await app.ready();
    return app;
  };

  const create = (app: Awaited<ReturnType<typeof appWith>>, payload: object, client = '203.0.113.1') =>
    app.inject({
      method: 'POST',
      url: '/api/v1/boards',
      payload,
      remoteAddress: PROXY,
      headers: { 'x-forwarded-for': client },
    });

  it('desactivada: 403 BOARD_CREATION_DISABLED sin crear nada y public-config lo indica', async () => {
    const app = await appWith({ enabled: false, perHour: 10 });
    try {
      const res = await create(app, { id: ID, name: 'Equipo' });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('BOARD_CREATION_DISABLED');
      expect(await db.selectFrom('board').select('id').execute()).toEqual([]);

      const config = await app.inject({ method: 'GET', url: '/api/v1/public-config' });
      expect(config.json()).toEqual({ boardCreationEnabled: false });
    } finally {
      await app.close();
    }
  });

  it('solo cuentan las creaciones nuevas; al superar el límite, 429 BOARD_CREATION_LIMITED con Retry-After', async () => {
    const app = await appWith({ enabled: true, perHour: 2 });
    try {
      expect((await create(app, { id: id(1), name: 'Uno' })).statusCode).toBe(201);
      expect((await create(app, { id: id(1), name: 'Uno' })).statusCode).toBe(200);
      expect((await create(app, { id: id(9), name: '   ' })).statusCode).toBe(400);
      expect((await create(app, { id: id(2), name: 'Dos' })).statusCode).toBe(201);

      const blocked = await create(app, { id: id(3), name: 'Tres' });
      expect(blocked.statusCode).toBe(429);
      expect(blocked.json().code).toBe('BOARD_CREATION_LIMITED');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      expect(await db.selectFrom('board').select('id').where('id', '=', id(3)).execute()).toEqual([]);

      // Otro cliente detrás del mismo proxy tiene su propio límite (IP real, D11).
      expect((await create(app, { id: id(4), name: 'Cuatro' }, '198.51.100.7')).statusCode).toBe(201);
    } finally {
      await app.close();
    }
  });
});
