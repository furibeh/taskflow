import { sql, type Kysely } from 'kysely';
import { createDb, type Database } from '../../src/persistence/db';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://taskflow:change-me@localhost:5433/taskflow_test';

export const createTestDb = (): Kysely<Database> => createDb(TEST_DATABASE_URL);

export const truncateAll = async (db: Kysely<Database>): Promise<void> => {
  await sql`TRUNCATE task, person, board`.execute(db);
};
