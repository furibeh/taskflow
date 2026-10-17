import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/support/global-setup.ts'],
    // Todos los archivos comparten la base de datos de pruebas: nunca en paralelo (T034).
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
