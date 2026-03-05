import { describe, it, expect, vi } from 'vitest';
import { createAuthMiddleware } from '../src/gateway/middleware.js';
import { SignJWT } from 'jose';
import type { Request, Response, NextFunction } from 'express';

const SECRET = 'test-secret-that-is-long-enough-for-hs256';

function createMockReqRes(token?: string) {
  const req = {
    headers: {
      authorization: token ? `Bearer ${token}` : undefined,
    },
    ctx: undefined,
  } as unknown as Request;

  const res = {
    statusCode: 200,
    _body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(data: any) { this._body = data; },
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
}

async function createTestToken(payload: Record<string, unknown>) {
  const secret = new TextEncoder().encode(SECRET);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

describe('createAuthMiddleware', () => {
  const middleware = createAuthMiddleware({ secret: SECRET });

  it('should reject requests without a token', async () => {
    const { req, res, next } = createMockReqRes();
    await middleware(req, res, next);

    expect((res as any).statusCode).toBe(401);
    expect((res as any)._body.error).toBe('Missing authentication token');
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject invalid tokens', async () => {
    const { req, res, next } = createMockReqRes('invalid-token');
    await middleware(req, res, next);

    expect((res as any).statusCode).toBe(401);
    expect((res as any)._body.error).toBe('Invalid or expired token');
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject tokens missing userId', async () => {
    const token = await createTestToken({ tenantId: 'tenant-1', roles: ['editor'] });
    const { req, res, next } = createMockReqRes(token);
    await middleware(req, res, next);

    expect((res as any).statusCode).toBe(401);
    expect((res as any)._body.error).toContain('missing userId or tenantId');
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject tokens missing tenantId', async () => {
    const token = await createTestToken({ userId: 'user-1', roles: ['editor'] });
    const { req, res, next } = createMockReqRes(token);
    await middleware(req, res, next);

    expect((res as any).statusCode).toBe(401);
    expect((res as any)._body.error).toContain('missing userId or tenantId');
    expect(next).not.toHaveBeenCalled();
  });

  it('should accept valid tokens and build context', async () => {
    const token = await createTestToken({
      userId: 'user-1',
      tenantId: 'tenant-1',
      roles: ['editor', 'viewer'],
    });
    const { req, res, next } = createMockReqRes(token);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.ctx).toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
      roles: ['editor', 'viewer'],
    });
  });

  it('should default roles to empty array when not in token', async () => {
    const token = await createTestToken({
      userId: 'user-1',
      tenantId: 'tenant-1',
    });
    const { req, res, next } = createMockReqRes(token);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.ctx!.roles).toEqual([]);
  });

  it('should support custom token extraction', async () => {
    const customMiddleware = createAuthMiddleware({
      secret: SECRET,
      extractToken: (req) => (req.headers as any)['x-api-key'] ?? null,
    });

    const token = await createTestToken({ userId: 'u1', tenantId: 't1' });
    const req = {
      headers: { 'x-api-key': token },
      ctx: undefined,
    } as unknown as Request;

    const res = {
      statusCode: 200,
      _body: null as any,
      status(code: number) { this.statusCode = code; return this; },
      json(data: any) { this._body = data; },
    } as unknown as Response;

    const next = vi.fn();
    await customMiddleware(req, res, next as any);

    expect(next).toHaveBeenCalled();
    expect(req.ctx).toBeDefined();
    expect(req.ctx!.userId).toBe('u1');
  });
});
