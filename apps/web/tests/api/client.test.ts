import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, createApiClient } from '../../src/api/client';

const okSchema = z.object({ value: z.number() });

const jsonResponse = (status: number, body: unknown, contentType = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });

describe('cliente HTTP', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let onInvalidLink: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    fetchMock = vi.fn();
    onInvalidLink = vi.fn<() => void>();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const client = () =>
    createApiClient({
      getAccessCode: () => 'codigo-secreto',
      fetchImpl: fetchMock as unknown as typeof fetch,
      onInvalidLink,
    });

  it('envía Authorization: Bearer <código> y devuelve el cuerpo validado', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { value: 1 }));
    const result = await client().request('/v1/x', { schema: okSchema });

    expect(result).toEqual({ value: 1 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/x');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer codigo-secreto');
  });

  it('serializa el cuerpo JSON y los parámetros de consulta repetidos', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { value: 2 }));
    await client().request('/v1/x', {
      method: 'POST',
      body: { a: 1 },
      query: { status: ['pending', 'done'], q: 'hola', empty: undefined },
      schema: okSchema,
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/x?status=pending&status=done&q=hola');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  it('aborta a los 10 s y lanza ApiError TIMEOUT', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const pending = client().request('/v1/x', { schema: okSchema });
    const assertion = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it('un fallo de red lanza ApiError NETWORK', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(client().request('/v1/x', { schema: okSchema })).rejects.toMatchObject({
      code: 'NETWORK',
    });
  });

  it('convierte problem+json en ApiError con código y errores por campo', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        400,
        {
          type: 'about:blank',
          title: 'Los datos enviados no son válidos',
          status: 400,
          code: 'VALIDATION_ERROR',
          errors: [{ field: 'title', rule: 'too_short', limit: 1 }],
        },
        'application/problem+json',
      ),
    );
    const error = await client()
      .request('/v1/x', { schema: okSchema })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
      errors: [{ field: 'title', rule: 'too_short', limit: 1 }],
    });
  });

  it('avisa de enlace no válido ante INVALID_LINK', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        401,
        { type: 'about:blank', title: 'Enlace no válido', status: 401, code: 'INVALID_LINK' },
        'application/problem+json',
      ),
    );
    await expect(client().request('/v1/x', { schema: okSchema })).rejects.toMatchObject({
      code: 'INVALID_LINK',
    });
    expect(onInvalidLink).toHaveBeenCalledOnce();
  });

  it('rechaza respuestas que no cumplen el esquema esperado', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { value: 'no es un número' }));
    await expect(client().request('/v1/x', { schema: okSchema })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('un 5xx sin problem+json se trata como INTERNAL_ERROR', async () => {
    fetchMock.mockResolvedValue(new Response('Bad gateway', { status: 502 }));
    await expect(client().request('/v1/x', { schema: okSchema })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 502,
    });
  });
});
