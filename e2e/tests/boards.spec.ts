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
  // El foco entra en la confirmación para que el lector de pantalla la anuncie (T056).
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog.getByLabel('Enlace del tablero')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Copiar enlace' })).toBeFocused();

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

/** Abre el tablero recién creado desde su aviso. */
const openCreated = async (page: Page, dialog: Awaited<ReturnType<typeof createBoard>>, name: string) => {
  const link = await dialog.getByLabel('Enlace del tablero').inputValue();
  await dialog.getByRole('button', { name: 'Abrir tablero' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  return link;
};

const addPerson = async (page: Page, name: string) => {
  await page.getByRole('button', { name: 'Personas' }).click();
  const people = page.getByRole('dialog', { name: 'Personas del equipo' });
  await people.getByLabel('Nombre').fill(name);
  await people.getByRole('button', { name: 'Añadir' }).click();
  await expect(people.getByText(name, { exact: true })).toBeVisible();
  await people.getByRole('button', { name: 'Cerrar' }).click();
};

test('US2: los datos de un tablero no aparecen en otro', async ({ page }) => {
  const linkA = await openCreated(page, await createBoard(page, 'Equipo A'), 'Equipo A');
  await addPerson(page, 'Ana');
  await page.getByLabel('Título').fill('Solo A');
  await page.getByRole('button', { name: 'Crear tarea' }).click();
  await showColumn(page, 'Pendiente');
  await expect(columnRegion(page, 'Pendiente').getByRole('button', { name: 'Solo A', exact: true })).toBeVisible();

  await openCreated(page, await createBoard(page, 'Equipo B'), 'Equipo B');
  await expect(page.getByRole('region', { name: 'Tablero de tareas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Solo A', exact: true })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Buscar tareas' }).fill('Solo A');
  await expect(page.locator('.no-results__message')).toHaveText('No hay tareas que coincidan con «Solo A»');
  await expect(page.getByRole('combobox', { name: 'Filtrar por responsable' }).getByRole('option', { name: 'Ana' })).toHaveCount(0);

  // B admite su propia "Ana" (la unicidad de nombres es por tablero).
  await addPerson(page, 'Ana');

  // A sigue intacto.
  await page.goto(linkA);
  await expect(page.getByRole('heading', { level: 1, name: 'Equipo A' })).toBeVisible();
  await showColumn(page, 'Pendiente');
  await expect(columnRegion(page, 'Pendiente').getByRole('button', { name: 'Solo A', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Personas' }).click();
  const people = page.getByRole('dialog', { name: 'Personas del equipo' });
  await expect(people.getByRole('listitem')).toHaveCount(1);
  await expect(people.getByText('Ana', { exact: true })).toBeVisible();
});

test('US3: cambiar el nombre del tablero y verlo al recargar en otra pestaña', async ({ page, context }) => {
  const link = await openCreated(page, await createBoard(page, 'Equipo Diseño'), 'Equipo Diseño');

  await page.getByRole('button', { name: 'Tablero', exact: true }).click();
  await page.getByRole('button', { name: 'Cambiar nombre' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cambiar nombre' });
  await expect(dialog.getByLabel('Nombre del tablero')).toHaveValue('Equipo Diseño');
  await expectNoA11yViolations(page);

  await dialog.getByLabel('Nombre del tablero').fill('Diseño y UX');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'Diseño y UX' })).toBeVisible();
  await expect(page).toHaveTitle('«Diseño y UX» · TaskFlow');
  await expect(page.getByTestId('live-region')).toHaveText('Nombre del tablero cambiado');

  const other = await context.newPage();
  await other.goto(link);
  await expect(other.getByRole('heading', { level: 1, name: 'Diseño y UX' })).toBeVisible();
  await expect(other).toHaveTitle('«Diseño y UX» · TaskFlow');
  await other.close();
});

test('US4: borrar el tablero confirmando con su nombre; su enlace deja de funcionar', async ({ page, context }) => {
  const link = await openCreated(page, await createBoard(page, 'Equipo temporal'), 'Equipo temporal');
  await addPerson(page, 'Ana');
  await page.getByLabel('Título').fill('Tarea que se borrará');
  await page.getByRole('button', { name: 'Crear tarea' }).click();
  await showColumn(page, 'Pendiente');
  await expect(
    columnRegion(page, 'Pendiente').getByRole('button', { name: 'Tarea que se borrará', exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Tablero', exact: true }).click();
  await page.getByRole('button', { name: 'Borrar tablero' }).click();
  const dialog = page.getByRole('dialog', { name: 'Borrar tablero' });
  await expect(
    dialog.getByText('Se borrará el tablero «Equipo temporal» con 1 tarea y 1 persona. No se puede deshacer.'),
  ).toBeVisible();
  await expectNoA11yViolations(page);

  const confirm = dialog.getByRole('button', { name: 'Borrar tablero' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Escribe «Equipo temporal» para confirmar').fill('Equipo temporal');
  await confirm.click();

  await expect(page.locator('.home__notice')).toHaveText('Tablero «Equipo temporal» borrado');
  await expect(page.getByTestId('live-region')).toHaveText('Tablero «Equipo temporal» borrado');
  await expect(page.getByRole('heading', { name: 'Tableros de tareas para tu equipo' })).toBeVisible();
  await expect(page).toHaveTitle('TaskFlow');
  expect(new URL(page.url()).hash).toBe('');

  const other = await context.newPage();
  await other.goto(link);
  await expect(other.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible();
  await expect(other.getByRole('button', { name: 'Crear un tablero nuevo' })).toBeVisible();
  await other.close();
});
