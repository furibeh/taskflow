import { request, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { accessCode } from './board';

/** Cliente de la API para preparar datos en los E2E (a través del mismo proxy que la web). */
export const apiClient = async (baseURL: string): Promise<APIRequestContext> =>
  request.newContext({ baseURL, extraHTTPHeaders: { authorization: `Bearer ${accessCode()}` } });

export const createTask = async (
  api: APIRequestContext,
  data: { title: string; description?: string; assigneeId?: string | null },
): Promise<{ id: string }> => {
  const res = await api.post('/api/v1/tasks', { data: { id: randomUUID(), ...data } });
  if (!res.ok()) throw new Error(`No se pudo crear la tarea: ${res.status()}`);
  return (await res.json()) as { id: string };
};
