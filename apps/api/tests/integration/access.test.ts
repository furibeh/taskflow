import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectMatchesContract } from '../contract/openapi';
import { buildTestApp, type TestApp } from '../support/test-app';

describe('acceso por enlace secreto y base HTTP', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await buildTestApp();
  });

  beforeEach(async () => {
    await t.reset();
  });

  afterAll(async () => {
    await t.close();
  });

  it('GET /api/health responde sin autenticación', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    expectMatchesContract('getHealth', 200, res.json());
  });

  it('GET /api/v1/board con código válido devuelve el tablero', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/board', headers: t.authHeader() });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: t.boardId, name: 'Mi tablero', taskCount: 0, personCount: 0 });
    expectMatchesContract('getBoard', 200, res.json());
  });

  it('todos los accesos inválidos producen el mismo 401 genérico (FR-028c)', async () => {
    const otherCode = await t.createSecondBoardAndDeleteIt();
    const variants: Record<string, string>[] = [
      {},
      { authorization: 'Basic dXNlcjpwYXNz' },
      { authorization: 'Bearer' },
      { authorization: 'Bearer codigo-incorrecto' },
      { authorization: `Bearer ${otherCode}` },
    ];

    const bodies = await Promise.all(
      variants.map(async (headers) => {
        const res = await t.app.inject({ method: 'GET', url: '/api/v1/board', headers });
        expect(res.statusCode).toBe(401);
        expect(res.headers['content-type']).toContain('application/problem+json');
        return res.body;
      }),
    );

    expect(new Set(bodies).size).toBe(1);
    const problem = JSON.parse(bodies[0]!);
    expect(problem).toMatchObject({ code: 'INVALID_LINK', title: 'Enlace no válido', status: 401 });
    expectMatchesContract('getBoard', 401, problem);
    expect(bodies[0]).not.toContain('codigo-incorrecto');
    expect(bodies[0]).not.toContain(otherCode);
  });

  it('incluye cabeceras de seguridad', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/board', headers: t.authHeader() });
    const csp = String(res.headers['content-security-policy']);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('una ruta inexistente devuelve 404 NOT_FOUND en formato problem+json', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/no-existe', headers: t.authHeader() });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('un error inesperado devuelve 500 genérico con requestId, sin traza ni código de acceso', async () => {
    const broken = await buildTestApp({ brokenDatabase: true });
    try {
      const code = 'Abcdefghijklmnopqrstuvwxyz0123456789_-ABCDE';
      const res = await broken.app.inject({
        method: 'GET',
        url: '/api/v1/board',
        headers: { authorization: `Bearer ${code}` },
      });
      expect(res.statusCode).toBe(500);
      const body = res.json();
      expect(body).toMatchObject({ code: 'INTERNAL_ERROR', status: 500 });
      expect(body.requestId).toEqual(expect.any(String));
      expect(res.body).not.toMatch(/at .*\.ts|stack|ECONNREFUSED|postgres/i);
      expect(res.body).not.toContain(code);
    } finally {
      await broken.close();
    }
  });

  it('GET /api/health devuelve 503 si la base de datos no está disponible', async () => {
    const broken = await buildTestApp({ brokenDatabase: true });
    try {
      const res = await broken.app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
      expectMatchesContract('getHealth', 503, res.json());
    } finally {
      await broken.close();
    }
  });
});
