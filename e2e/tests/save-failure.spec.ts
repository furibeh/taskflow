import { expect, test, type Page, type Route } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { apiClient, createTask } from './support/api';
import { openBoard, resetBoardData } from './support/board';

const NETWORK_ERROR = 'No se pudo guardar. Revisa tu conexión.';

test.beforeEach(async ({ baseURL }) => {
  await resetBoardData();
  const api = await apiClient(baseURL!);
  await api.post('/api/v1/people', { data: { id: randomUUID(), name: 'Ana' } });
  await createTask(api, { title: 'Preparar demo' });
  await api.dispose();
});

/** Aborta la primera petición que cumpla `match` y deja pasar las demás; cuenta cuántas llegaron. */
const abortFirst = async (page: Page, method: string, pattern: RegExp) => {
  const seen = { count: 0 };
  await page.route(
    (url) => pattern.test(url.pathname),
    async (route: Route) => {
      if (route.request().method() !== method) return route.continue();
      seen.count += 1;
      return seen.count === 1 ? route.abort() : route.continue();
    },
  );
  return seen;
};

const taskCount = async (baseURL: string) => {
  const api = await apiClient(baseURL);
  const { items } = (await (await api.get('/api/v1/tasks')).json()) as { items: unknown[] };
  await api.dispose();
  return items.length;
};

test('crear: el fallo conserva lo escrito y "Reintentar" crea una sola tarea', async ({ page, baseURL }) => {
  await openBoard(page);
  const seen = await abortFirst(page, 'POST', /^\/api\/v1\/tasks$/);
  await page.getByLabel('Título').fill('Nueva');
  await page.getByRole('button', { name: 'Crear tarea' }).click();
  await expect(page.getByRole('alert')).toContainText(NETWORK_ERROR);
  await expect(page.getByLabel('Título')).toHaveValue('Nueva');

  await page.getByRole('alert').getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('button', { name: 'Nueva', exact: true })).toBeAttached();
  expect(seen.count).toBe(2);
  expect(await taskCount(baseURL!)).toBe(2);
});

test('editar: el fallo no cambia la tarea y conserva lo escrito', async ({ page }) => {
  await openBoard(page);
  await abortFirst(page, 'PATCH', /^\/api\/v1\/tasks\/[^/]+$/);
  await page.getByRole('button', { name: 'Preparar demo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Preparar demo' });
  await dialog.getByRole('button', { name: 'Editar' }).click();
  await dialog.getByLabel('Título').fill('Cambiado');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog.getByRole('alert')).toContainText(NETWORK_ERROR);
  await expect(dialog.getByLabel('Título')).toHaveValue('Cambiado');

  await dialog.getByRole('alert').getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('dialog', { name: 'Cambiado' })).toBeVisible();
});

test('asignar: el fallo deja la tarea sin asignar', async ({ page }) => {
  await openBoard(page);
  await abortFirst(page, 'PATCH', /^\/api\/v1\/tasks\/[^/]+$/);
  await page.getByRole('button', { name: 'Preparar demo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Preparar demo' });
  await dialog.getByRole('combobox', { name: 'Responsable' }).selectOption({ label: 'Ana' });
  await expect(dialog.getByRole('alert')).toContainText(NETWORK_ERROR);
  await expect(dialog.getByRole('combobox', { name: 'Responsable' })).toHaveValue('');
});

test('borrar: el fallo conserva la tarea y "Reintentar" la borra', async ({ page }) => {
  await openBoard(page);
  await abortFirst(page, 'DELETE', /^\/api\/v1\/tasks\/[^/]+$/);
  await page.getByRole('button', { name: 'Preparar demo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Preparar demo' });
  await dialog.getByRole('button', { name: 'Borrar' }).click();
  await dialog.getByRole('button', { name: 'Borrar tarea' }).click();
  await expect(dialog.getByRole('alert')).toContainText(NETWORK_ERROR);

  await dialog.getByRole('alert').getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByText('Tarea borrada')).toBeVisible();
});

test('añadir persona: el fallo conserva el nombre y "Reintentar" la añade una vez', async ({ page }) => {
  await openBoard(page);
  const seen = await abortFirst(page, 'POST', /^\/api\/v1\/people$/);
  await page.getByRole('button', { name: 'Personas' }).click();
  const dialog = page.getByRole('dialog', { name: 'Personas del equipo' });
  await dialog.getByLabel('Nombre').fill('Luis');
  await dialog.getByRole('button', { name: 'Añadir' }).click();
  await expect(dialog.getByRole('alert')).toContainText(NETWORK_ERROR);
  await expect(dialog.getByLabel('Nombre')).toHaveValue('Luis');

  await dialog.getByRole('alert').getByRole('button', { name: 'Reintentar' }).click();
  await expect(dialog.getByText('Luis', { exact: true })).toBeVisible();
  expect(seen.count).toBe(2);
});

test('una respuesta de más de 10 s es un error; reintentar no duplica aunque el servidor ya la guardara', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(40_000);
  await openBoard(page);
  let delayed = false;
  await page.route(
    (url) => url.pathname === '/api/v1/tasks',
    async (route) => {
      if (route.request().method() !== 'POST' || delayed) return route.continue();
      delayed = true;
      // El servidor guarda la tarea, pero la respuesta llega tarde: el cliente ya ha abandonado.
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 10_500));
      await route.fulfill({ response }).catch(() => {});
    },
  );

  await page.getByLabel('Título').fill('Lenta');
  await page.getByRole('button', { name: 'Crear tarea' }).click();
  await expect(page.getByRole('button', { name: 'Guardando…' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(NETWORK_ERROR, { timeout: 12_000 });

  await page.getByRole('alert').getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('button', { name: 'Lenta', exact: true })).toBeAttached();
  expect(await taskCount(baseURL!)).toBe(2);
});
