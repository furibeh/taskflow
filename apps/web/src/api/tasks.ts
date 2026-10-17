import {
  ListTasksResponseSchema,
  TaskSchema,
  type CreateTaskRequest,
  type TaskDto,
  type UpdateTaskRequest,
} from '@taskflow/contracts';
import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './ApiContext';

export const tasksKey = ['tasks'] as const;
const taskKey = (id: string) => ['task', id] as const;

export const useTasks = () => {
  const api = useApi();
  return useQuery({
    queryKey: tasksKey,
    queryFn: () => api.request('/v1/tasks', { schema: ListTasksResponseSchema }),
  });
};

export const useTask = (id: string | null, initialData?: TaskDto) => {
  const api = useApi();
  return useQuery({
    queryKey: taskKey(id ?? ''),
    queryFn: () => api.request(`/v1/tasks/${id}`, { schema: TaskSchema }),
    enabled: id !== null,
    initialData,
    retry: false,
  });
};

/**
 * Creación pesimista (FR-021): la mutación sigue pendiente hasta que el tablero se ha recargado
 * con la tarea confirmada por el servidor; no hay actualización optimista.
 */
export const useCreateTask = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskRequest) =>
      api.request('/v1/tasks', { method: 'POST', body: input, schema: TaskSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey }),
  });
};

const updateTaskKey = ['updateTask'] as const;

export interface UpdateTaskVariables {
  readonly id: string;
  readonly patch: UpdateTaskRequest;
}

/** Modificación pesimista: el tablero solo cambia tras la confirmación del servidor (FR-021). */
export const useUpdateTask = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: updateTaskKey,
    mutationFn: ({ id, patch }: UpdateTaskVariables) =>
      api.request(`/v1/tasks/${id}`, { method: 'PATCH', body: patch, schema: TaskSchema }),
    onSuccess: async (task) => {
      queryClient.setQueryData(['task', task.id], task);
      await queryClient.invalidateQueries({ queryKey: tasksKey });
    },
  });
};

/** true mientras haya una modificación de esa tarea pendiente de confirmar. */
export const useIsTaskSaving = (taskId: string): boolean =>
  useMutationState({
    filters: { mutationKey: updateTaskKey, status: 'pending' },
    select: (mutation) => (mutation.state.variables as UpdateTaskVariables | undefined)?.id,
  }).includes(taskId);
