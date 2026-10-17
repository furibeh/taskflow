import { expect, test } from '@playwright/test';
import { openBoard, resetBoardData } from './support/board';

test.beforeEach(async () => {
  await resetBoardData();
});

test('la página web se sirve con CSP y no hay violaciones al usarla (T138)', async ({ page }) => {
  test.skip(!!process.env.E2E_BASE_URL, 'Comprueba el servidor local');
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });

  const response = await page.goto('/');
  const csp = response!.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(response!.headers()['referrer-policy']).toBe('no-referrer');

  await openBoard(page);
  await page.getByLabel('Título').fill('Con CSP');
  await page.getByRole('button', { name: 'Crear tarea' }).click();
  await expect(page.getByRole('button', { name: 'Con CSP', exact: true })).toBeAttached();
  await page.getByRole('button', { name: 'Personas' }).click();
  await page.keyboard.press('Escape');

  expect(violations).toEqual([]);
});
