import { expect, test, type Page } from '@playwright/test';
import { apiClient, createTask } from './support/api';
import { columnRegion, openBoard, resetBoardData, showColumn } from './support/board';

test.beforeEach(async ({ baseURL }) => {
  await resetBoardData();
  const api = await apiClient(baseURL!);
  await createTask(api, { title: 'Preparar demo' });
  await api.dispose();
});

test('US2: cambiar el estado con el selector y que persista', async ({ page }) => {
  await openBoard(page);
  await page.getByRole('combobox', { name: 'Estado de «Preparar demo»' }).selectOption('in_progress');

  await showColumn(page, 'En progreso');
  await expect(columnRegion(page, 'En progreso').getByRole('button', { name: 'Preparar demo', exact: true })).toBeVisible();

  await page.reload();
  await showColumn(page, 'En progreso');
  await expect(columnRegion(page, 'En progreso').getByRole('button', { name: 'Preparar demo', exact: true })).toBeVisible();
});

/** Arrastra «Preparar demo» con el ratón hasta la columna Hecha y lo deja pulsado (sin soltar). */
const dragOverDone = async (page: Page): Promise<void> => {
  const card = page.locator('article.card', { hasText: 'Preparar demo' });
  await page.getByRole('region', { name: 'Tablero de tareas' }).scrollIntoViewIfNeeded();
  await card.scrollIntoViewIfNeeded();
  const source = await card.locator('.card__assignee').boundingBox();
  const target = await page.getByRole('region', { name: /^Hecha/ }).boundingBox();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(source!.x + 40, source!.y + 10, { steps: 5 });
  await page.mouse.move(target!.x + target!.width / 2, target!.y + 60, { steps: 15 });
};

/** Registra en cada fotograma, durante `ms`, la x de la copia arrastrada (null si no existe). */
const sampleOverlayX = (page: Page, ms: number): Promise<(number | null)[]> =>
  page.evaluate(
    (duration) =>
      new Promise<(number | null)[]>((resolve) => {
        const xs: (number | null)[] = [];
        const start = performance.now();
        const tick = () => {
          xs.push(document.querySelector('.card--overlay')?.getBoundingClientRect().x ?? null);
          if (performance.now() - start < duration) requestAnimationFrame(tick);
          else resolve(xs);
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );

test('US2: arrastrar con el ratón de Pendiente a Hecha', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-320', 'Por debajo de 768 px no hay arrastrar y soltar');
  await openBoard(page);

  await dragOverDone(page);
  await page.mouse.up();

  await expect(
    page.getByRole('region', { name: /^Hecha/ }).getByRole('button', { name: 'Preparar demo', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('US2: al soltar en otra columna la copia arrastrada no vuelve a la de origen (#29)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-320', 'Por debajo de 768 px no hay arrastrar y soltar');
  await openBoard(page);

  await dragOverDone(page);
  const dropX = (await page.locator('.card--overlay').boundingBox())!.x;
  const samples = sampleOverlayX(page, 600);
  await page.mouse.up();
  const xs = await samples;

  // Ningún fotograma acerca la copia a Pendiente (a la izquierda) y al final ya no existe.
  for (const x of xs) if (x !== null) expect(x).toBeGreaterThanOrEqual(dropX - 2);
  expect(xs.at(-1)).toBeNull();
  await expect(
    page.getByRole('region', { name: /^Hecha/ }).getByRole('button', { name: 'Preparar demo', exact: true }),
  ).toBeVisible();
});

test('US2: cancelar el arrastre con Escape no deja la copia ni guarda nada (#29)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-320', 'Por debajo de 768 px no hay arrastrar y soltar');
  await openBoard(page);
  let patches = 0;
  page.on('request', (request) => {
    if (request.method() === 'PATCH') patches += 1;
  });

  await dragOverDone(page);
  await expect(page.locator('.card--overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();

  await expect(page.locator('.card--overlay')).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: /^Pendiente/ }).getByRole('button', { name: 'Preparar demo', exact: true }),
  ).toBeVisible();
  expect(patches).toBe(0);
});

test('US2: mover con el teclado y cancelar con Escape', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-320', 'Por debajo de 768 px no hay arrastrar y soltar');
  await openBoard(page);

  const handle = page.getByRole('button', { name: 'Mover «Preparar demo»' });
  await handle.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('region', { name: /^Pendiente/ }).getByRole('button', { name: 'Preparar demo', exact: true }),
  ).toBeVisible();

  await handle.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('region', { name: /^En progreso/ }).getByRole('button', { name: 'Preparar demo', exact: true }),
  ).toBeVisible();
});

test('US2: si falla el guardado la tarjeta no se mueve y "Reintentar" lo aplica una sola vez', async ({ page }) => {
  await openBoard(page);
  let patches = 0;
  await page.route('**/api/v1/tasks/*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    patches += 1;
    return patches === 1 ? route.abort() : route.continue();
  });

  await page.getByRole('combobox', { name: 'Estado de «Preparar demo»' }).selectOption('done');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('No se pudo guardar. Revisa tu conexión.');
  await showColumn(page, 'Pendiente');
  await expect(columnRegion(page, 'Pendiente').getByRole('button', { name: 'Preparar demo', exact: true })).toBeVisible();

  await alert.getByRole('button', { name: 'Reintentar' }).click();
  await showColumn(page, 'Hecha');
  await expect(columnRegion(page, 'Hecha').getByRole('button', { name: 'Preparar demo', exact: true })).toBeVisible();
  expect(patches).toBe(2);
});
