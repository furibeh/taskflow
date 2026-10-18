import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { apiClient, createTask } from './support/api';
import { expectNoA11yViolations, openBoard, resetBoardData, showColumn } from './support/board';

test.beforeEach(async ({ baseURL }) => {
  await resetBoardData();
  const api = await apiClient(baseURL!);
  const ana = randomUUID();
  await api.post('/api/v1/people', { data: { id: ana, name: 'Ana' } });
  await createTask(api, { title: 'A', assigneeId: ana });
  await createTask(api, { title: 'Preparar demo', description: 'Slides' });
  await api.dispose();
});

/** Todo elemento interactivo visible mide al menos 44×44 px (FR-033). */
const expectTapTargets = async (page: Page) => {
  const small = await page.evaluate(() => {
    const selector =
      'button, select, textarea, input:not([type="checkbox"]), [role="tab"], label:has(> input[type="checkbox"])';
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((el) => el.offsetParent !== null && !el.closest('[hidden], .visually-hidden'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 44 || r.height < 44)
      .map(({ el, r }) => `${el.tagName} "${el.textContent?.trim() || el.getAttribute('aria-label') || ''}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  });
  expect(small).toEqual([]);
};

const expectNoHorizontalScroll = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

test('tablero, diálogos y aviso: WCAG 2.1 AA, objetivos de 44 px y sin scroll horizontal', async ({ page }) => {
  await openBoard(page);
  await expect(page.getByRole('button', { name: 'Preparar demo', exact: true })).toBeVisible();
  await expectNoA11yViolations(page);
  await expectTapTargets(page);
  await expectNoHorizontalScroll(page);

  await page.getByRole('button', { name: 'Preparar demo', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Preparar demo' })).toBeVisible();
  await expectNoA11yViolations(page);
  await expectTapTargets(page);
  await expectNoHorizontalScroll(page);
  await page.keyboard.press('Escape');

  for (const [button, dialog] of [
    ['Personas', 'Personas del equipo'],
    ['Compartir', 'Compartir el tablero'],
  ] as const) {
    await page.getByRole('button', { name: button }).click();
    await expect(page.getByRole('dialog', { name: dialog })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectTapTargets(page);
    await expectNoHorizontalScroll(page);
    await page.keyboard.press('Escape');
  }

  await page.getByRole('button', { name: 'Preparar demo', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Borrar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Borrar tarea' }).click();
  await expect(page.getByText('Tarea borrada')).toBeVisible();
  await expectNoA11yViolations(page);
  await expectTapTargets(page);
});

test('modo oscuro: sin incumplimientos WCAG 2.1 AA (contraste incluido)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openBoard(page);
  await expect(page.getByRole('button', { name: 'Preparar demo', exact: true })).toBeVisible();
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: 'Preparar demo', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Preparar demo' })).toBeVisible();
  await expectNoA11yViolations(page);
});

test('modo oscuro: columna destino y tarjeta "Guardando…" sin incumplimientos (FR-009, SC-001)', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openBoard(page);

  if (testInfo.project.name !== 'mobile-320') {
    // Por debajo de 768 px no hay asa de mover: la columna destino solo existe en escritorio.
    await page.getByRole('button', { name: 'Mover «A»' }).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.column--drop-target')).toHaveCount(1);
    await expectNoA11yViolations(page);
    await expectTapTargets(page);
    await expectNoHorizontalScroll(page);
    await page.keyboard.press('Escape');
  }

  await page.route('**/api/v1/tasks/*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    return route.continue();
  });
  await showColumn(page, 'Pendiente');
  await page.getByRole('combobox', { name: 'Estado de «A»' }).selectOption('done');
  await expect(page.getByText('Guardando…')).toBeVisible();
  await expectNoA11yViolations(page);
  await expectTapTargets(page);
  await expectNoHorizontalScroll(page);
});

test('movimiento reducido: los botones no animan el desplazamiento (FR-007, SC-005)', async ({ page }) => {
  await openBoard(page);
  const button = page.getByRole('button', { name: 'Crear tarea' });
  const read = () =>
    button.evaluate((el) => {
      const s = getComputedStyle(el);
      return { transform: s.transform, durations: s.transitionDuration.split(', ') };
    });

  expect((await read()).transform).toBe('none');
  await button.hover();
  // El botón se hunde sobre su sombra con una transición corta.
  await expect.poll(async () => (await read()).transform).not.toBe('none');
  expect((await read()).durations).toContain('0.08s');

  await page.mouse.move(0, 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await button.hover();
  expect((await read()).durations.every((d) => d === '0s')).toBe(true);
});

test('foco visible y separado del borde en botones, campos y casillas (FR-008)', async ({ page }) => {
  await openBoard(page);
  for (const control of [
    page.getByRole('button', { name: 'Crear tarea' }),
    page.getByLabel('Título'),
    page.getByRole('checkbox', { name: 'Hecha' }),
  ]) {
    await control.focus();
    const outline = await control.evaluate((el) => {
      const s = getComputedStyle(el);
      return { visible: el.matches(':focus-visible'), style: s.outlineStyle, width: s.outlineWidth, offset: s.outlineOffset };
    });
    expect(outline).toEqual({ visible: true, style: 'solid', width: '3px', offset: '3px' });
  }
});

test('recorrido completo solo con teclado: crear, cambiar estado, asignar, filtrar, borrar y deshacer', async ({
  page,
}) => {
  await openBoard(page);

  await page.getByLabel('Título').focus();
  await page.keyboard.type('Con teclado');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Con teclado', exact: true })).toBeAttached();

  const status = page.getByRole('combobox', { name: 'Estado de «Con teclado»' });
  await status.focus();
  await page.keyboard.press('ArrowDown');
  // En móvil la tarjeta pasa a la pestaña "En progreso", que hay que mostrar.
  await showColumn(page, 'En progreso');
  await expect(page.getByRole('combobox', { name: 'Estado de «Con teclado»' })).toHaveValue('in_progress');

  await page.getByRole('button', { name: 'Con teclado', exact: true }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Con teclado' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Responsable' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(dialog.getByRole('combobox', { name: 'Responsable' }).locator('option:checked')).toHaveText('Ana');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('searchbox', { name: 'Buscar tareas' }).focus();
  await page.keyboard.type('teclado');
  await expect(page.locator('article.card')).toHaveCount(1);

  await page.getByRole('button', { name: 'Con teclado', exact: true }).focus();
  await page.keyboard.press('Enter');
  await dialog.getByRole('button', { name: 'Borrar' }).focus();
  await page.keyboard.press('Enter');
  await dialog.getByRole('button', { name: 'Borrar tarea' }).focus();
  await page.keyboard.press('Enter');

  const undo = page.getByRole('button', { name: 'Deshacer' });
  await expect(undo).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Con teclado', exact: true })).toBeAttached();
});
