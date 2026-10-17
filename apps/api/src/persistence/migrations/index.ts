import type { Migration, MigrationProvider } from 'kysely/migration';
import * as m0001 from './0001_extensions';
import * as m0002 from './0002_board';
import * as m0003 from './0003_person';
import * as m0004 from './0004_task';

// Proveedor estático: las migraciones se importan explícitamente, de modo que funcionan igual
// en la CLI, en las pruebas y en el contenedor, sin depender de rutas del sistema de archivos.
const migrations: Record<string, Migration> = {
  '0001_extensions': m0001,
  '0002_board': m0002,
  '0003_person': m0003,
  '0004_task': m0004,
};

export const migrationProvider: MigrationProvider = {
  getMigrations: async () => migrations,
};
