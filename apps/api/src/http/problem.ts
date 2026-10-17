import type { DomainError } from '@taskflow/domain';
import { PROBLEM_CONTENT_TYPE, type ErrorCode, type ValidationIssueDto } from '@taskflow/contracts';
import type { FastifyReply } from 'fastify';

// Títulos genéricos en español; nunca incluyen detalles internos (FR-034).
const TITLES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Los datos enviados no son válidos',
  INVALID_LINK: 'Enlace no válido',
  TASK_NOT_FOUND: 'La tarea no existe',
  PERSON_NOT_FOUND: 'La persona no existe',
  ASSIGNEE_NOT_FOUND: 'La persona elegida no está en el equipo',
  PERSON_NAME_TAKEN: 'Ya existe una persona con ese nombre',
  ID_CONFLICT: 'Ya existe un elemento con ese identificador',
  UNDO_EXPIRED: 'Ya no se puede deshacer',
  NOT_FOUND: 'Recurso no encontrado',
  RATE_LIMITED: 'Demasiadas peticiones',
  SERVICE_UNAVAILABLE: 'Servicio no disponible',
  INTERNAL_ERROR: 'Error interno',
};

const DOMAIN_STATUS: Record<DomainError['code'], number> = {
  VALIDATION_ERROR: 400,
  TASK_NOT_FOUND: 404,
  PERSON_NOT_FOUND: 404,
  ASSIGNEE_NOT_FOUND: 422,
  PERSON_NAME_TAKEN: 409,
  ID_CONFLICT: 409,
  UNDO_EXPIRED: 410,
};

export interface ProblemExtras {
  readonly errors?: readonly ValidationIssueDto[];
  readonly requestId?: string;
}

export const problemBody = (status: number, code: ErrorCode, extras: ProblemExtras = {}) => ({
  type: 'about:blank',
  title: TITLES[code],
  status,
  code,
  ...extras,
});

export const sendProblem = (
  reply: FastifyReply,
  status: number,
  code: ErrorCode,
  extras: ProblemExtras = {},
): FastifyReply =>
  reply.code(status).type(PROBLEM_CONTENT_TYPE).send(problemBody(status, code, extras));

/** Error que transporta un DomainError hasta el manejador único de errores. */
export class DomainFailure extends Error {
  constructor(readonly domainError: DomainError) {
    super(domainError.code);
    this.name = 'DomainFailure';
  }
}

export const domainStatus = (error: DomainError): number => DOMAIN_STATUS[error.code];

export const domainExtras = (error: DomainError): ProblemExtras =>
  error.code === 'VALIDATION_ERROR' ? { errors: error.issues.map((i) => ({ ...i })) } : {};
