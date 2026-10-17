import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../../src/config/env';

const base = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' };

describe('configuración de límites de peticiones', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('usa 300/60/20 por defecto', () => {
    const env = loadEnv({ ...base });
    expect([env.RATE_LIMIT_GLOBAL, env.RATE_LIMIT_WRITES, env.RATE_LIMIT_UNAUTHORIZED]).toEqual([300, 60, 20]);
  });

  it('permite subir los límites', () => {
    expect(loadEnv({ ...base, RATE_LIMIT_WRITES: '10000' }).RATE_LIMIT_WRITES).toBe(10_000);
  });

  it.each(['0', '-1', 'false', 'off'])('no permite desactivarlos (RATE_LIMIT_WRITES=%s)', (value) => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as never);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => loadEnv({ ...base, RATE_LIMIT_WRITES: value })).toThrow('exit 1');
    expect(exit).toHaveBeenCalledWith(1);
    expect(log.mock.calls.join(' ')).not.toContain('postgres://');
  });
});
