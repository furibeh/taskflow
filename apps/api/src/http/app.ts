import { randomUUID } from 'node:crypto';
import type { Clock } from '@taskflow/domain';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Kysely } from 'kysely';
import type { Database } from '../persistence/db';
import { KyselyBoardRepository } from '../persistence/repositories/board-repository';
import { KyselyPersonRepository } from '../persistence/repositories/person-repository';
import { KyselyTaskRepository } from '../persistence/repositories/task-repository';
import { nodeAccessCodeService } from '../security/access-code';
import { authPlugin } from './plugins/auth';
import { errorHandlerPlugin } from './plugins/error-handler';
import { DEFAULT_RATE_LIMITS, securityPlugin, type RateLimits } from './plugins/security';
import { boardRoutes } from './routes/board';
import { publicBoardRoutes, type BoardCreationOptions } from './routes/boards';
import { healthRoutes } from './routes/health';
import { peopleRoutes } from './routes/people';
import { taskRoutes } from './routes/tasks';

export interface AppDeps {
  readonly db: Kysely<Database>;
  readonly clock: Clock;
  readonly logger?: FastifyServerOptions['logger'];
  /** null desactiva los límites; solo lo usan las pruebas en proceso, nunca la configuración. */
  readonly rateLimits?: RateLimits | null;
  /** IP o rangos CIDR de los proxies de confianza (X-Forwarded-For). Vacío = ninguno. */
  readonly trustProxy?: readonly string[];
  /** Creación de tableros desde la web (plan D12); por defecto, activada con 10 por IP y hora. */
  readonly boardCreation?: BoardCreationOptions;
}

export const BODY_LIMIT_BYTES = 16 * 1024;

/** Construye la aplicación sin escuchar en ningún puerto (la usan main.ts y las pruebas). */
export const buildApp = async (deps: AppDeps): Promise<FastifyInstance> => {
  const rateLimits = deps.rateLimits === undefined ? DEFAULT_RATE_LIMITS : deps.rateLimits;


  const app = Fastify({
    logger: deps.logger ?? false,
    bodyLimit: BODY_LIMIT_BYTES,
    genReqId: () => randomUUID(),
    // Solo se acepta X-Forwarded-For de proxies declarados explícitamente (plan D11).
    trustProxy: deps.trustProxy && deps.trustProxy.length > 0 ? [...deps.trustProxy] : false,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(errorHandlerPlugin);
  await app.register(securityPlugin, { rateLimits });

  const boards = new KyselyBoardRepository(deps.db);
  const people = new KyselyPersonRepository(deps.db);
  const taskDeps = { tasks: new KyselyTaskRepository(deps.db), people, clock: deps.clock };
  const peopleDeps = { people, clock: deps.clock };

  await app.register(
    async (api) => {
      await api.register(healthRoutes, { db: deps.db });
      await api.register(
        async (v1) => {
          // Ámbito público hermano del autenticado: el hook de auth no se aplica aquí (D16).
          await v1.register(publicBoardRoutes, {
            deps: {
              boards,
              accessCodes: nodeAccessCodeService,
              clock: deps.clock,
              creation: deps.boardCreation ?? { enabled: true, perHour: 10 },
            },
          });
          await v1.register(async (authed) => {
            await authed.register(authPlugin, {
              boards,
              accessCodes: nodeAccessCodeService,
              unauthorizedPerMinute: rateLimits?.unauthorized ?? null,
            });
            await authed.register(boardRoutes, {
              deps: { boards, accessCodes: nodeAccessCodeService, clock: deps.clock },
            });
            await authed.register(taskRoutes, { deps: taskDeps });
            await authed.register(peopleRoutes, { deps: peopleDeps });
          });
        },
        { prefix: '/v1' },
      );
    },
    { prefix: '/api' },
  );

  return app;
};

/** Opciones de log: pino estructurado sin la cabecera Authorization (R7, R17). */
export const loggerOptions = (level: string): FastifyServerOptions['logger'] => ({
  level,
  redact: { paths: ['req.headers.authorization'], censor: '[redactado]' },
});
