import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectMatchesContract } from '../contract/openapi';
import { buildTestApp, type TestApp } from '../support/test-app';

describe('POST /api/v1/board/access-code/regenerate (FR-028b)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await buildTestApp({ captureLogs: true });
  });

  beforeEach(async () => {
    await t.reset();
    t.logs.length = 0;
  });

  afterAll(async () => {
    await t.close();
  });

  it('devuelve un código nuevo una sola vez y el anterior deja de funcionar al instante', async () => {
    const oldCode = t.accessCode;
    t.clock.advance(60_000);
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/board/access-code/regenerate',
      headers: { authorization: `Bearer ${oldCode}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const { accessCode, rotatedAt } = res.json();
    expect(accessCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(accessCode).not.toBe(oldCode);
    expect(rotatedAt).toBe(t.clock.now().toISOString());
    expectMatchesContract('regenerateAccessCode', 200, res.json());

    const withOld = await t.app.inject({
      method: 'GET',
      url: '/api/v1/board',
      headers: { authorization: `Bearer ${oldCode}` },
    });
    expect(withOld.statusCode).toBe(401);
    expect(withOld.json()).toMatchObject({ code: 'INVALID_LINK' });

    const withNew = await t.app.inject({
      method: 'GET',
      url: '/api/v1/board',
      headers: { authorization: `Bearer ${accessCode}` },
    });
    expect(withNew.statusCode).toBe(200);
    expect(withNew.json().accessCodeRotatedAt).toBe(rotatedAt);
  });

  it('ni las cabeceras ni los logs contienen el código anterior o el nuevo', async () => {
    const oldCode = t.accessCode;
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/board/access-code/regenerate',
      headers: { authorization: `Bearer ${oldCode}` },
    });
    const { accessCode } = res.json();
    await t.app.inject({ method: 'GET', url: '/api/v1/board', headers: { authorization: `Bearer ${oldCode}` } });

    const headers = JSON.stringify(res.headers);
    const logs = t.logs.join('\n');
    expect(t.logs.length).toBeGreaterThan(0);
    for (const code of [oldCode, accessCode]) {
      expect(headers).not.toContain(code);
      expect(logs).not.toContain(code);
    }
    expect(String(res.headers['content-security-policy'])).toContain("connect-src 'self'");
  });

  it('sin un código válido no se puede regenerar', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/board/access-code/regenerate',
      headers: { authorization: 'Bearer incorrecto' },
    });
    expect(res.statusCode).toBe(401);
    expectMatchesContract('regenerateAccessCode', 401, res.json());
  });
});
