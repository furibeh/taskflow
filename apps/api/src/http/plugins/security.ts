import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { problemBody } from '../problem';

export interface RateLimits {
  /** Peticiones por IP y minuto en total. */
  readonly global: number;
  /** Escrituras (POST, PATCH, PUT, DELETE) por IP y minuto. */
  readonly writes: number;
  /** Respuestas 401 por IP y minuto (aplicado en el plugin de autenticación). */
  readonly unauthorized: number;
}

export const DEFAULT_RATE_LIMITS: RateLimits = { global: 300, writes: 60, unauthorized: 20 };

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Cabeceras de seguridad y límites de peticiones (research.md R8, plan.md D5). */
export const securityPlugin = fp<{ rateLimits: RateLimits | null }>(
  async (app: FastifyInstance, { rateLimits }) => {
    await app.register(helmet, {
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      referrerPolicy: { policy: 'no-referrer' },
    });

    if (!rateLimits) return;

    // Las escrituras comparten un contador propio, más estricto que el global.
    app.addHook('onRoute', (route) => {
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      if (methods.some((m) => WRITE_METHODS.has(m))) {
        route.config = {
          ...route.config,
          rateLimit: { max: rateLimits.writes, timeWindow: '1 minute', groupId: 'writes' },
        };
      }
    });

    await app.register(rateLimit, {
      global: true,
      max: rateLimits.global,
      timeWindow: '1 minute',
      // El plugin lanza este objeto como error; statusCode permite que el manejador único de
      // errores lo responda como 429 problem+json en lugar de como error inesperado.
      errorResponseBuilder: () => ({ statusCode: 429, ...problemBody(429, 'RATE_LIMITED') }),
    });
  },
);
