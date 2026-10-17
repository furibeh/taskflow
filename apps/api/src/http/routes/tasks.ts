import {
  CreateTaskRequestSchema,
  ListTasksResponseSchema,
  ProblemSchema,
  TaskIdParamsSchema,
  TaskSchema,
  UpdateTaskRequestSchema,
  type TaskDto,
} from '@taskflow/contracts';
import {
  createTask,
  getTask,
  listTasks,
  updateTask,
  type TaskDeps,
  type TaskView,
  type UpdateTaskInput,
} from '@taskflow/domain';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { currentBoard } from '../plugins/auth';
import { DomainFailure } from '../problem';

export const toTaskDto = (task: TaskView): TaskDto => ({
  id: task.id,
  title: task.title,
  description: task.description,
  status: task.status,
  assignee: task.assignee ? { id: task.assignee.id, name: task.assignee.name } : null,
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString(),
});

export const taskRoutes: FastifyPluginAsyncZod<{ deps: TaskDeps }> = async (app, { deps }) => {
  app.get(
    '/tasks',
    { schema: { response: { 200: ListTasksResponseSchema } } },
    async (request) => {
      const { items, counts } = await listTasks(deps, currentBoard(request).id);
      return { items: items.map(toTaskDto), counts };
    },
  );

  app.post(
    '/tasks',
    {
      schema: {
        body: CreateTaskRequestSchema,
        response: { 200: TaskSchema, 201: TaskSchema, '4xx': ProblemSchema },
      },
    },
    async (request, reply) => {
      const { id, title, description, assigneeId } = request.body;
      const result = await createTask(deps, currentBoard(request).id, {
        id,
        title,
        ...(description === undefined ? {} : { description }),
        ...(assigneeId === undefined ? {} : { assigneeId }),
      });
      if (!result.ok) throw new DomainFailure(result.error);
      return reply.code(result.value.replayed ? 200 : 201).send(toTaskDto(result.value.task));
    },
  );

  app.get(
    '/tasks/:taskId',
    { schema: { params: TaskIdParamsSchema, response: { 200: TaskSchema } } },
    async (request) => {
      const result = await getTask(deps, currentBoard(request).id, request.params.taskId);
      if (!result.ok) throw new DomainFailure(result.error);
      return toTaskDto(result.value);
    },
  );

  app.patch(
    '/tasks/:taskId',
    {
      schema: {
        params: TaskIdParamsSchema,
        body: UpdateTaskRequestSchema,
        response: { 200: TaskSchema, '4xx': ProblemSchema },
      },
    },
    async (request) => {
      // Solo se pasan al dominio los campos presentes (exactOptionalPropertyTypes).
      const input = Object.fromEntries(
        Object.entries(request.body).filter(([, value]) => value !== undefined),
      ) as UpdateTaskInput;
      const result = await updateTask(deps, currentBoard(request).id, request.params.taskId, input);
      if (!result.ok) throw new DomainFailure(result.error);
      return toTaskDto(result.value);
    },
  );
};
