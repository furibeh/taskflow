import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { apiClient, createTask } from './support/api';
import { openBoard, resetBoardData } from './support/board';

test.beforeEach(async ({ baseURL }) => {
  await resetBoardData();
  const api = await apiClient(baseURL!);
  const ana = randomUUID();
  await api.post('/api/v1/people', { data: { id: ana, name: 'Ana' } });
  await createTask(api, { title: 'Revisión de Diseño', assigneeId: ana });
  await createTask(api, { title: 'Factura de octubre' });
  await api.dispose();
});

const visibleTitles = (page: import('@playwright/test').Page) =>
  page.locator('article.card .card__title').allTextContents();

test('US4: búsqueda sin tildes, filtros combinados, sin resultados y persistencia', async ({ page }) => {
  await openBoard(page);
  const search = page.getByRole('searchbox', { name: 'Buscar tareas' });

  await search.fill('REVISION');
  await expect.poll(() => visibleTitles(page)).toEqual(['Revisión de Diseño']);

  await search.fill('');
  await page.getByRole('combobox', { name: 'Filtrar por responsable' }).selectOption('unassigned');
  await expect.poll(() => visibleTitles(page)).toEqual(['Factura de octubre']);

  await search.fill('zzz');
  await expect(page.locator('.no-results__message')).toHaveText('No hay tareas que coincidan con «zzz»');

  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Buscar tareas' })).toHaveValue('zzz');
  await expect(page.locator('.no-results__message')).toHaveText('No hay tareas que coincidan con «zzz»');

  await page.getByRole('button', { name: 'Limpiar búsqueda y filtros' }).click();
  await expect.poll(async () => (await visibleTitles(page)).sort()).toEqual(['Factura de octubre', 'Revisión de Diseño']);
});
