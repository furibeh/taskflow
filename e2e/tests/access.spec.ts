import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { accessCode, openBoard, resetBoardData } from './support/board';
import { ACCESS_CODE_FILE } from './support/env';

test.beforeEach(async () => {
  await resetBoardData();
});

test('un código incorrecto muestra "Enlace no válido" sin ningún dato', async ({ page }) => {
  await page.goto('/#k=incorrecto');
  await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'TaskFlow' })).toBeHidden();
  await expect(page.getByRole('article')).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible();
});

test('regenerar en un contexto invalida el enlace en el otro en su siguiente acción', async ({
  browser,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-320' || !!process.env.E2E_BASE_URL, 'Basta con un proyecto local');
  const other = await browser.newPage({ baseURL: testInfo.project.use.baseURL! });
  await openBoard(other);
  await openBoard(page);

  await page.getByRole('button', { name: 'Compartir' }).click();
  const dialog = page.getByRole('dialog', { name: 'Compartir el tablero' });
  const oldLink = await dialog.getByLabel('Enlace del tablero').inputValue();
  expect(oldLink).toContain(accessCode());
  await dialog.getByRole('button', { name: 'Regenerar enlace' }).click();
  await dialog.getByRole('button', { name: 'Regenerar', exact: true }).click();
  await expect(dialog.getByLabel('Enlace del tablero')).not.toHaveValue(oldLink);

  const newCode = new URL(await dialog.getByLabel('Enlace del tablero').inputValue()).hash.replace('#k=', '');
  // El resto de pruebas leen el código de este archivo: se actualiza con el nuevo.
  writeFileSync(ACCESS_CODE_FILE, newCode, { mode: 0o600 });
  expect(page.url()).toContain(`#k=${newCode}`);

  await other.getByLabel('Título').fill('Con el enlace viejo');
  await other.getByRole('button', { name: 'Crear tarea' }).click();
  await expect(other.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'TaskFlow' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Con el enlace viejo', exact: true })).toHaveCount(0);
  await other.close();
});
