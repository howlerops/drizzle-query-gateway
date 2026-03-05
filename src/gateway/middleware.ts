import type { Request, Response, NextFunction } from 'express';
import { jwtVerify, type JWTPayload } from 'jose';
import type { GatewayContext } from '../types.js';

export interface AuthConfig {
  /** JWT secret key (as Uint8Array or string) */
  secret: Uint8Array | string;
  /** Extract the token from the request (default: Bearer token from Authorization header) */
  extractToken?: (req: Request) => string | null;
}

function defaultExtractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

interface GatewayJWTPayload extends JWTPayload {
  userId?: string;
  tenantId?: string;
  roles?: string[];
}

/**
 * Create authentication middleware that verifies JWTs and
 * builds the GatewayContext attached to each request.
 */
export function createAuthMiddleware(config: AuthConfig) {
  const secret = typeof config.secret === 'string'
    ? new TextEncoder().encode(config.secret)
    : config.secret;

  const extractToken = config.extractToken ?? defaultExtractToken;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: 'Missing authentication token' });
      return;
    }

    try {
      const { payload } = await jwtVerify(token, secret) as { payload: GatewayJWTPayload };

      if (!payload.userId || !payload.tenantId) {
        res.status(401).json({ error: 'Invalid token: missing userId or tenantId' });
        return;
      }

      req.ctx = {
        userId: payload.userId,
        tenantId: payload.tenantId,
        roles: payload.roles ?? [],
      };

      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
