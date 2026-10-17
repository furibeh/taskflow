import { DESCRIPTION_MAX, SEARCH_MAX, TASK_STATUSES, TITLE_MAX, TITLE_MIN } from '@taskflow/domain';
import { z } from 'zod';
import { boundedText } from './text';

export { TASK_STATUSES };

export const TaskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatusDto = z.infer<typeof TaskStatusSchema>;

export const AssigneeSchema = z.strictObject({ id: z.uuid(), name: z.string() });

// Debe coincidir con components.schemas.Task de contracts/openapi.yaml.
export const TaskSchema = z.strictObject({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  status: TaskStatusSchema,
  assignee: AssigneeSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type TaskDto = z.infer<typeof TaskSchema>;

export const TaskTitleSchema = boundedText({ min: TITLE_MIN, max: TITLE_MAX });
export const TaskDescriptionSchema = boundedText({ min: 0, max: DESCRIPTION_MAX });

export const CreateTaskRequestSchema = z.strictObject({
  id: z.uuid(),
  title: TaskTitleSchema,
  description: TaskDescriptionSchema.optional(),
  assigneeId: z.uuid().nullable().optional(),
});
export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;

export const StatusCountsSchema = z.strictObject({
  pending: z.number().int().min(0),
  in_progress: z.number().int().min(0),
  done: z.number().int().min(0),
});

export const ListTasksResponseSchema = z.strictObject({
  items: z.array(TaskSchema),
  counts: StatusCountsSchema,
});
export type ListTasksResponse = z.infer<typeof ListTasksResponseSchema>;

export const TaskIdParamsSchema = z.strictObject({ taskId: z.uuid() });

/** PATCH /tasks/{id}: solo se modifican los campos presentes; al menos uno (minProperties 1). */
export const UpdateTaskRequestSchema = z
  .strictObject({
    title: TaskTitleSchema.optional(),
    description: TaskDescriptionSchema.optional(),
    status: TaskStatusSchema.optional(),
    assigneeId: z.uuid().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'required',
    params: { rule: 'required' },
    path: [],
  });
export type UpdateTaskRequest = z.infer<typeof UpdateTaskRequestSchema>;

const asArray = (value: unknown) => (value === undefined || Array.isArray(value) ? value : [value]);

/** GET /tasks: assignee = UUID o "unassigned"; status repetible; q literal de hasta 100 caracteres. */
export const ListTasksQuerySchema = z.strictObject({
  assignee: z.union([z.uuid(), z.literal('unassigned')]).optional(),
  status: z.preprocess(asArray, z.array(TaskStatusSchema).optional()),
  q: boundedText({ min: 0, max: SEARCH_MAX }).optional(),
});
export type ListTasksQuery = z.infer<typeof ListTasksQuerySchema>;

export const DeleteTaskResponseSchema = z.strictObject({
  id: z.uuid(),
  /** Límite del servidor (borrado + 15 s); la interfaz ofrece "Deshacer" 10 s. */
  undoUntil: z.iso.datetime(),
});
export type DeleteTaskResponse = z.infer<typeof DeleteTaskResponseSchema>;
