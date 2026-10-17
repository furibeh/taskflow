import type { PersonLookup } from '../people/person-lookup';
import type { Clock } from '../shared/clock';
import { validationError, type DomainError, type ValidationIssue } from '../shared/errors';
import { err, ok, type Result } from '../shared/result';
import {
  parseTaskDescription,
  parseTaskTitle,
  TASK_STATUSES,
  type TaskStatus,
  type TaskView,
} from '../tasks/task';
import type { TaskCriteria, TaskRepository } from '../tasks/task-repository';

export interface TaskDeps {
  readonly tasks: TaskRepository;
  readonly people: PersonLookup;
  readonly clock: Clock;
}

export interface CreateTaskInput {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly assigneeId?: string | null;
}

export interface CreateTaskOutcome {
  readonly task: TaskView;
  /** true si la petición repetía una creación ya hecha (FR-011). */
  readonly replayed: boolean;
}

/** Crea una tarea en Pendiente (FR-007, FR-008). Idempotente por id (R10). */
export const createTask = async (
  deps: TaskDeps,
  boardId: string,
  input: CreateTaskInput,
): Promise<Result<CreateTaskOutcome, DomainError>> => {
  const title = parseTaskTitle(input.title);
  const description = parseTaskDescription(input.description);
  const issues: ValidationIssue[] = [];
  if (!title.ok) issues.push(title.error);
  if (!description.ok) issues.push(description.error);
  if (!title.ok || !description.ok) return err(validationError(...issues));

  const assigneeId = input.assigneeId ?? null;
  const existing = await deps.tasks.findById(boardId, input.id);
  if (existing) {
    const same =
      existing.title === title.value &&
      existing.description === description.value &&
      existing.assigneeId === assigneeId;
    return same ? ok({ task: existing, replayed: true }) : err({ code: 'ID_CONFLICT' });
  }

  if (assigneeId !== null && !(await deps.people.existsInBoard(boardId, assigneeId))) {
    return err({ code: 'ASSIGNEE_NOT_FOUND' });
  }

  const now = deps.clock.now();
  const outcome = await deps.tasks.insert({
    id: input.id,
    boardId,
    title: title.value,
    description: description.value,
    status: 'pending',
    assigneeId,
    createdAt: now,
    updatedAt: now,
  });
  if (outcome === 'id_taken') return err({ code: 'ID_CONFLICT' });

  const created = await deps.tasks.findById(boardId, input.id);
  if (!created) return err({ code: 'TASK_NOT_FOUND' });
  return ok({ task: created, replayed: false });
};

export type StatusCounts = Record<TaskStatus, number>;

export interface TaskList {
  readonly items: TaskView[];
  /** Tareas visibles por columna (FR-003). */
  readonly counts: StatusCounts;
}

export const listTasks = async (
  deps: Pick<TaskDeps, 'tasks'>,
  boardId: string,
  criteria: TaskCriteria = {},
): Promise<TaskList> => {
  const items = await deps.tasks.list(boardId, criteria);
  const counts = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as StatusCounts;
  for (const task of items) counts[task.status] += 1;
  return { items, counts };
};

export const getTask = async (
  deps: Pick<TaskDeps, 'tasks'>,
  boardId: string,
  id: string,
): Promise<Result<TaskView, DomainError>> => {
  const task = await deps.tasks.findById(boardId, id);
  return task ? ok(task) : err({ code: 'TASK_NOT_FOUND' });
};
