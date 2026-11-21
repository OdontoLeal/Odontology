// src/shared/infrastructure/security/__tests__/https-security.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response } from 'express';
import { createEnforceHttpsMiddleware } from '../https-redirect.middleware';
import { createHstsMiddleware } from '../hsts.middleware';

function createMockReq(overrides: Partial<Request> = {}): Request {
  const headers: Record<string, string> = { ...((overrides.headers as Record<string, string>) || {}) };
  const hostname = overrides.hostname || 'odontoleal.com';
  return {
    method: 'GET',
    secure: false,
    protocol: 'http',
    hostname,
    originalUrl: '/api/v1/health?check=1',
    url: '/api/v1/health?check=1',
    ...overrides,
    headers,
    get(name: string) {
      if (name.toLowerCase() === 'host') return (headers['host'] as string) || hostname;
      return headers[name.toLowerCase()] as string;
    },
  } as unknown as Request;
}

function createMockRes() {
  const headers: Record<string, string> = {};
  let redirectedStatus: number | null = null;
  let redirectedUrl: string | null = null;

  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return res;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    redirect(statusOrUrl: number | string, url?: string) {
      if (typeof statusOrUrl === 'number') {
        redirectedStatus = statusOrUrl;
        redirectedUrl = url || null;
      } else {
        redirectedStatus = 302;
        redirectedUrl = statusOrUrl;
      }
      return res;
    },
    _getRedirectedStatus: () => redirectedStatus,
    _getRedirectedUrl: () => redirectedUrl,
    _getHeaders: () => headers,
  };

  return res as unknown as Response & {
    _getRedirectedStatus: () => number | null;
    _getRedirectedUrl: () => string | null;
    _getHeaders: () => Record<string, string>;
  };
}

describe('RQNF-SEG-001: Seguridad en Tránsito (HTTPS y HSTS)', () => {
  describe('Enforce HTTPS Middleware', () => {
    it('Permite el paso sin redirigir si la petición ya es HTTPS nativa (req.secure = true)', () => {
      const middleware = createEnforceHttpsMiddleware({ enabled: true });
      const req = createMockReq({ secure: true, protocol: 'https' });
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res._getRedirectedStatus(), null);
    });

    it('Permite el paso si el proxy inverso reporta x-forwarded-proto = https', () => {
      const middleware = createEnforceHttpsMiddleware({ enabled: true });
      const req = createMockReq({
        secure: false,
        headers: { 'x-forwarded-proto': 'https' },
      });
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res._getRedirectedStatus(), null);
    });

    it('Redirige peticiones HTTP GET a HTTPS con código 301 preservando host y query params', () => {
      const middleware = createEnforceHttpsMiddleware({ enabled: true });
      const req = createMockReq({
        method: 'GET',
        secure: false,
        hostname: 'odontoleal-1233560f76cb.herokuapp.com',
        originalUrl: '/pacientes?page=2&filtro=activo',
      });
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res._getRedirectedStatus(), 301);
      assert.strictEqual(
        res._getRedirectedUrl(),
        'https://odontoleal-1233560f76cb.herokuapp.com/pacientes?page=2&filtro=activo'
      );
    });

    it('Redirige peticiones POST/PUT/DELETE con código 308 para preservar método y payload (RFC 7538)', () => {
      const middleware = createEnforceHttpsMiddleware({ enabled: true });
      const req = createMockReq({
        method: 'POST',
        secure: false,
        hostname: 'odontoleal-1233560f76cb.herokuapp.com',
        originalUrl: '/api/v1/auth/login',
      });
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res._getRedirectedStatus(), 308);
      assert.strictEqual(
        res._getRedirectedUrl(),
        'https://odontoleal-1233560f76cb.herokuapp.com/api/v1/auth/login'
      );
    });

    it('Permite el paso en entorno deshabilitado (p. ej. desarrollo local)', () => {
      const middleware = createEnforceHttpsMiddleware({ enabled: false });
      const req = createMockReq({
        method: 'GET',
        secure: false,
        hostname: 'localhost',
        originalUrl: '/',
      });
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res._getRedirectedStatus(), null);
    });
  });

  describe('HSTS Middleware (RFC 6797)', () => {
    it('Inyecta cabecera Strict-Transport-Security con max-age de 1 año e includeSubDomains en peticiones seguras', () => {
      const middleware = createHstsMiddleware({
        enabled: true,
        maxAge: 31536000,
        includeSubDomains: true,
        preload: false,
      });
      const req = createMockReq({ secure: true, protocol: 'https' });
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true);
      const hsts = res._getHeaders()['strict-transport-security'];
      assert.strictEqual(hsts, 'max-age=31536000; includeSubDomains');
    });

    it('Incluye directiva preload cuando está explícitamente configurada', () => {
      const middleware = createHstsMiddleware({
        enabled: true,
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true,
      });
      const req = createMockReq({ secure: true, protocol: 'https' });
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true);
      const hsts = res._getHeaders()['strict-transport-security'];
      assert.strictEqual(hsts, 'max-age=63072000; includeSubDomains; preload');
    });

    it('NO inyecta HSTS sobre peticiones HTTP inseguras (RFC 6797 §7.2)', () => {
      const middleware = createHstsMiddleware({
        enabled: true,
        maxAge: 31536000,
      });
      const req = createMockReq({ secure: false, protocol: 'http' });
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res._getHeaders()['strict-transport-security'], undefined);
    });
  });
});
