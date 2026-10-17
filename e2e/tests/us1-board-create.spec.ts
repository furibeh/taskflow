import { expect, test } from '@playwright/test';
import {
  columnRegion,
  expectNoA11yViolations,
  openBoard,
  resetBoardData,
  showColumn,
} from './support/board';

test.beforeEach(async () => {
  await resetBoardData();
});

test('US1: tablero vacío, crear tarea, persistencia y detalle', async ({ page }) => {
  await openBoard(page);
  await expect(page.getByText(/Todavía no hay tareas/)).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByLabel('Título').fill('Preparar demo');
  await page.getByLabel('Descripción (opcional)').fill('Slides y datos de ejemplo');
  await page.getByRole('button', { name: 'Crear tarea' }).click();

  await showColumn(page, 'Pendiente');
  const card = columnRegion(page, 'Pendiente').getByRole('button', { name: 'Preparar demo', exact: true });
  await expect(card).toBeVisible();
  await expect(page.getByLabel('Título')).toHaveValue('');

  await page.reload();
  await showColumn(page, 'Pendiente');
  await expect(columnRegion(page, 'Pendiente').getByRole('button', { name: 'Preparar demo', exact: true })).toBeVisible();

  await columnRegion(page, 'Pendiente').getByRole('button', { name: 'Preparar demo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Preparar demo', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Slides y datos de ejemplo')).toBeVisible();
  await expect(dialog.getByText('Pendiente')).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Responsable' }).locator('option:checked')).toHaveText('Sin asignar');
  await expectNoA11yViolations(page);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('US1: el título vacío no crea nada', async ({ page }) => {
  await openBoard(page);
  await page.getByLabel('Título').fill('   ');
  await page.getByRole('button', { name: 'Crear tarea' }).click();
  await expect(page.getByText('El título es obligatorio.')).toBeVisible();
  await expect(page.getByText(/Todavía no hay tareas/)).toBeVisible();
});

test('US1: sin desplazamiento horizontal', async ({ page }) => {
  await openBoard(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
