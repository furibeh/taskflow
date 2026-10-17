import { migrateToLatest } from '../../src/persistence/migrator';
import { createTestDb } from './test-db';

/** Aplica las migraciones una vez antes de todas las pruebas de la API. */
export default async function setup(): Promise<void> {
  const db = createTestDb();
  try {
    await migrateToLatest(db);
  } finally {
    await db.destroy();
  }
}
