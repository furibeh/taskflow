import { vi } from 'vitest';

interface FakeTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done';
  assignee: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

const json = (status: number, body: unknown, problem = false) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': problem ? 'application/problem+json' : 'application/json' },
  });

/**
 * Servidor falso en memoria para las pruebas de componentes. Implementa el subconjunto del
 * contrato que usa la web; `failNext` y `holdNext` simulan fallos y respuestas lentas.
 */
export const createFakeServer = () => {
  const tasks: FakeTask[] = [];
  const people: Array<{ id: string; name: string }> = [];
  const problem = (status: number, code: string) =>
    json(status, { type: 'about:blank', title: code, status, code }, true);
  const withCount = (p: { id: string; name: string }) => ({
    ...p,
    assignedTaskCount: tasks.filter((t) => t.assignee?.id === p.id).length,
  });
  let clock = Date.parse('2026-10-17T10:00:00.000Z');
  const failures: Array<() => Response | Promise<Response>> = [];
  let hold: Promise<void> | null = null;

  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      if (hold) await hold;
      const failure = failures.shift();
      if (failure) return failure();
    }

    if (url.pathname === '/api/v1/people' && method === 'GET') {
      const items = [...people].sort((x, y) => x.name.localeCompare(y.name, 'es')).map(withCount);
      return json(200, { items });
    }
    if (url.pathname === '/api/v1/people' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { id: string; name: string };
      const name = body.name.trim();
      const existing = people.find((p) => p.id === body.id);
      if (existing) return existing.name === name ? json(200, withCount(existing)) : problem(409, 'ID_CONFLICT');
      if (people.some((p) => p.name.toLowerCase() === name.toLowerCase())) return problem(409, 'PERSON_NAME_TAKEN');
      const person = { id: body.id, name };
      people.push(person);
      return json(201, withCount(person));
    }
    const personMatch = /^\/api\/v1\/people\/([^/]+)$/.exec(url.pathname);
    if (personMatch && method === 'DELETE') {
      const index = people.findIndex((p) => p.id === personMatch[1]);
      if (index < 0) return problem(404, 'PERSON_NOT_FOUND');
      const [removed] = people.splice(index, 1);
      let unassignedTaskCount = 0;
      for (const t of tasks) {
        if (t.assignee?.id === removed!.id) {
          t.assignee = null;
          unassignedTaskCount += 1;
        }
      }
      return json(200, { id: removed!.id, unassignedTaskCount });
    }
    if (url.pathname === '/api/v1/tasks' && method === 'GET') {
      const fold = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      const assignee = url.searchParams.get('assignee');
      const statuses = url.searchParams.getAll('status');
      const q = fold((url.searchParams.get('q') ?? '').trim());
      const visible = [...tasks].reverse().filter(
        (t) =>
          (!assignee || (assignee === 'unassigned' ? t.assignee === null : t.assignee?.id === assignee)) &&
          (statuses.length === 0 || statuses.includes(t.status)) &&
          (!q || fold(t.title).includes(q) || fold(t.description).includes(q)),
      );
      const counts = { pending: 0, in_progress: 0, done: 0 };
      visible.forEach((t) => (counts[t.status] += 1));
      return json(200, { items: visible, counts });
    }
    if (url.pathname === '/api/v1/tasks' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as {
        id: string;
        title: string;
        description?: string;
        assigneeId?: string | null;
      };
      const existing = tasks.find((t) => t.id === body.id);
      if (existing) return json(200, existing);
      const owner = body.assigneeId ? people.find((p) => p.id === body.assigneeId) : null;
      if (body.assigneeId && !owner) return problem(422, 'ASSIGNEE_NOT_FOUND');
      clock += 1000;
      const now = new Date(clock).toISOString();
      const task: FakeTask = {
        id: body.id,
        title: body.title.trim(),
        description: (body.description ?? '').trim(),
        status: 'pending',
        assignee: owner ? { id: owner.id, name: owner.name } : null,
        createdAt: now,
        updatedAt: now,
      };
      tasks.push(task);
      return json(201, task);
    }
    const match = /^\/api\/v1\/tasks\/([^/]+)$/.exec(url.pathname);
    if (match && method === 'PATCH') {
      const task = tasks.find((t) => t.id === match[1]);
      if (!task) {
        return json(404, { type: 'about:blank', title: 'La tarea no existe', status: 404, code: 'TASK_NOT_FOUND' }, true);
      }
      const { assigneeId, ...body } = JSON.parse(String(init?.body)) as Partial<FakeTask> & {
        assigneeId?: string | null;
      };
      if (assigneeId !== undefined) {
        const owner = assigneeId ? people.find((p) => p.id === assigneeId) : null;
        if (assigneeId && !owner) return problem(422, 'ASSIGNEE_NOT_FOUND');
        task.assignee = owner ? { id: owner.id, name: owner.name } : null;
      }
      clock += 1000;
      Object.assign(task, body, { updatedAt: new Date(clock).toISOString() });
      return json(200, task);
    }
    if (match && method === 'GET') {
      const task = tasks.find((t) => t.id === match[1]);
      return task
        ? json(200, task)
        : json(404, { type: 'about:blank', title: 'La tarea no existe', status: 404, code: 'TASK_NOT_FOUND' }, true);
    }
    return json(404, { type: 'about:blank', title: 'No', status: 404, code: 'NOT_FOUND' }, true);
  });

  return {
    fetchImpl,
    tasks,
    people,
    addPerson(name: string): string {
      const id = crypto.randomUUID();
      people.push({ id, name });
      return id;
    },
    addTask(partial: Partial<FakeTask> & { title: string }) {
      clock += 1000;
      const now = new Date(clock).toISOString();
      tasks.push({
        id: crypto.randomUUID(),
        description: '',
        status: 'pending',
        assignee: null,
        createdAt: now,
        updatedAt: now,
        ...partial,
      });
    },
    /** La siguiente escritura falla con un error de red. */
    failNextWithNetworkError() {
      failures.push(() => Promise.reject(new TypeError('Failed to fetch')));
    },
    /** Retiene las escrituras hasta llamar a la función devuelta. */
    holdWrites(): () => void {
      let release!: () => void;
      hold = new Promise((resolve) => (release = resolve));
      return () => {
        hold = null;
        release();
      };
    },
    requests(method: string): Array<{ url: string; body: Record<string, unknown> }> {
      return fetchImpl.mock.calls
        .filter(([, init]) => (init?.method ?? 'GET') === method)
        .map(([input, init]) => ({
          url: String(input),
          body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
        }));
    },
        postBodies(): Array<Record<string, unknown>> {
      return fetchImpl.mock.calls
        .filter(([, init]) => init?.method === 'POST')
        .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
    },
  };
};

export type FakeServer = ReturnType<typeof createFakeServer>;
