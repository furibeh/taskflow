import { expect, test, type Page } from '@playwright/test';
import { columnRegion, expectNoA11yViolations, showColumn } from './support/board';

// Crea tableros reales en la instalación de pruebas (feature 002).
test.skip(!!process.env.E2E_BASE_URL, 'Crea tableros: solo contra el entorno local de pruebas');
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/** Crea un tablero desde la pantalla de inicio y devuelve el diálogo con su enlace. */
const createBoard = async (page: Page, name: string) => {
  await page.goto('/');
  await page.getByLabel('Nombre del tablero').fill(name);
  await page.getByRole('button', { name: 'Crear tablero' }).click();
  const dialog = page.getByRole('dialog', { name: `Tablero «${name}» creado` });
  await expect(dialog).toBeVisible();
  return dialog;
};

test('US1: crear un tablero, copiar su enlace, abrirlo y crear la primera tarea', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tableros de tareas para tu equipo' })).toBeVisible();
  await expectNoA11yViolations(page);

  const dialog = await createBoard(page, 'Equipo Diseño');
  await expect(dialog.getByText('Guarda este enlace: no se volverá a mostrar.')).toBeVisible();
  await expectNoA11yViolations(page);

  const link = await dialog.getByLabel('Enlace del tablero').inputValue();
  expect(link).toMatch(/#k=[A-Za-z0-9_-]{43}$/);
  await dialog.getByRole('button', { name: 'Copiar enlace' }).click();
  await expect(page.getByTestId('live-region')).toHaveText('Enlace copiado');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);

  await dialog.getByRole('button', { name: 'Abrir tablero' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Equipo Diseño' })).toBeVisible();
  await expect(page).toHaveTitle('«Equipo Diseño» · TaskFlow');

  await page.getByLabel('Título').fill('Primera tarea');
  await page.getByRole('button', { name: 'Crear tarea' }).click();
  await showColumn(page, 'Pendiente');
  await expect(columnRegion(page, 'Pendiente').getByRole('button', { name: 'Primera tarea', exact: true })).toBeVisible();

  // El enlace copiado abre el mismo tablero en otra pestaña.
  const other = await context.newPage();
  await other.goto(link);
  await expect(other.getByRole('heading', { level: 1, name: 'Equipo Diseño' })).toBeVisible();
  await showColumn(other, 'Pendiente');
  await expect(columnRegion(other, 'Pendiente').getByRole('button', { name: 'Primera tarea', exact: true })).toBeVisible();
  await other.close();
});

test('US1: Escape en el aviso sin copiar el enlace pide confirmación (FR-103a)', async ({ page }) => {
  const dialog = await createBoard(page, 'Equipo sin copiar');

  await page.keyboard.press('Escape');
  await expect(dialog.getByText('No podrás volver a ver este enlace. ¿Cerrar de todos modos?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog.getByLabel('Enlace del tablero')).toBeVisible();

  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: 'Cerrar de todos modos' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Tableros de tareas para tu equipo' })).toBeVisible();
});

test('US1: sin desplazamiento horizontal en la pantalla de inicio y el aviso del enlace', async ({ page }) => {
  await page.goto('/');
  const scrolls = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(await scrolls()).toBe(false);
  await createBoard(page, 'Equipo con un nombre largo para una pantalla estrecha');
  expect(await scrolls()).toBe(false);
});
