import { systemClock } from '@taskflow/domain';
import { loadEnv } from './config/env';
import { buildApp, loggerOptions } from './http/app';
import { startPurgeJob } from './jobs/purge-deleted-tasks';
import { createDb } from './persistence/db';
import { KyselyTaskRepository } from './persistence/repositories/task-repository';

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
  trustProxy: env.TRUST_PROXY,
});

const stopPurge = startPurgeJob({ tasks: new KyselyTaskRepository(db), clock: systemClock }, app.log);

const shutdown = async (signal: string) => {
  app.log.info(`${signal} recibido, cerrando`);
  stopPurge();
  await app.close();
  await db.destroy();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ host: '0.0.0.0', port: env.API_PORT });
