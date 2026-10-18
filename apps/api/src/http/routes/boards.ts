import {
  CreateBoardRequestSchema,
  CreatedBoardSchema,
  CreatedBoardWithCodeSchema,
  ProblemSchema,
  PublicConfigSchema,
} from '@taskflow/contracts';
import { createBoard, type AccessCodeService, type BoardRepository, type Clock } from '@taskflow/domain';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { DomainFailure, sendProblem } from '../problem';
import { FixedWindowLimiter } from '../rate-limiter';

export interface BoardCreationOptions {
  /** false: la web no ofrece crear tableros y la API responde 403 (FR-106). */
  readonly enabled: boolean;
  /** Creaciones nuevas por IP y hora (FR-105). */
  readonly perHour: number;
}

export interface PublicBoardRouteDeps {
  readonly boards: BoardRepository;
  readonly accessCodes: AccessCodeService;
  readonly clock: Clock;
  readonly creation: BoardCreationOptions;
}

const HOUR_MS = 60 * 60 * 1000;

/** Rutas sin autenticación (plan D12, D16): no leen ni modifican ningún tablero existente. */
export const publicBoardRoutes: FastifyPluginAsyncZod<{ deps: PublicBoardRouteDeps }> = async (app, { deps }) => {
  const created = new FixedWindowLimiter(deps.creation.perHour, HOUR_MS);

  app.get('/public-config', { schema: { response: { 200: PublicConfigSchema } } }, async () => ({
    boardCreationEnabled: deps.creation.enabled,
  }));

  app.post(
    '/boards',
    {
      schema: {
        body: CreateBoardRequestSchema,
        response: { 200: CreatedBoardSchema, 201: CreatedBoardWithCodeSchema, '4xx': ProblemSchema },
      },
      // Antes de validar el cuerpo: con la creación desactivada o el límite agotado no se procesa
      // nada más (research R18).
      onRequest: async (request, reply) => {
        if (!deps.creation.enabled) return sendProblem(reply, 403, 'BOARD_CREATION_DISABLED');
        if (created.isBlocked(request.ip)) {
          reply.header('retry-after', String(created.retryAfterSeconds(request.ip)));
          return sendProblem(reply, 429, 'BOARD_CREATION_LIMITED');
        }
      },
    },
    async (request, reply) => {
      const result = await createBoard(deps, request.body);
      if (!result.ok) throw new DomainFailure(result.error);

      // El código solo sale del servidor en la respuesta 201, que no debe guardarse (FR-103).
      reply.header('cache-control', 'no-store');
      const { board } = result.value;
      if (!result.value.created) return reply.code(200).send({ id: board.id, name: board.name });
      // Solo cuentan las creaciones nuevas, no las repeticiones ni las peticiones inválidas.
      created.hit(request.ip);
      return reply.code(201).send({ id: board.id, name: board.name, accessCode: result.value.accessCode });
    },
  );
};
