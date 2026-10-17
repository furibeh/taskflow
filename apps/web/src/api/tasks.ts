import {
  ListTasksResponseSchema,
  TaskSchema,
  type CreateTaskRequest,
  type TaskDto,
} from '@taskflow/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
