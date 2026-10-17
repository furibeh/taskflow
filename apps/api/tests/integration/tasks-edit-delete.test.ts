import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectMatchesContract } from '../contract/openapi';
import { buildTestApp, type TestApp } from '../support/test-app';

const ID = 'a0000000-0000-4000-8000-000000000001';

describe('editar, borrar y deshacer por la API (US5)', () => {
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
      payload: { id: ID, title: 'Preparar demo', description: 'Slides' },
    });
  });

  afterAll(async () => {
    await t.close();
  });

  const call = (method: 'PATCH' | 'DELETE' | 'POST' | 'GET', url: string, payload?: object) =>
    t.app.inject({ method, url, headers: t.authHeader(), ...(payload ? { payload } : {}) });
  const rows = async () =>
    Number((await t.db.selectFrom('task').select(t.db.fn.countAll().as('n')).executeTakeFirstOrThrow()).n);

  it('PATCH edita título y descripción con las reglas de creación', async () => {
    const ok = await call('PATCH', `/api/v1/tasks/${ID}`, { title: 'Demo final', description: 'Con datos' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ title: 'Demo final', description: 'Con datos', status: 'pending' });

    const bad = await call('PATCH', `/api/v1/tasks/${ID}`, { title: '  ' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().errors).toEqual([{ field: 'title', rule: 'too_short', limit: 1 }]);
  });

  it('DELETE oculta la tarea y devuelve undoUntil; después GET y PATCH dan 404', async () => {
    const res = await call('DELETE', `/api/v1/tasks/${ID}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: ID, undoUntil: new Date(t.clock.now().getTime() + 15_000).toISOString() });
    expectMatchesContract('deleteTask', 200, res.json());

    expect((await call('GET', `/api/v1/tasks/${ID}`)).statusCode).toBe(404);
    expect((await call('PATCH', `/api/v1/tasks/${ID}`, { status: 'done' })).statusCode).toBe(404);
    expect((await call('GET', '/api/v1/tasks')).json().items).toEqual([]);
    const again = await call('DELETE', `/api/v1/tasks/${ID}`);
    expect(again.statusCode).toBe(404);
    expectMatchesContract('deleteTask', 404, again.json());
  });

  it('restore: 200 a los 14 s, 410 a los 16 s (reloj controlable)', async () => {
    await call('DELETE', `/api/v1/tasks/${ID}`);
    t.clock.advance(14_000);
    const restored = await call('POST', `/api/v1/tasks/${ID}/restore`);
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ id: ID, title: 'Preparar demo', description: 'Slides' });
    expectMatchesContract('restoreTask', 200, restored.json());

    await call('DELETE', `/api/v1/tasks/${ID}`);
    t.clock.advance(16_000);
    const expired = await call('POST', `/api/v1/tasks/${ID}/restore`);
    expect(expired.statusCode).toBe(410);
    expect(expired.json()).toMatchObject({ code: 'UNDO_EXPIRED' });
    expectMatchesContract('restoreTask', 410, expired.json());
  });

  it('restore de una tarea no borrada devuelve 404', async () => {
    const res = await call('POST', `/api/v1/tasks/${ID}/restore`);
    expect(res.statusCode).toBe(404);
    expectMatchesContract('restoreTask', 404, res.json());
  });

  it('la purga elimina la fila tras 16 s y no antes', async () => {
    await call('DELETE', `/api/v1/tasks/${ID}`);
    t.clock.advance(10_000);
    await t.purge();
    expect(await rows()).toBe(1);
    t.clock.advance(6_000);
    await t.purge();
    expect(await rows()).toBe(0);
  });
});
