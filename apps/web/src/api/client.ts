import {
  CLIENT_TIMEOUT_MS,
  ProblemSchema,
  type ErrorCode,
  type ValidationIssueDto,
} from '@taskflow/contracts';
import type { ZodType } from 'zod';

export type ClientErrorCode = ErrorCode | 'TIMEOUT' | 'NETWORK' | 'INVALID_RESPONSE';

export class ApiError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    readonly status: number | null,
    readonly errors: readonly ValidationIssueDto[] = [],
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

type QueryValue = string | readonly string[] | undefined;

export interface RequestOptions<T> {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  readonly query?: Readonly<Record<string, QueryValue>>;
  readonly schema: ZodType<T>;
  /** false en las rutas públicas: nunca se envía el código de acceso (plan D16). */
  readonly auth?: false;
}

export interface ApiClientConfig {
  readonly getAccessCode: () => string | null;
  readonly onInvalidLink?: () => void;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export interface ApiClient {
  request<T>(path: string, options: RequestOptions<T>): Promise<T>;
}

const buildUrl = (path: string, query: RequestOptions<unknown>['query']): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    for (const v of typeof value === 'string' ? [value] : value) params.append(key, v);
  }
  const qs = params.toString();
  return `/api${path}${qs ? `?${qs}` : ''}`;
};

const parseProblem = async (response: Response): Promise<ApiError> => {
  const fallback = response.status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR';
  try {
    const problem = ProblemSchema.safeParse(await response.json());
    if (problem.success) {
      return new ApiError(problem.data.code, response.status, problem.data.errors ?? []);
    }
  } catch {
    // Cuerpo no JSON (p. ej., error de un proxy): se usa el código genérico.
  }
  return new ApiError(fallback, response.status);
};

export const createApiClient = (config: ApiClientConfig): ApiClient => {
  const fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
  const timeoutMs = config.timeoutMs ?? CLIENT_TIMEOUT_MS;

  return {
    async request<T>(path: string, options: RequestOptions<T>): Promise<T> {
      const headers = new Headers({ accept: 'application/json' });
      const code = options.auth === false ? null : config.getAccessCode();
      if (code) headers.set('authorization', `Bearer ${code}`);
      if (options.body !== undefined) headers.set('content-type', 'application/json');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(buildUrl(path, options.query), {
          method: options.method ?? 'GET',
          headers,
          body: options.body === undefined ? null : JSON.stringify(options.body),
          signal: controller.signal,
        });
      } catch {
        throw new ApiError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK', null);
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        const error = await parseProblem(response);
        if (error.code === 'INVALID_LINK' && options.auth !== false) config.onInvalidLink?.();
        throw error;
      }

      let data: unknown;
      if (response.status !== 204) {
        try {
          data = await response.json();
        } catch {
          throw new ApiError('INVALID_RESPONSE', response.status);
        }
      }
      const parsed = options.schema.safeParse(data);
      if (!parsed.success) throw new ApiError('INVALID_RESPONSE', response.status);
      return parsed.data;
    },
  };
};
