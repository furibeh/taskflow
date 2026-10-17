import { expect, test } from '@playwright/test';
import { apiClient, createTask } from './support/api';
import { openBoard, resetBoardData } from './support/board';

const BUDGET_MS = 1_000;

test('con 200 tareas, cargar, buscar, filtrar y cambiar estado tardan menos de 1 s (SC-003)', async ({
  page,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-320', 'Se mide una vez, en escritorio');
  test.setTimeout(120_000);
  await resetBoardData();
  const api = await apiClient(baseURL!);
  for (let batch = 0; batch < 20; batch++) {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => createTask(api, { title: `Tarea ${batch * 10 + i + 1}` })),
    );
  }
  await api.dispose();

  const cards = page.locator('article.card');
  await openBoard(page);
  await expect(cards).toHaveCount(200);

  // Carga en caliente (el servidor de desarrollo ya ha compilado los módulos).
  let start = Date.now();
  await page.reload();
  await expect(cards).toHaveCount(200);
  const load = Date.now() - start;

  start = Date.now();
  await page.getByRole('searchbox', { name: 'Buscar tareas' }).fill('Tarea 137');
  await expect(cards).toHaveCount(1);
  const search = Date.now() - start;

  start = Date.now();
  await page.getByRole('searchbox', { name: 'Buscar tareas' }).fill('');
  await page.getByRole('checkbox', { name: 'Hecha' }).uncheck();
  await page.getByRole('checkbox', { name: 'En progreso' }).uncheck();
  await expect(cards).toHaveCount(200);
  const filter = Date.now() - start;

  start = Date.now();
  await page.getByRole('combobox', { name: 'Estado de «Tarea 137»' }).selectOption('done');
  await expect(cards).toHaveCount(199);
  const status = Date.now() - start;

  testInfo.annotations.push({ type: 'tiempos (ms)', description: JSON.stringify({ load, search, filter, status }) });
  console.log('Tiempos SC-003 (ms):', JSON.stringify({ load, search, filter, status }));
  expect(load).toBeLessThan(BUDGET_MS);
  // La búsqueda incluye 300 ms de espera deliberada antes de consultar (debounce).
  expect(search).toBeLessThan(BUDGET_MS);
  expect(filter).toBeLessThan(BUDGET_MS);
  expect(status).toBeLessThan(BUDGET_MS);
});
