import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCESS_CODE_FILE, TEST_DATABASE_URL } from './tests/support/env';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const run = (script: string, ...args: string[]): string =>
  execFileSync('npm', ['run', '--silent', script, '-w', 'apps/api', '--', ...args], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, LOG_LEVEL: 'warn' },
    encoding: 'utf8',
  });

/** Migra la base de datos de pruebas y obtiene un código de acceso fresco para los E2E. */
export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_BASE_URL) {
    if (!process.env.E2E_ACCESS_CODE) throw new Error('Con E2E_BASE_URL hay que definir E2E_ACCESS_CODE');
    return;
  }
  run('db:migrate');
  // Con varios tableros (feature 002), board:rotate exige --board; se crea uno propio.
  const output = run('board:create', '--name', 'E2E');
  const code = /#k=([A-Za-z0-9_-]{43})/.exec(output)?.[1];
  if (!code) throw new Error('No se pudo obtener el código de acceso de board:create');
  mkdirSync(dirname(ACCESS_CODE_FILE), { recursive: true });
  writeFileSync(ACCESS_CODE_FILE, code, { mode: 0o600 });
}
