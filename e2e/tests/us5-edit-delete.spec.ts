import { expect, test } from '@playwright/test';
import { apiClient, createTask } from './support/api';
import { openBoard, resetBoardData } from './support/board';

test.beforeEach(async ({ baseURL }) => {
  await resetBoardData();
  const api = await apiClient(baseURL!);
  await createTask(api, { title: 'Preparar demo', description: 'Slides' });
  await api.dispose();
});

const openDetail = async (page: import('@playwright/test').Page, title: string) => {
  await page.getByRole('button', { name: title, exact: true }).click();
  return page.getByRole('dialog', { name: title });
};

test('US5: editar y que persista al recargar', async ({ page }) => {
  await openBoard(page);
  const dialog = await openDetail(page, 'Preparar demo');
  await dialog.getByRole('button', { name: 'Editar' }).click();
  await dialog.getByLabel('Título').fill('Demo final');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('dialog', { name: 'Demo final' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Demo final', exact: true })).toBeVisible();
});

test('US5: borrar y deshacer', async ({ page }) => {
  await openBoard(page);
  const dialog = await openDetail(page, 'Preparar demo');
  await dialog.getByRole('button', { name: 'Borrar' }).click();
  await dialog.getByRole('button', { name: 'Borrar tarea' }).click();
  await expect(page.getByText('Tarea borrada')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preparar demo', exact: true })).toBeHidden();

  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('button', { name: 'Preparar demo', exact: true })).toBeVisible();
});

test('US5: borrar y esperar 10 s deja el borrado definitivo', async ({ page }) => {
  test.setTimeout(30_000);
  await openBoard(page);
  const dialog = await openDetail(page, 'Preparar demo');
  await dialog.getByRole('button', { name: 'Borrar' }).click();
  await dialog.getByRole('button', { name: 'Borrar tarea' }).click();
  await expect(page.getByText('Tarea borrada')).toBeVisible();
  await expect(page.getByText('Tarea borrada')).toBeHidden({ timeout: 12_000 });

  await page.reload();
  await expect(page.getByText(/Todavía no hay tareas/)).toBeVisible();
});
