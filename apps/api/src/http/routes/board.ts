import {
  BoardSchema,
  ProblemSchema,
  RegenerateAccessCodeResponseSchema,
  RenameBoardRequestSchema,
  type BoardDto,
} from '@taskflow/contracts';
import {
  deleteBoard,
  getBoardDetails,
  regenerateAccessCode,
  renameBoard,
  type AccessCodeService,
  type Board,
  type BoardRepository,
  type BoardStats,
  type Clock,
} from '@taskflow/domain';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { currentBoard } from '../plugins/auth';
import { DomainFailure } from '../problem';

export interface BoardRouteDeps {
  readonly boards: BoardRepository;
  readonly accessCodes: AccessCodeService;
  readonly clock: Clock;
}

const toBoardDto = (board: Board & BoardStats): BoardDto => ({
  id: board.id,
  name: board.name,
  accessCodeRotatedAt: board.accessCodeRotatedAt.toISOString(),
  taskCount: board.taskCount,
  personCount: board.personCount,
});

export const boardRoutes: FastifyPluginAsyncZod<{ deps: BoardRouteDeps }> = async (app, { deps }) => {
  app.get('/board', { schema: { response: { 200: BoardSchema } } }, async (request) =>
    toBoardDto(await getBoardDetails(deps, currentBoard(request))),
  );

  app.patch(
    '/board',
    { schema: { body: RenameBoardRequestSchema, response: { 200: BoardSchema, '4xx': ProblemSchema } } },
    async (request) => {
      const result = await renameBoard(deps, currentBoard(request).id, request.body.name);
      if (!result.ok) throw new DomainFailure(result.error);
      return toBoardDto(await getBoardDetails(deps, result.value));
    },
  );

  // Borrado definitivo, sin deshacer (D14); el código deja de funcionar al responder (FR-116).
  app.delete('/board', async (request, reply) => {
    const result = await deleteBoard(deps, currentBoard(request).id);
    if (!result.ok) throw new DomainFailure(result.error);
    return reply.code(204).send();
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
