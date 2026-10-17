import { defineConfig, devices } from '@playwright/test';

// Por defecto los E2E levantan su propia API (puerto 3100) y web (puerto 5174) contra la base de
// datos de pruebas (`docker compose up -d db-test`), para no tocar los datos de desarrollo.
// Con E2E_BASE_URL se ejecutan contra un entorno ya arrancado.
const API_PORT = 3100;
const WEB_PORT = 5174;
const externalBaseUrl = process.env.E2E_BASE_URL;
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://taskflow:change-me@localhost:5433/taskflow_test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  globalSetup: './global-setup.ts',
  reporter: [['list']],
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile-320',
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 640 }, hasTouch: true },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : [
        {
          command: 'npm run start -w apps/api',
          cwd: '..',
          url: `http://localhost:${API_PORT}/api/health`,
          reuseExistingServer: false,
          env: {
            DATABASE_URL: testDatabaseUrl,
            API_PORT: String(API_PORT),
            PUBLIC_WEB_URL: `http://localhost:${WEB_PORT}`,
            LOG_LEVEL: 'warn',
            // Límites activos pero holgados: la batería E2E hace muchas escrituras seguidas.
            RATE_LIMIT_GLOBAL: '10000',
            RATE_LIMIT_WRITES: '10000',
            RATE_LIMIT_UNAUTHORIZED: '1000',
          },
        },
        {
          command: `npm run dev -w apps/web -- --port ${WEB_PORT} --strictPort`,
          cwd: '..',
          url: `http://localhost:${WEB_PORT}`,
          reuseExistingServer: false,
          env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
        },
      ],
});
