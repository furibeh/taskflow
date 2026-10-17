import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://taskflow:change-me@localhost:5433/taskflow_test';

/** Archivo local (ignorado por git) donde la preparación global deja el código de acceso. */
export const ACCESS_CODE_FILE = join(dirname(fileURLToPath(import.meta.url)), '../../.auth/access-code.txt');
