import { sql } from 'kysely';
import { NO_MIGRATIONS } from 'kysely/migration';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertMigrationResult, createMigrator } from '../../src/persistence/migrator';
import { createTestDb, truncateAll } from '../support/test-db';

const db = createTestDb();
const BOARD_ID = '11111111-1111-4111-8111-111111111111';

afterAll(async () => {
  await db.destroy();
});

const tableExists = async (name: string): Promise<boolean> => {
  const { rows } = await sql<{ exists: boolean }>`
    SELECT to_regclass(${`public.${name}`}) IS NOT NULL AS exists`.execute(db);
  return rows[0]?.exists ?? false;
};

describe('migraciones', () => {
  it('se revierten paso a paso hasta cero y se vuelven a aplicar sin errores', async () => {
    const migrator = createMigrator(db);
    const total = (await migrator.getMigrations()).length;
    expect(total).toBe(4);

    for (let i = 0; i < total; i++) {
      assertMigrationResult(await migrator.migrateDown());
    }
    expect(await tableExists('task')).toBe(false);
    expect(await tableExists('board')).toBe(false);

    assertMigrationResult(await migrator.migrateTo(NO_MIGRATIONS));
    assertMigrationResult(await migrator.migrateToLatest());
    expect(await tableExists('task')).toBe(true);
    expect(await tableExists('person')).toBe(true);
  });

  describe('restricciones del esquema', () => {
    beforeEach(async () => {
      await truncateAll(db);
      await db
        .insertInto('board')
        .values({
          id: BOARD_ID,
          access_code_hash: Buffer.from('hash'),
          access_code_rotated_at: new Date(),
        })
        .execute();
    });

    it('rechaza un título de 201 caracteres', async () => {
      await expect(
        db
          .insertInto('task')
          .values({
            id: '22222222-2222-4222-8222-222222222222',
            board_id: BOARD_ID,
            title: 'a'.repeat(201),
            assignee_id: null,
            deleted_at: null,
          })
          .execute(),
      ).rejects.toThrow(/check constraint/);
    });

    it('cuenta los emojis como un carácter (char_length)', async () => {
      await db
        .insertInto('task')
        .values({
          id: '22222222-2222-4222-8222-222222222223',
          board_id: BOARD_ID,
          title: '😀'.repeat(200),
          assignee_id: null,
          deleted_at: null,
        })
        .execute();
    });

    it('rechaza un nombre de persona de 51 caracteres', async () => {
      await expect(
        db
          .insertInto('person')
          .values({ id: '33333333-3333-4333-8333-333333333333', board_id: BOARD_ID, name: 'a'.repeat(51) })
          .execute(),
      ).rejects.toThrow(/check constraint/);
    });

    it('rechaza nombres repetidos sin distinguir mayúsculas', async () => {
      await db
        .insertInto('person')
        .values({ id: '33333333-3333-4333-8333-333333333334', board_id: BOARD_ID, name: 'Ana' })
        .execute();
      await expect(
        db
          .insertInto('person')
          .values({ id: '33333333-3333-4333-8333-333333333335', board_id: BOARD_ID, name: 'ANA' })
          .execute(),
      ).rejects.toThrow(/duplicate key/);
    });
  });
});
