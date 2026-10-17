import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, openBoard, resetBoardData } from './support/board';

test.beforeEach(async () => {
  await resetBoardData();
});

test('US6: añadir personas, rechazar repetidos y quitar con confirmación', async ({ page }) => {
  await openBoard(page);
  await page.getByRole('button', { name: 'Personas' }).click();
  const dialog = page.getByRole('dialog', { name: 'Personas del equipo' });

  for (const name of ['Ana', 'Luis']) {
    await dialog.getByLabel('Nombre').fill(name);
    await dialog.getByRole('button', { name: 'Añadir' }).click();
    await expect(dialog.getByText(name, { exact: true })).toBeVisible();
  }

  await dialog.getByLabel('Nombre').fill('ana');
  await dialog.getByRole('button', { name: 'Añadir' }).click();
  await expect(dialog.getByText('Ya existe una persona con ese nombre.')).toBeVisible();
  await expectNoA11yViolations(page);

  await dialog.getByRole('button', { name: 'Quitar a Luis' }).click();
  await expect(dialog.getByText('Se quitará a Luis.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Quitar', exact: true }).click();
  await expect(dialog.getByText('Luis', { exact: true })).toBeHidden();

  await page.reload();
  await page.getByRole('button', { name: 'Personas' }).click();
  await expect(dialog.getByText('Ana', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Luis', { exact: true })).toBeHidden();
});
