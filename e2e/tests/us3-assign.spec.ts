import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { apiClient } from './support/api';
import { columnRegion, openBoard, resetBoardData, showColumn } from './support/board';

test.beforeEach(async ({ baseURL }) => {
  await resetBoardData();
  const api = await apiClient(baseURL!);
  for (const name of ['Ana', 'Luis']) await api.post('/api/v1/people', { data: { id: randomUUID(), name } });
  await api.dispose();
});

test('US3: asignar al crear, reasignar, quitar y mover sin responsable a Hecha', async ({ page }) => {
  await openBoard(page);
  await page.getByLabel('Título').fill('Preparar demo');
  await page.getByRole('combobox', { name: 'Responsable (opcional)' }).selectOption({ label: 'Ana' });
  await page.getByRole('button', { name: 'Crear tarea' }).click();

  await showColumn(page, 'Pendiente');
  const card = columnRegion(page, 'Pendiente').locator('article', { hasText: 'Preparar demo' });
  await expect(card).toContainText('Ana');

  await card.getByRole('button', { name: 'Preparar demo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Preparar demo' });
  const assignee = dialog.getByRole('combobox', { name: 'Responsable' });
  await assignee.selectOption({ label: 'Luis' });
  await expect(assignee.locator('option:checked')).toHaveText('Luis');
  await assignee.selectOption({ label: 'Sin asignar' });
  await expect(assignee).toHaveValue('');
  await page.keyboard.press('Escape');

  await expect(card).toContainText('Sin asignar');
  await card.getByRole('combobox', { name: /Estado de/ }).selectOption('done');
  await showColumn(page, 'Hecha');
  await expect(columnRegion(page, 'Hecha').locator('article', { hasText: 'Preparar demo' })).toContainText('Sin asignar');
});
