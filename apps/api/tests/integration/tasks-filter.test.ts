import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectMatchesContract } from '../contract/openapi';
import { buildTestApp, type TestApp } from '../support/test-app';

const ANA = 'c1000000-0000-4000-8000-000000000001';
const tid = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('GET /api/v1/tasks con búsqueda y filtros (US4)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await buildTestApp();
  });

  beforeEach(async () => {
    await t.reset();
    await t.app.inject({ method: 'POST', url: '/api/v1/people', headers: t.authHeader(), payload: { id: ANA, name: 'Ana' } });
    const seed = [
      { title: 'Revisión de Diseño', assigneeId: ANA },
      { title: 'Factura de octubre', description: 'Enviar al cliente', assigneeId: ANA },
      { title: 'Comprar café', description: 'Para la REVISION trimestral' },
      { title: 'Descuento del 50% en a_b' },
    ];
    for (const [i, task] of seed.entries()) {
      t.clock.advance(1_000);
      await t.app.inject({ method: 'POST', url: '/api/v1/tasks', headers: t.authHeader(), payload: { id: tid(i + 1), ...task } });
    }
    await t.app.inject({ method: 'PATCH', url: `/api/v1/tasks/${tid(2)}`, headers: t.authHeader(), payload: { status: 'done' } });
  });

  afterAll(async () => {
    await t.close();
  });

  const list = async (query: string) => {
    const res = await t.app.inject({ method: 'GET', url: `/api/v1/tasks${query}`, headers: t.authHeader() });
    return res;
  };
  const titles = async (query: string) =>
    (await list(query)).json().items.map((x: { title: string }) => x.title).sort();

  it('busca sin distinguir mayúsculas ni tildes en título y descripción', async () => {
    expect(await titles('?q=revision')).toEqual(['Comprar café', 'Revisión de Diseño']);
    expect(await titles('?q=CAFÉ')).toEqual(['Comprar café']);
    expect(await titles('?q=%20%20')).toHaveLength(4);
  });

  it('trata %, _ y \\ como texto literal', async () => {
    expect(await titles('?q=50%25')).toEqual(['Descuento del 50% en a_b']);
    expect(await titles('?q=a_b')).toEqual(['Descuento del 50% en a_b']);
    expect(await titles('?q=d_s')).toEqual([]);
    expect(await titles('?q=%25%25')).toEqual([]);
  });

  it('filtra por responsable, sin asignar y estados (repetidos)', async () => {
    expect(await titles(`?assignee=${ANA}`)).toEqual(['Factura de octubre', 'Revisión de Diseño']);
    expect(await titles('?assignee=unassigned')).toEqual(['Comprar café', 'Descuento del 50% en a_b']);
    expect(await titles('?status=done')).toEqual(['Factura de octubre']);
    expect(await titles('?status=pending&status=in_progress')).toHaveLength(3);
  });

  it('combina con AND y los recuentos reflejan el resultado filtrado', async () => {
    const res = await list(`?q=factura&assignee=${ANA}&status=done`);
    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((x: { title: string }) => x.title)).toEqual(['Factura de octubre']);
    expect(res.json().counts).toEqual({ pending: 0, in_progress: 0, done: 1 });
    expectMatchesContract('listTasks', 200, res.json());
  });

  it('rechaza parámetros inválidos con 400', async () => {
    for (const query of ['?status=archived', '?assignee=nadie', `?q=${'x'.repeat(101)}`]) {
      const res = await list(query);
      expect(res.statusCode, query).toBe(400);
      expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expectMatchesContract('listTasks', 400, res.json());
    }
    expect((await list(`?q=${'x'.repeat(101)}`)).json().errors).toEqual([{ field: 'q', rule: 'too_long', limit: 100 }]);
  });
});
