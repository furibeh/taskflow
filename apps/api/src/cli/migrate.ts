import { loadEnv } from '../config/env';
import { createDb } from '../persistence/db';
import { assertMigrationResult, createMigrator } from '../persistence/migrator';

const direction = process.argv[2];
if (direction !== 'up' && direction !== 'down') {
  console.error('Uso: migrate.ts up|down');
  process.exit(1);
}

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const migrator = createMigrator(db);

try {
  const result =
    direction === 'up' ? await migrator.migrateToLatest() : await migrator.migrateDown();
  for (const r of result.results ?? []) {
    console.log(`${r.status === 'Success' ? '✔' : '✘'} ${r.direction} ${r.migrationName}`);
  }
  if (!result.results?.length) console.log('No hay migraciones pendientes.');
  assertMigrationResult(result);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Fallo en la migración');
  process.exitCode = 1;
} finally {
  await db.destroy();
}
