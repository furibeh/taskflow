import { z } from 'zod';

// Debe coincidir con components.schemas.Problem de contracts/openapi.yaml.
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_LINK',
  'TASK_NOT_FOUND',
  'PERSON_NOT_FOUND',
  'ASSIGNEE_NOT_FOUND',
  'PERSON_NAME_TAKEN',
  'ID_CONFLICT',
  'UNDO_EXPIRED',
  'NOT_FOUND',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const VALIDATION_RULES = [
  'required',
  'too_short',
  'too_long',
  'invalid_value',
  'invalid_format',
  'unknown_field',
] as const;

export const ValidationIssueSchema = z.object({
  field: z.string(),
  rule: z.enum(VALIDATION_RULES),
  limit: z.number().int().optional(),
});
export type ValidationIssueDto = z.infer<typeof ValidationIssueSchema>;

export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: ErrorCodeSchema,
  requestId: z.string().optional(),
  errors: z.array(ValidationIssueSchema).optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';
