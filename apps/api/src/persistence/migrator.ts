import type { Kysely } from 'kysely';
import { Migrator, type MigrationResultSet } from 'kysely/migration';
import { migrationProvider } from './migrations';

export const createMigrator = <DB>(db: Kysely<DB>): Migrator =>
  new Migrator({ db, provider: migrationProvider });

/** Lanza un error si alguna migración falla, para que la CLI y las pruebas lo detecten. */
export const assertMigrationResult = ({ error, results }: MigrationResultSet): void => {
  const failed = results?.find((r) => r.status === 'Error');
  if (error || failed) {
    throw new Error(`Fallo en la migración ${failed?.migrationName ?? ''}`.trim(), {
      cause: error,
    });
  }
};

export const migrateToLatest = async <DB>(db: Kysely<DB>): Promise<void> => {
  assertMigrationResult(await createMigrator(db).migrateToLatest());
};
