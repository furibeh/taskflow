import { CreateBoardResponseSchema, PublicConfigSchema, type CreateBoardRequest } from '@taskflow/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useApi } from './ApiContext';

export const publicConfigKey = ['public-config'] as const;

/** Configuración pública: si se pueden crear tableros desde la web (FR-106). */
export const usePublicConfig = () => {
  const api = useApi();
  return useQuery({
    queryKey: publicConfigKey,
    queryFn: () => api.request('/v1/public-config', { schema: PublicConfigSchema, auth: false }),
  });
};

/** 201 trae el código (única vez que sale del servidor); 200 es una repetición sin código (D13). */
export const useCreateBoard = () => {
  const api = useApi();
  return useMutation({
    mutationFn: (input: CreateBoardRequest) =>
      api.request('/v1/boards', { method: 'POST', body: input, schema: CreateBoardResponseSchema, auth: false }),
  });
};
