import type { BoardRepository } from '@taskflow/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/http/app';
import { KyselyBoardRepository } from '../../src/persistence/repositories/board-repository';
import { FakeClockForApi } from '../support/fake-clock';
import { buildTestApp, type TestApp } from '../support/test-app';

/** Gestión del tablero abierto: renombrar (US3) y borrar (US4). */
describe('gestionar el tablero', () => {
  let t: TestApp;
  let codeB: string;

  beforeAll(async () => {
    t = await buildTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await t.reset();
    const created = await t.app.inject({
      method: 'POST',
      url: '/api/v1/boards',
      payload: { id: 'b0000000-0000-4000-8000-00000000000b', name: 'Equipo B' },
    });
    codeB = created.json().accessCode;
  });

  const rename = (payload: object, headers = t.authHeader()) =>
    t.app.inject({ method: 'PATCH', url: '/api/v1/board', headers, payload });
  const boardName = async (code: string) =>
    (await t.app.inject({ method: 'GET', url: '/api/v1/board', headers: { authorization: `Bearer ${code}` } })).json()
      .name;

  describe('renombrar (US3, FR-114)', () => {
    it('cambia el nombre normalizado y devuelve el tablero', async () => {
      t.clock.advance(60_000);
      const res = await rename({ name: '  Diseño y UX ' });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: t.boardId, name: 'Diseño y UX', taskCount: 0, personCount: 0 });
      expect(await boardName(t.accessCode)).toBe('Diseño y UX');
      const row = await t.db.selectFrom('board').select('updated_at').where('id', '=', t.boardId).executeTakeFirstOrThrow();
      expect(row.updated_at).toEqual(t.clock.now());
    });

    it.each([
      ['vacío', { name: '   ' }, { field: 'name', rule: 'too_short', limit: 1 }],
      ['de 61 caracteres', { name: 'a'.repeat(61) }, { field: 'name', rule: 'too_long', limit: 60 }],
    ])('rechaza un nombre %s sin cambiar nada', async (_label, payload, issue) => {
      const res = await rename(payload);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR', errors: [issue] });
      expect(await boardName(t.accessCode)).toBe('Mi tablero');
    });

    it('rechaza campos extra', async () => {
      const res = await rename({ name: 'Otro', id: t.boardId });
      expect(res.statusCode).toBe(400);
      expect(await boardName(t.accessCode)).toBe('Mi tablero');
    });

    it('no cambia el nombre de otro tablero', async () => {
      expect((await rename({ name: 'Diseño y UX' })).statusCode).toBe(200);
      expect(await boardName(codeB)).toBe('Equipo B');
    });

    it('con un código regenerado responde 401 INVALID_LINK', async () => {
      const old = t.accessCode;
      await t.app.inject({ method: 'POST', url: '/api/v1/board/access-code/regenerate', headers: t.authHeader() });
      const res = await rename({ name: 'Diseño' }, { authorization: `Bearer ${old}` });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('INVALID_LINK');
    });

    it('si el tablero se borra entre la autenticación y la escritura responde 401 INVALID_LINK', async () => {
      // Repositorio que borra el tablero justo antes de escribir: simula un borrado concurrente.
      const real = new KyselyBoardRepository(t.db);
      const racing: BoardRepository = Object.assign(Object.create(real) as BoardRepository, {
        rename: async (id: string, name: string, updatedAt: Date) => {
          await real.delete(id);
          return real.rename(id, name, updatedAt);
        },
      });
      const app = await buildApp({ db: t.db, clock: new FakeClockForApi(), rateLimits: null, boards: racing });
      await app.ready();
      try {
        const res = await app.inject({ method: 'PATCH', url: '/api/v1/board', headers: t.authHeader(), payload: { name: 'X' } });
        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({ code: 'INVALID_LINK', title: 'Enlace no válido' });
      } finally {
        await app.close();
      }
    });
  });

  describe('borrar (US4, FR-115–FR-117)', () => {
    const TASK = 'f0000000-0000-4000-8000-0000000000a1';
    const DELETED_TASK = 'f0000000-0000-4000-8000-0000000000a2';
    const PERSON = 'c0000000-0000-4000-8000-0000000000a1';

    const call = (method: 'GET' | 'POST' | 'DELETE', url: string, code: string, payload?: object) =>
      t.app.inject({ method, url, headers: { authorization: `Bearer ${code}` }, ...(payload ? { payload } : {}) });

    beforeEach(async () => {
      const code = t.accessCode;
      await call('POST', '/api/v1/people', code, { id: PERSON, name: 'Ana' });
      await call('POST', '/api/v1/tasks', code, { id: TASK, title: 'Una', assigneeId: PERSON });
      await call('POST', '/api/v1/tasks', code, { id: DELETED_TASK, title: 'Borrada' });
      await call('DELETE', `/api/v1/tasks/${DELETED_TASK}`, code);
      await call('POST', '/api/v1/tasks', codeB, { id: 'f0000000-0000-4000-8000-0000000000b1', title: 'De B' });
    });

    it('responde 204 y después el código da el mismo 401 que un código inválido', async () => {
      const res = await call('DELETE', '/api/v1/board', t.accessCode);
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');

      const invalid = (await call('GET', '/api/v1/board', 'codigo-inventado')).body;
      for (const after of [
        await call('GET', '/api/v1/board', t.accessCode),
        await call('GET', '/api/v1/tasks', t.accessCode),
        await call('POST', '/api/v1/tasks', t.accessCode, { id: 'f0000000-0000-4000-8000-0000000000a3', title: 'X' }),
        await call('GET', '/api/v1/people', t.accessCode),
        await call('DELETE', '/api/v1/board', t.accessCode),
      ]) {
        expect(after.statusCode).toBe(401);
        expect(after.body).toBe(invalid);
      }
    });

    it('borra todas sus tareas (también las pendientes de purga) y personas, y nada de otro tablero', async () => {
      await call('DELETE', '/api/v1/board', t.accessCode);

      expect(await t.db.selectFrom('task').select('id').where('board_id', '=', t.boardId).execute()).toEqual([]);
      expect(await t.db.selectFrom('person').select('id').where('board_id', '=', t.boardId).execute()).toEqual([]);
      const b = await call('GET', '/api/v1/board', codeB);
      expect(b.statusCode).toBe(200);
      expect(b.json()).toMatchObject({ name: 'Equipo B', taskCount: 1 });
    });

    it('si otra persona ya lo borró entre la autenticación y el borrado, responde 401 INVALID_LINK', async () => {
      const real = new KyselyBoardRepository(t.db);
      const racing: BoardRepository = Object.assign(Object.create(real) as BoardRepository, {
        delete: async (id: string) => {
          await real.delete(id);
          return real.delete(id);
        },
      });
      const app = await buildApp({ db: t.db, clock: new FakeClockForApi(), rateLimits: null, boards: racing });
      await app.ready();
      try {
        const res = await app.inject({ method: 'DELETE', url: '/api/v1/board', headers: t.authHeader() });
        expect(res.statusCode).toBe(401);
        expect(res.json().code).toBe('INVALID_LINK');
      } finally {
        await app.close();
      }
    });

    it('una escritura en vuelo sobre un tablero ya borrado (FK de board_id) responde 401 INVALID_LINK', async () => {
      const app = await buildApp({ db: t.db, clock: new FakeClockForApi(), rateLimits: null });
      // Error de PostgreSQL tal como lo lanza pg al insertar con un board_id que ya no existe.
      const fkError = (constraint: string) => Object.assign(new Error('violates foreign key'), { code: '23503', constraint });
      app.get('/api/test/fk/:constraint', async (request) => {
        throw fkError((request.params as { constraint: string }).constraint);
      });
      await app.ready();
      try {
        for (const constraint of ['task_board_id_fkey', 'person_board_id_fkey']) {
          const res = await app.inject({ method: 'GET', url: `/api/test/fk/${constraint}` });
          expect(res.statusCode).toBe(401);
          expect(res.json().code).toBe('INVALID_LINK');
        }
        // Otras claves foráneas no son un tablero borrado: siguen siendo un error interno.
        const other = await app.inject({ method: 'GET', url: '/api/test/fk/task_assignee_id_fkey' });
        expect(other.statusCode).toBe(500);
        expect(other.body).not.toContain('task_assignee_id_fkey');
      } finally {
        await app.close();
      }
    });
  });
});
