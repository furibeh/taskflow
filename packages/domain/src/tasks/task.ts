import type { ValidationIssue } from '../shared/errors';
import { DESCRIPTION_MAX, TITLE_MAX, TITLE_MIN } from '../shared/limits';
import { err, ok, type Result } from '../shared/result';
import { checkLength, normalizeText } from '../shared/text';

export const TASK_STATUSES = ['pending', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  readonly id: string;
  readonly boardId: string;
  readonly title: string;
  readonly description: string;
  readonly status: TaskStatus;
  readonly assigneeId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Assignee {
  readonly id: string;
  readonly name: string;
}

/** Vista de lectura: la tarea con el nombre de su responsable. */
export interface TaskView extends Task {
  readonly assignee: Assignee | null;
}

/** Título obligatorio: 1–200 caracteres tras normalizar (FR-009). */
export const parseTaskTitle = (raw: string): Result<string, ValidationIssue> => {
  const title = normalizeText(raw);
  const issue = checkLength(title, { min: TITLE_MIN, max: TITLE_MAX });
  return issue ? err({ field: 'title', ...issue }) : ok(title);
};

/** Descripción opcional: hasta 5.000 caracteres tras normalizar (FR-009). */
export const parseTaskDescription = (raw: string | undefined): Result<string, ValidationIssue> => {
  const description = normalizeText(raw ?? '');
  const issue = checkLength(description, { min: 0, max: DESCRIPTION_MAX });
  return issue ? err({ field: 'description', ...issue }) : ok(description);
};
