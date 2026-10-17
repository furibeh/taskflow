import { BoardSchema, RegenerateAccessCodeResponseSchema } from '@taskflow/contracts';
import {
  getBoardDetails,
  regenerateAccessCode,
  type AccessCodeService,
  type BoardRepository,
  type Clock,
} from '@taskflow/domain';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { currentBoard } from '../plugins/auth';

export interface BoardRouteDeps {
  readonly boards: BoardRepository;
  readonly accessCodes: AccessCodeService;
  readonly clock: Clock;
}

export const boardRoutes: FastifyPluginAsyncZod<{ deps: BoardRouteDeps }> = async (app, { deps }) => {
  app.get('/board', { schema: { response: { 200: BoardSchema } } }, async (request) => {
    const board = await getBoardDetails(deps, currentBoard(request));
    return {
      id: board.id,
      name: board.name,
      accessCodeRotatedAt: board.accessCodeRotatedAt.toISOString(),
      taskCount: board.taskCount,
      personCount: board.personCount,
    };
  });

  // El código nuevo solo se devuelve en esta respuesta, que no debe guardarse en cachés (FR-028b).
  app.post(
    '/board/access-code/regenerate',
    { schema: { response: { 200: RegenerateAccessCodeResponseSchema } } },
    async (request, reply) => {
      const { accessCode, rotatedAt } = await regenerateAccessCode(deps, currentBoard(request).id);
      reply.header('cache-control', 'no-store');
      return { accessCode, rotatedAt: rotatedAt.toISOString() };
    },
  );
};
