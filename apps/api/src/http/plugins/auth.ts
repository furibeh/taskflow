import { resolveBoard, type AccessCodeService, type Board, type BoardRepository } from '@taskflow/domain';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { sendProblem } from '../problem';
import { FixedWindowLimiter } from '../rate-limiter';

declare module 'fastify' {
  interface FastifyRequest {
    board: Board | null;
  }
}

const BEARER = /^Bearer[ ]+([A-Za-z0-9_-]{1,256})$/;

export interface AuthOptions {
  readonly boards: BoardRepository;
  readonly accessCodes: AccessCodeService;
  /** Máximo de respuestas 401 por IP y minuto; null desactiva el límite. */
  readonly unauthorizedPerMinute: number | null;
}

/** Tablero resuelto por el plugin de autenticación; solo en rutas /api/v1. */
export const currentBoard = (request: FastifyRequest): Board => {
  if (!request.board) throw new Error('Ruta sin autenticación de tablero');
  return request.board;
};

/**
 * Resuelve el tablero a partir de `Authorization: Bearer <código>` (FR-028a). Cualquier fallo
 * produce la misma respuesta 401 genérica, sin indicar el motivo (FR-028c).
 */
export const authPlugin = fp<AuthOptions>(async (app: FastifyInstance, options) => {
  const failures =
    options.unauthorizedPerMinute === null
      ? null
      : new FixedWindowLimiter(options.unauthorizedPerMinute, 60_000);

  app.decorateRequest('board', null);

  app.addHook('onRequest', async (request, reply) => {
    if (failures?.isBlocked(request.ip)) {
      reply.header('retry-after', String(failures.retryAfterSeconds(request.ip)));
      return sendProblem(reply, 429, 'RATE_LIMITED');
    }

    const match = BEARER.exec(request.headers.authorization ?? '');
    const board = await resolveBoard(options, match?.[1]);
    if (!board) {
      failures?.hit(request.ip);
      return sendProblem(reply, 401, 'INVALID_LINK');
    }
    request.board = board;
  });
});
