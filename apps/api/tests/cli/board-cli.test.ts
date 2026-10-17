import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { boardLink } from '../../src/cli/board-link';
import { createTestDb, TEST_DATABASE_URL, truncateAll } from '../support/test-db';

const run = promisify(execFile);
const apiDir = fileURLToPath(new URL('../../', import.meta.url));
const cli = (script: string) =>
  run('npx', ['tsx', `src/cli/${script}.ts`], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, PUBLIC_WEB_URL: 'http://localhost:5173/' },
    timeout: 30_000,
  });

describe('boardLink', () => {
  it('pone el código en el fragmento #k= y no duplica barras', () => {
    expect(boardLink('http://localhost:5173', 'abc')).toBe('http://localhost:5173/#k=abc');
    expect(boardLink('https://taskflow.example///', 'abc')).toBe('https://taskflow.example/#k=abc');
  });
});

describe('CLI del tablero (Constitución IV)', () => {
  const db = createTestDb();

  beforeEach(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  const LINK = /http:\/\/localhost:5173\/#k=([A-Za-z0-9_-]{43})/;

  it('board:init muestra el enlace solo al crear el tablero', async () => {
    const first = await cli('board-init');
    expect(first.stdout).toMatch(LINK);

    const second = await cli('board-init');
    expect(second.stdout).toContain('El tablero ya existe');
    expect(second.stdout).not.toContain('#k=');
  }, 60_000);

  it('board:rotate imprime un enlace nuevo, distinto del anterior', async () => {
    const created = LINK.exec((await cli('board-init')).stdout)?.[1];
    const rotated = LINK.exec((await cli('board-rotate')).stdout)?.[1];
    expect(rotated).toBeDefined();
    expect(rotated).not.toBe(created);
  }, 60_000);

  it('board:rotate sin tablero termina con error', async () => {
    await expect(cli('board-rotate')).rejects.toMatchObject({ code: 1 });
  }, 60_000);
});
