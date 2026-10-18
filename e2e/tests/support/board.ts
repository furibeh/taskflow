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

/**
 * Garantiza al menos `min` tableros en la instalación de pruebas (SC-106), cada uno de relleno
 * con 20 tareas. Solo crea los que faltan, para no acumular tableros entre ejecuciones; se
 * insertan por SQL porque no necesitan código usable (hash aleatorio).
 */
export const ensureBoards = async (min: number): Promise<number> => {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `WITH missing AS (
         SELECT gen_random_uuid() AS id, n
         FROM generate_series(1, greatest(0, $1::int - (SELECT count(*)::int FROM board))) AS n
       ), boards AS (
         INSERT INTO board (id, name, access_code_hash, access_code_rotated_at, created_at, updated_at)
         SELECT id, 'Relleno SC-106 ' || n, decode(md5(random()::text) || md5(random()::text), 'hex'), now(), now(), now()
         FROM missing
         RETURNING id
       )
       INSERT INTO task (id, board_id, title, created_at, updated_at)
       SELECT gen_random_uuid(), boards.id, 'Tarea de relleno ' || t, now(), now()
       FROM boards, generate_series(1, 20) AS t`,
      [min],
    );
    // Las tareas de relleno de ejecuciones anteriores se vacían con resetBoardData: se reponen.
    await client.query(
      `INSERT INTO task (id, board_id, title, created_at, updated_at)
       SELECT gen_random_uuid(), b.id, 'Tarea de relleno ' || t, now(), now()
       FROM board b, generate_series(1, 20) AS t
       WHERE b.name LIKE 'Relleno SC-106 %' AND NOT EXISTS (SELECT 1 FROM task WHERE task.board_id = b.id)`,
    );
    return (await client.query<{ n: number }>('SELECT count(*)::int AS n FROM board')).rows[0]!.n;
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
