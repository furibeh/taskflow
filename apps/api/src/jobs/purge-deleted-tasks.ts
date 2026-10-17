import { purgeDeletedTasks, type Clock, type TaskRepository } from '@taskflow/domain';
import type { FastifyBaseLogger } from 'fastify';

const INTERVAL_MS = 60_000;

/**
 * Cada minuto elimina físicamente las tareas borradas hace más de 15 s, para que el borrado sea
 * realmente definitivo (R9). Válido con una sola instancia de la API.
 */
export const startPurgeJob = (
  deps: { readonly tasks: TaskRepository; readonly clock: Clock },
  log: FastifyBaseLogger,
): (() => void) => {
  const timer = setInterval(() => {
    purgeDeletedTasks(deps)
      .then((purged) => {
        if (purged > 0) log.info({ purged }, 'tareas borradas eliminadas definitivamente');
      })
      .catch((error: unknown) => log.error({ err: error }, 'fallo al purgar tareas borradas'));
  }, INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
};
