import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../support/test-app';

const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('POST/GET /api/v1/tasks (US1)', () => {
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

  const post = (payload: unknown) =>
    t.app.inject({ method: 'POST', url: '/api/v1/tasks', headers: t.authHeader(), payload: payload as object });

  const countRows = async () =>
    Number((await t.db.selectFrom('task').select(t.db.fn.countAll().as('n')).executeTakeFirstOrThrow()).n);

  it('crea una tarea en Pendiente (201)', async () => {
    const res = await post({ id: id(1), title: '  Preparar demo ', description: 'Slides y datos' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      id: id(1),
      title: 'Preparar demo',
      description: 'Slides y datos',
      status: 'pending',
      assignee: null,
    });
  });

  it('repetir la misma petición devuelve 200 con la misma tarea y una sola fila', async () => {
    const first = await post({ id: id(1), title: 'Preparar demo' });
    const again = await post({ id: id(1), title: 'Preparar demo' });
    expect(first.statusCode).toBe(201);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(first.json());
    expect(await countRows()).toBe(1);
  });

  it('el mismo id con otro título devuelve 409 ID_CONFLICT', async () => {
    await post({ id: id(1), title: 'Preparar demo' });
    const res = await post({ id: id(1), title: 'Otra cosa' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'ID_CONFLICT' });
  });

  it('un título solo con espacios devuelve 400 con el error por campo', async () => {
    const res = await post({ id: id(1), title: '   ' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'title', rule: 'too_short', limit: 1 }],
    });
    expect(await countRows()).toBe(0);
  });

  it('un título de 201 caracteres devuelve too_long con límite 200', async () => {
    const res = await post({ id: id(1), title: 'a'.repeat(201) });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors).toEqual([{ field: 'title', rule: 'too_long', limit: 200 }]);
  });

  it('200 emojis son un título válido', async () => {
    expect((await post({ id: id(1), title: '😀'.repeat(200) })).statusCode).toBe(201);
  });

  it('un campo desconocido devuelve 400 unknown_field', async () => {
    const res = await post({ id: id(1), title: 'Hola', status: 'done' });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors).toEqual([{ field: 'status', rule: 'unknown_field' }]);
  });

  it('sin título devuelve required; un id que no es UUID devuelve invalid_format', async () => {
    const res = await post({ id: 'no-es-uuid' });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors).toEqual(
      expect.arrayContaining([
        { field: 'id', rule: 'invalid_format' },
        { field: 'title', rule: 'required' },
      ]),
    );
  });

  it('un JSON mal formado devuelve 400 VALIDATION_ERROR', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: { ...t.authHeader(), 'content-type': 'application/json' },
      payload: '{"id": ',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('un cuerpo de más de 16 KiB devuelve 413', async () => {
    const res = await post({ id: id(1), title: 'Hola', description: 'x'.repeat(17 * 1024) });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'body', rule: 'too_long', limit: 16384 }],
    });
  });

  it('guarda y devuelve el HTML como texto literal', async () => {
    const title = '<script>alert(1)</script>';
    await post({ id: id(1), title });
    const res = await t.app.inject({ method: 'GET', url: `/api/v1/tasks/${id(1)}`, headers: t.authHeader() });
    expect(res.json().title).toBe(title);
  });

  it('un responsable inexistente devuelve 422 ASSIGNEE_NOT_FOUND', async () => {
    const res = await post({ id: id(1), title: 'Hola', assigneeId: id(99) });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: 'ASSIGNEE_NOT_FOUND' });
  });

  it('GET /api/v1/tasks lista de la más reciente a la más antigua, con recuentos', async () => {
    await post({ id: id(1), title: 'Primera' });
    t.clock.advance(1_000);
    await post({ id: id(2), title: 'Segunda' });

    const res = await t.app.inject({ method: 'GET', url: '/api/v1/tasks', headers: t.authHeader() });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((x: { title: string }) => x.title)).toEqual(['Segunda', 'Primera']);
    expect(res.json().counts).toEqual({ pending: 2, in_progress: 0, done: 0 });
  });

  it('no muestra tareas de otro tablero', async () => {
    await post({ id: id(1), title: 'Mía' });
    const other = await buildTestApp();
    try {
      await other.reset();
      const res = await other.app.inject({ method: 'GET', url: '/api/v1/tasks', headers: other.authHeader() });
      expect(res.json().items).toEqual([]);
    } finally {
      await other.close();
    }
  });

  it('GET /api/v1/tasks/{id} devuelve 404 TASK_NOT_FOUND si no existe; 400 si el id no es UUID', async () => {
    const missing = await t.app.inject({ method: 'GET', url: `/api/v1/tasks/${id(5)}`, headers: t.authHeader() });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: 'TASK_NOT_FOUND' });

    const bad = await t.app.inject({ method: 'GET', url: '/api/v1/tasks/123', headers: t.authHeader() });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().errors).toEqual([{ field: 'taskId', rule: 'invalid_format' }]);
  });

  it('sin código de acceso no se puede crear ni listar', async () => {
    const res = await t.app.inject({ method: 'POST', url: '/api/v1/tasks', payload: { id: id(1), title: 'Hola' } });
    expect(res.statusCode).toBe(401);
    expect(await countRows()).toBe(0);
  });
});
