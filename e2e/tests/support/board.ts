import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { ACCESS_CODE_FILE, TEST_DATABASE_URL } from './env';

export const accessCode = (): string =>
  process.env.E2E_ACCESS_CODE ?? readFileSync(ACCESS_CODE_FILE, 'utf8').trim();

/** Vacía tareas y personas del tablero de pruebas (nunca se ejecuta contra un entorno externo). */
export const resetBoardData = async (): Promise<void> => {
  if (process.env.E2E_BASE_URL) return;
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query('TRUNCATE task, person');
  } finally {
    await client.end();
  }
};

export const openBoard = async (page: Page): Promise<void> => {
  await page.goto(`/#k=${accessCode()}`);
  // La cabecera muestra el nombre del tablero (feature 002); se espera al propio tablero.
  await expect(page.getByRole('region', { name: 'Tablero de tareas' })).toBeVisible();
};

export const expectNoA11yViolations = async (page: Page): Promise<void> => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

/** En móvil las columnas son pestañas: selecciona la columna antes de buscar en ella. */
export const showColumn = async (page: Page, name: string): Promise<void> => {
  // Espera a que el tablero esté cargado: isVisible() no espera y daría un falso "no hay pestañas".
  await page.getByRole('region', { name: 'Tablero de tareas' }).waitFor();
  const tab = page.getByRole('tab', { name: new RegExp(`^${name}`) });
  if (await tab.isVisible()) await tab.click();
};

export const columnRegion = (page: Page, name: string) =>
  page.getByRole('tabpanel').or(page.getByRole('region', { name: new RegExp(`^${name}`) }));
