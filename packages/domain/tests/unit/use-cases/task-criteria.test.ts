import { beforeEach, describe, expect, it } from 'vitest';
import { parseTaskCriteria } from '../../../src/tasks/task-criteria';
import { createTask, listTasks, updateTask } from '../../../src/use-cases/tasks';
import { FakeClock, InMemoryPeople, InMemoryTaskRepository } from '../../support/in-memory';

const BOARD = 'b0000000-0000-4000-8000-000000000001';
const tid = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('parseTaskCriteria (US4)', () => {
  it('sin parámetros no filtra', () => {
    expect(parseTaskCriteria({})).toEqual({ ok: true, value: {} });
  });

  it('acepta responsable concreto o "unassigned" y uno o varios estados', () => {
    expect(parseTaskCriteria({ assignee: 'unassigned', statuses: ['pending', 'done'] })).toEqual({
      ok: true,
      value: { assignee: 'unassigned', statuses: ['pending', 'done'] },
    });
  });

  it('recorta el texto; vacío no filtra; más de 100 caracteres es inválido', () => {
    expect(parseTaskCriteria({ q: '  demo ' })).toEqual({ ok: true, value: { text: 'demo' } });
    expect(parseTaskCriteria({ q: '   ' })).toEqual({ ok: true, value: {} });
    expect(parseTaskCriteria({ q: 'x'.repeat(101) })).toEqual({
      ok: false,
      error: { code: 'VALIDATION_ERROR', issues: [{ field: 'q', rule: 'too_long', limit: 100 }] },
    });
  });

  it('rechaza estados desconocidos', () => {
    expect(parseTaskCriteria({ statuses: ['archived'] })).toEqual({
      ok: false,
      error: { code: 'VALIDATION_ERROR', issues: [{ field: 'status', rule: 'invalid_value' }] },
    });
  });
});

describe('listTasks con criterios (AND)', () => {
  let people: InMemoryPeople;
  let deps: { tasks: InMemoryTaskRepository; people: InMemoryPeople; clock: FakeClock };
  let ana: string;

  beforeEach(async () => {
    people = new InMemoryPeople();
    deps = { tasks: new InMemoryTaskRepository(people), people, clock: new FakeClock() };
    ana = people.add(BOARD, 'Ana');
    const seed = [
      { title: 'Revisión de Diseño', assigneeId: ana },
      { title: 'Factura de octubre', description: 'Enviar al cliente', assigneeId: ana },
      { title: 'Comprar café', description: 'Para la REVISION trimestral' },
      { title: 'Factura pendiente' },
    ];
    for (const [i, t] of seed.entries()) {
      await createTask(deps, BOARD, { id: tid(i + 1), ...t });
      deps.clock.advance(1_000);
    }
    await updateTask(deps, BOARD, tid(2), { status: 'in_progress' });
  });

  const titles = async (raw: Parameters<typeof parseTaskCriteria>[0]) => {
    const criteria = parseTaskCriteria(raw);
    if (!criteria.ok) throw new Error('criterios inválidos');
    return (await listTasks(deps, BOARD, criteria.value)).items.map((t) => t.title).sort();
  };

  it('busca en título y descripción sin distinguir mayúsculas ni tildes', async () => {
    expect(await titles({ q: 'revision' })).toEqual(['Comprar café', 'Revisión de Diseño']);
    expect(await titles({ q: 'CAFE' })).toEqual(['Comprar café']);
  });

  it('filtra por responsable, sin asignar y estados', async () => {
    expect(await titles({ assignee: ana })).toEqual(['Factura de octubre', 'Revisión de Diseño']);
    expect(await titles({ assignee: 'unassigned' })).toEqual(['Comprar café', 'Factura pendiente']);
    expect(await titles({ statuses: ['in_progress'] })).toEqual(['Factura de octubre']);
  });

  it('combina búsqueda, responsable y estado con AND, y los recuentos reflejan el filtro', async () => {
    const criteria = parseTaskCriteria({ q: 'factura', assignee: ana, statuses: ['in_progress', 'pending'] });
    if (!criteria.ok) throw new Error('criterios inválidos');
    const { items, counts } = await listTasks(deps, BOARD, criteria.value);
    expect(items.map((t) => t.title)).toEqual(['Factura de octubre']);
    expect(counts).toEqual({ pending: 0, in_progress: 1, done: 0 });
  });

  it('el texto se busca de forma literal', async () => {
    expect(await titles({ q: 'fact%' })).toEqual([]);
  });
});
