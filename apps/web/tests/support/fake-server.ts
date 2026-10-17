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

    if (url.pathname === '/api/v1/tasks' && method === 'GET') {
      const counts = { pending: 0, in_progress: 0, done: 0 };
      tasks.forEach((t) => (counts[t.status] += 1));
      return json(200, { items: [...tasks].reverse(), counts });
    }
    if (url.pathname === '/api/v1/tasks' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { id: string; title: string; description?: string };
      const existing = tasks.find((t) => t.id === body.id);
      if (existing) return json(200, existing);
      clock += 1000;
      const now = new Date(clock).toISOString();
      const task: FakeTask = {
        id: body.id,
        title: body.title.trim(),
        description: (body.description ?? '').trim(),
        status: 'pending',
        assignee: null,
        createdAt: now,
        updatedAt: now,
      };
      tasks.push(task);
      return json(201, task);
    }
    const match = /^\/api\/v1\/tasks\/([^/]+)$/.exec(url.pathname);
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
    postBodies(): Array<Record<string, unknown>> {
      return fetchImpl.mock.calls
        .filter(([, init]) => init?.method === 'POST')
        .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
    },
  };
};

export type FakeServer = ReturnType<typeof createFakeServer>;
