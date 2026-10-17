import type { ValidationIssueDto } from '@taskflow/contracts';
import type { FastifyError, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import {
  hasZodFastifySchemaValidationErrors,
  type ZodFastifySchemaValidationError,
} from 'fastify-type-provider-zod';
import { DomainFailure, domainExtras, domainStatus, sendProblem } from '../problem';

const BODY_LIMIT_BYTES = 16 * 1024;

type Params = Record<string, unknown>;

/** Traduce un issue de Zod al formato {field, rule, limit} del contrato. */
const toIssue = (
  e: ZodFastifySchemaValidationError,
  context: string | undefined,
): ValidationIssueDto => {
  const params = (e.params ?? {}) as Params;
  const path = e.instancePath.replace(/^\//, '').replace(/\//g, '.');
  const field = path || context || 'body';
  const limit = (key: string): { limit?: number } =>
    typeof params[key] === 'number' || typeof params[key] === 'bigint'
      ? { limit: Number(params[key]) }
      : {};

  switch (e.keyword) {
    case 'unrecognized_keys': {
      const keys = (params.keys as string[] | undefined) ?? [];
      return { field: path ? `${path}.${keys[0] ?? ''}` : (keys[0] ?? field), rule: 'unknown_field' };
    }
    case 'too_big':
      return { field, rule: 'too_long', ...limit('maximum') };
    case 'too_small':
      return { field, rule: 'too_short', ...limit('minimum') };
    case 'invalid_type':
      return { field, rule: /received undefined/.test(e.message ?? '') ? 'required' : 'invalid_format' };
    case 'invalid_format':
      return { field, rule: 'invalid_format' };
    case 'custom': {
      const custom = (params.params ?? {}) as Params;
      const rule = custom.rule as ValidationIssueDto['rule'] | undefined;
      return { field, rule: rule ?? 'invalid_value', ...(typeof custom.limit === 'number' ? { limit: custom.limit } : {}) };
    }
    default:
      return { field, rule: 'invalid_value' };
  }
};

export const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  app.setNotFoundHandler((_request, reply) => sendProblem(reply, 404, 'NOT_FOUND'));

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const context = (error as { validationContext?: string }).validationContext;
      return sendProblem(reply, 400, 'VALIDATION_ERROR', {
        errors: error.validation.map((e) => toIssue(e, context)),
      });
    }
    if (error instanceof DomainFailure) {
      return sendProblem(reply, domainStatus(error.domainError), error.domainError.code, domainExtras(error.domainError));
    }
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return sendProblem(reply, 413, 'VALIDATION_ERROR', {
        errors: [{ field: 'body', rule: 'too_long', limit: BODY_LIMIT_BYTES }],
      });
    }
    if (error.statusCode === 429) {
      return sendProblem(reply, 429, 'RATE_LIMITED');
    }
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      // JSON mal formado, tipo de contenido no soportado, etc.
      return sendProblem(reply, 400, 'VALIDATION_ERROR', {
        errors: [{ field: 'body', rule: 'invalid_format' }],
      });
    }
    request.log.error({ err: error }, 'error no controlado');
    return sendProblem(reply, 500, 'INTERNAL_ERROR', { requestId: request.id });
  });
});
