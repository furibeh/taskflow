import { validationError, type DomainError, type ValidationIssue } from '../shared/errors';
import { SEARCH_MAX } from '../shared/limits';
import { err, ok, type Result } from '../shared/result';
import { charLength, normalizeText } from '../shared/text';
import { TASK_STATUSES, type TaskStatus, type TaskView } from './task';
import type { TaskCriteria } from './task-repository';

export interface RawTaskCriteria {
  readonly assignee?: string | undefined;
  readonly statuses?: readonly string[] | undefined;
  readonly q?: string | undefined;
}

/** Valida y normaliza los criterios de búsqueda (FR-022–FR-024b). */
export const parseTaskCriteria = (raw: RawTaskCriteria): Result<TaskCriteria, DomainError> => {
  const issues: ValidationIssue[] = [];
  const criteria: { assignee?: string; statuses?: TaskStatus[]; text?: string } = {};

  if (raw.assignee) criteria.assignee = raw.assignee;

  if (raw.statuses && raw.statuses.length > 0) {
    const valid = raw.statuses.filter((s): s is TaskStatus => (TASK_STATUSES as readonly string[]).includes(s));
    if (valid.length !== raw.statuses.length) issues.push({ field: 'status', rule: 'invalid_value' });
    else criteria.statuses = [...new Set(valid)];
  }

  if (raw.q !== undefined) {
    const text = normalizeText(raw.q);
    if (charLength(text) > SEARCH_MAX) issues.push({ field: 'q', rule: 'too_long', limit: SEARCH_MAX });
    else if (text) criteria.text = text;
  }

  return issues.length > 0 ? err(validationError(...issues)) : ok(criteria);
};

/** Forma comparable: minúsculas y sin marcas diacríticas (equivale a `unaccent(lower(x))`). */
export const foldForSearch = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Regla de coincidencia de referencia; el repositorio SQL la implementa con unaccent (R12). */
export const matchesCriteria = (task: TaskView, criteria: TaskCriteria): boolean => {
  if (criteria.assignee === 'unassigned' && task.assigneeId !== null) return false;
  if (criteria.assignee && criteria.assignee !== 'unassigned' && task.assigneeId !== criteria.assignee) {
    return false;
  }
  if (criteria.statuses && !criteria.statuses.includes(task.status)) return false;
  if (criteria.text) {
    const needle = foldForSearch(criteria.text);
    if (!foldForSearch(task.title).includes(needle) && !foldForSearch(task.description).includes(needle)) {
      return false;
    }
  }
  return true;
};
