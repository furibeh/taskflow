import { BoardSchema } from '@taskflow/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { currentBoard } from '../plugins/auth';

export const boardRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/board', { schema: { response: { 200: BoardSchema } } }, async (request) => {
    const board = currentBoard(request);
    return { id: board.id, accessCodeRotatedAt: board.accessCodeRotatedAt.toISOString() };
  });
};
