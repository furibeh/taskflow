import {
  DeletePersonResponseSchema,
  ListPeopleResponseSchema,
  PersonSchema,
  type CreatePersonRequest,
} from '@taskflow/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './ApiContext';
import { tasksKey } from './tasks';

export const peopleKey = ['people'] as const;

export const usePeople = () => {
  const api = useApi();
  return useQuery({
    queryKey: peopleKey,
    queryFn: async () => (await api.request('/v1/people', { schema: ListPeopleResponseSchema })).items,
  });
};

export const useCreatePerson = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePersonRequest) =>
      api.request('/v1/people', { method: 'POST', body: input, schema: PersonSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKey }),
  });
};

/** Quitar a una persona también cambia tareas (quedan sin asignar): se recargan ambas listas. */
export const useDeletePerson = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.request(`/v1/people/${id}`, { method: 'DELETE', schema: DeletePersonResponseSchema }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: peopleKey }),
        queryClient.invalidateQueries({ queryKey: tasksKey }),
      ]),
  });
};
