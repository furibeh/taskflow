import { sql, type Kysely } from 'kysely';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Database } from '../../persistence/db';
import { sendProblem } from '../problem';

export const healthRoutes: FastifyPluginAsyncZod<{ db: Kysely<Database> }> = async (app, { db }) => {
  app.get(
    '/health',
    { schema: { response: { 200: z.object({ status: z.literal('ok') }) } } },
    async (request, reply) => {
      try {
        await sql`SELECT 1`.execute(db);
        return { status: 'ok' as const };
      } catch (error) {
        request.log.error({ err: error }, 'base de datos no disponible');
        return sendProblem(reply, 503, 'SERVICE_UNAVAILABLE');
      }
    },
  );
};
