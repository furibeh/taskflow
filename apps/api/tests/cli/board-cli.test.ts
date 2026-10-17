import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { boardLink } from '../../src/cli/board-link';
import { createTestDb, TEST_DATABASE_URL, truncateAll } from '../support/test-db';

const run = promisify(execFile);
const apiDir = fileURLToPath(new URL('../../', import.meta.url));
const cli = (script: string, ...args: string[]) =>
  run('npx', ['tsx', `src/cli/${script}.ts`, ...args], {
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

  describe('varios tableros (feature 002, FR-119)', () => {
    const idOf = async (name: string): Promise<string> =>
      (await db.selectFrom('board').select('id').where('name', '=', name).executeTakeFirstOrThrow()).id;

    it('board:create crea un tablero con su nombre y muestra el enlace una vez', async () => {
      const { stdout } = await cli('board-create', '--name', '  Equipo Infra ');
      expect(stdout.match(new RegExp(LINK, 'g'))).toHaveLength(1);
      expect(await db.selectFrom('board').select('name').execute()).toEqual([{ name: 'Equipo Infra' }]);
    }, 60_000);

    it.each([[[]], [['--name', '   ']], [['--name', 'a'.repeat(61)]]])(
      'board:create sin un nombre válido termina con error y no crea nada (%j)',
      async (args) => {
        await expect(cli('board-create', ...args)).rejects.toMatchObject({ code: 1 });
        expect(await db.selectFrom('board').select('id').execute()).toEqual([]);
      },
      60_000,
    );

    it('board:rotate exige --board cuando hay varios tableros y solo regenera ese', async () => {
      const a = LINK.exec((await cli('board-create', '--name', 'A')).stdout)?.[1];
      const b = LINK.exec((await cli('board-create', '--name', 'B')).stdout)?.[1];
      const before = await db.selectFrom('board').select(['name', 'access_code_hash']).orderBy('name').execute();

      const ambiguous = cli('board-rotate');
      await expect(ambiguous).rejects.toMatchObject({ code: 1 });
      await expect(ambiguous).rejects.toMatchObject({ stderr: expect.stringContaining('--board') });

      const rotated = LINK.exec((await cli('board-rotate', '--board', await idOf('A'))).stdout)?.[1];
      expect(rotated).toBeDefined();
      expect([a, b]).not.toContain(rotated);
      const after = await db.selectFrom('board').select(['name', 'access_code_hash']).orderBy('name').execute();
      expect(after[0]?.access_code_hash).not.toEqual(before[0]?.access_code_hash);
      expect(after[1]?.access_code_hash).toEqual(before[1]?.access_code_hash);
    }, 60_000);

    it.each([
      ['inexistente', '00000000-0000-4000-8000-000000000000', 'No existe ningún tablero con ese id'],
      ['mal formado', 'no-es-un-id', '--board'],
    ])('board:rotate con un id %s termina con error (FR-119a)', async (_label, id, message) => {
      await cli('board-create', '--name', 'A');
      const result = cli('board-rotate', '--board', id);
      await expect(result).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining(message) });
    }, 60_000);
  });
});
