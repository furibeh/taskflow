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

  it('TRUST_PROXY acepta una lista explícita de IP o rangos CIDR', () => {
    expect(loadEnv({ ...base }).TRUST_PROXY).toEqual([]);
    expect(loadEnv({ ...base, TRUST_PROXY: '127.0.0.1, ::1,172.28.0.0/24' }).TRUST_PROXY).toEqual([
      '127.0.0.1',
      '::1',
      '172.28.0.0/24',
    ]);
  });

  it.each(['true', '*', '1', 'loopback', '10.0.0.0/99', '127.0.0.1,'])(
    'TRUST_PROXY rechaza valores que confiarían demasiado (%s)',
    (value) => {
      vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`exit ${code}`);
      }) as never);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => loadEnv({ ...base, TRUST_PROXY: value })).toThrow('exit 1');
    },
  );
});
