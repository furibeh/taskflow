import { BoardSchema, RegenerateAccessCodeResponseSchema } from '@taskflow/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './ApiContext';

export const boardKey = ['board'] as const;

/** Tablero abierto: nombre para la cabecera y recuentos para la confirmación de borrado. */
export const useBoard = () => {
  const api = useApi();
  return useQuery({ queryKey: boardKey, queryFn: () => api.request('/v1/board', { schema: BoardSchema }) });
};

export const useRegenerateLink = () => {
  const api = useApi();
  return useMutation({
    mutationFn: () =>
      api.request('/v1/board/access-code/regenerate', {
        method: 'POST',
        schema: RegenerateAccessCodeResponseSchema,
      }),
  });
};

/** El nombre nuevo solo se muestra cuando el servidor confirma el guardado (FR-021). */
export const useRenameBoard = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.request('/v1/board', { method: 'PATCH', body: { name }, schema: BoardSchema }),
    onSuccess: (board) => queryClient.setQueryData(boardKey, board),
  });
};
