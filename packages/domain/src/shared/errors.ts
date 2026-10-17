export type ValidationRule =
  | 'required'
  | 'too_short'
  | 'too_long'
  | 'invalid_value'
  | 'invalid_format'
  | 'unknown_field';

export interface ValidationIssue {
  readonly field: string;
  readonly rule: ValidationRule;
  readonly limit?: number;
}

export type DomainError =
  | { readonly code: 'VALIDATION_ERROR'; readonly issues: readonly ValidationIssue[] }
  | { readonly code: 'TASK_NOT_FOUND' }
  | { readonly code: 'PERSON_NOT_FOUND' }
  | { readonly code: 'ASSIGNEE_NOT_FOUND' }
  | { readonly code: 'PERSON_NAME_TAKEN' }
  | { readonly code: 'ID_CONFLICT' }
  | { readonly code: 'UNDO_EXPIRED' }
  | { readonly code: 'BOARD_NOT_FOUND' };

export type DomainErrorCode = DomainError['code'];

export const validationError = (...issues: ValidationIssue[]): DomainError => ({
  code: 'VALIDATION_ERROR',
  issues,
});
