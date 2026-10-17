import { systemClock } from '@taskflow/domain';
import { loadEnv } from './config/env';
import { buildApp, loggerOptions } from './http/app';
import { createDb } from './persistence/db';

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const app = await buildApp({
  db,
  clock: systemClock,
  logger: loggerOptions(env.LOG_LEVEL),
  rateLimits: {
    global: env.RATE_LIMIT_GLOBAL,
    writes: env.RATE_LIMIT_WRITES,
    unauthorized: env.RATE_LIMIT_UNAUTHORIZED,
  },
});

const shutdown = async (signal: string) => {
  app.log.info(`${signal} recibido, cerrando`);
  await app.close();
  await db.destroy();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ host: '0.0.0.0', port: env.API_PORT });
