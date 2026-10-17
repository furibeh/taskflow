import { RegenerateAccessCodeResponseSchema } from '@taskflow/contracts';
import { useMutation } from '@tanstack/react-query';
import { useApi } from './ApiContext';

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
