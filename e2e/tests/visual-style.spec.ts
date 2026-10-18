import { expect, test } from '@playwright/test';
import { openBoard, resetBoardData } from './support/board';

const FONT_BUDGET_BYTES = 100 * 1024;

test.beforeEach(async () => {
  await resetBoardData();
});

test('tipografía autoalojada, cargada, ≤ 100 KB y sin violaciones de CSP (FR-010, SC-006, D17)', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-320', 'Se comprueba una vez, en escritorio');
  test.skip(!!process.env.E2E_BASE_URL, 'Comprueba el servidor local');
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  const fonts: Array<{ url: string; bytes: number }> = [];
  page.on('response', async (response) => {
    if (new URL(response.url()).pathname.endsWith('.woff2')) {
      fonts.push({ url: response.url(), bytes: (await response.body()).length });
    }
  });

  await openBoard(page);
  await page.evaluate(() => document.fonts.ready);

  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/^"Space Grotesk Variable"/);
  expect(await page.evaluate(() => document.fonts.check('500 16px "Space Grotesk Variable"'))).toBe(true);
  await expect.poll(() => fonts.length).toBeGreaterThan(0);
  const origin = new URL(page.url()).origin;
  expect(fonts.filter((f) => new URL(f.url).origin !== origin)).toEqual([]);
  expect(fonts.reduce((sum, f) => sum + f.bytes, 0)).toBeLessThanOrEqual(FONT_BUDGET_BYTES);
  expect(violations).toEqual([]);
});

test('los botones tienen borde de tinta grueso, sombra dura y esquinas casi rectas (FR-001)', async ({ page }) => {
  await openBoard(page);
  const style = await page
    .getByRole('button', { name: 'Crear tarea' })
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { border: s.borderTopWidth, shadow: s.boxShadow, radius: s.borderTopLeftRadius };
    });
  expect(style.border).toBe('3px');
  expect(style.shadow).not.toBe('none');
  expect(style.radius).toBe('4px');
});
