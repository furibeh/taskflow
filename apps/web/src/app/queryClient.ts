import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';

/** Consultas con un reintento ante fallos de red; las mutaciones nunca se reintentan solas (FR-021a). */
export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          failureCount < 1 && !(error instanceof ApiError && error.status !== null && error.status < 500),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
