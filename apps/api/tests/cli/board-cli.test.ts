import { execFile, spawn } from 'node:child_process';
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

/** Ejecuta un comando de consola escribiendo `input` en su entrada estándar. */
const cliWithInput = (script: string, input: string, ...args: string[]) =>
  new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn('npx', ['tsx', `src/cli/${script}.ts`, ...args], {
      cwd: apiDir,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, PUBLIC_WEB_URL: 'http://localhost:5173/' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
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
    expect(second.stdout).toContain('Ya existe al menos un tablero');
    expect(second.stdout).toContain('board:rotate -- --board <id>');
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

  describe('board:list y board:delete (FR-119, FR-119a)', () => {
    const idOf = async (name: string): Promise<string> =>
      (await db.selectFrom('board').select('id').where('name', '=', name).executeTakeFirstOrThrow()).id;
    const count = async (table: 'board' | 'task' | 'person', boardId?: string) => {
      let query = db.selectFrom(table).select(db.fn.countAll<string>().as('n'));
      if (boardId) query = query.where('board_id' as never, '=', boardId as never);
      return Number((await query.executeTakeFirstOrThrow()).n);
    };

    const seed = async () => {
      const codeA = LINK.exec((await cli('board-create', '--name', 'Equipo A')).stdout)?.[1];
      await cli('board-create', '--name', 'Equipo B');
      const a = await idOf('Equipo A');
      await db.insertInto('person').values({ id: 'c0000000-0000-4000-8000-0000000000a1', board_id: a, name: 'Ana' }).execute();
      await db
        .insertInto('task')
        .values({ id: 'f0000000-0000-4000-8000-0000000000a1', board_id: a, title: 'Una', assignee_id: null, deleted_at: null })
        .execute();
      return { a, b: await idOf('Equipo B'), codeA: codeA! };
    };

    it('board:list muestra id, nombre, creación, recuentos y última actividad, nunca códigos ni hashes', async () => {
      const { a, b, codeA } = await seed();
      const { stdout } = await cli('board-list');

      const lineA = stdout.split('\n').find((line) => line.includes(a));
      expect(lineA).toMatch(/Equipo A/);
      expect(lineA).toMatch(/\b1 tarea\b/);
      expect(lineA).toMatch(/\b1 persona\b/);
      expect(lineA).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
      expect(stdout).toContain(b);
      expect(stdout).not.toContain(codeA);
      expect(stdout).not.toMatch(/[A-Za-z0-9_-]{43}/);
      expect(stdout).not.toMatch(/\\x[0-9a-f]{16}|[0-9a-f]{64}/);
    }, 60_000);

    it('board:list sin tableros lo indica', async () => {
      expect((await cli('board-list')).stdout).toContain('No hay tableros');
    }, 60_000);

    it('board:delete --confirm con otro texto no borra nada y termina con error', async () => {
      const { a } = await seed();
      const result = cli('board-delete', '--board', a, '--confirm', 'equipo a');
      await expect(result).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('no coincide') });
      expect(await count('board')).toBe(2);
      expect(await count('task', a)).toBe(1);
    }, 60_000);

    it('board:delete --confirm con el nombre exacto borra el tablero y sus datos, y nada más', async () => {
      const { a, b } = await seed();
      const { stdout } = await cli('board-delete', '--board', a, '--confirm', 'Equipo A');

      expect(stdout).toContain('Tablero «Equipo A» borrado');
      expect(stdout).toMatch(/1 tarea.*1 persona/);
      expect(await db.selectFrom('board').select('id').execute()).toEqual([{ id: b }]);
      expect(await count('task', a)).toBe(0);
      expect(await count('person', a)).toBe(0);
    }, 60_000);

    it('board:delete sin --confirm pide el nombre por la entrada estándar', async () => {
      const { a } = await seed();

      const wrong = await cliWithInput('board-delete', 'Otro\n', '--board', a);
      expect(wrong.code).toBe(1);
      expect(wrong.stdout).toContain('Escribe «Equipo A» para confirmar');
      expect(await count('board')).toBe(2);

      const right = await cliWithInput('board-delete', 'Equipo A\n', '--board', a);
      expect(right.code).toBe(0);
      expect(await count('board')).toBe(1);
    }, 60_000);

    it.each([
      ['inexistente', '00000000-0000-4000-8000-000000000000', 'No existe ningún tablero con ese id'],
      ['mal formado', 'no-es-un-id', '--board'],
      ['ausente', undefined, '--board'],
    ])('board:delete con un id %s termina con error sin borrar nada', async (_label, id, message) => {
      await seed();
      const args = id === undefined ? ['--confirm', 'Equipo A'] : ['--board', id, '--confirm', 'Equipo A'];
      await expect(cli('board-delete', ...args)).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining(message) });
      expect(await count('board')).toBe(2);
    }, 60_000);
  });
});
