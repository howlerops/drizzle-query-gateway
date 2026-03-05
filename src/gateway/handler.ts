import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PolicyRegistry, GatewayContext } from '../types.js';
import { validateShape, intersectColumns, projectColumns } from './policy.js';
import { executeQuery, type DrizzleDB } from './executor.js';

const gatewayRequestSchema = z.object({
  table: z.string().min(1),
  operation: z.enum(['findMany', 'findFirst', 'create', 'update', 'delete']),
  payload: z.object({
    where: z.record(z.unknown()).optional(),
    columns: z.array(z.string()).optional(),
    limit: z.number().int().positive().max(1000).optional(),
    offset: z.number().int().nonnegative().optional(),
    orderBy: z.array(z.object({
      column: z.string(),
      direction: z.enum(['asc', 'desc']),
    })).optional(),
    data: z.record(z.unknown()).optional(),
  }),
});

export interface GatewayHandlerConfig {
  db: DrizzleDB;
  policies: PolicyRegistry;
}

/**
 * Create the gateway router with a single POST endpoint.
 *
 * Validates request shape → enforces policy → injects required filters →
 * executes via Drizzle → projects allowed columns → returns typed response.
 */
export function createGatewayHandler(config: GatewayHandlerConfig): Router {
  const router = Router();
  const { db, policies } = config;

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    // 1. Validate request structure
    const parsed = gatewayRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request format',
        details: parsed.error.issues,
      });
      return;
    }

    const { table, operation, payload } = parsed.data;
    const ctx = req.ctx as GatewayContext;

    if (!ctx) {
      res.status(401).json({ error: 'Missing authentication context' });
      return;
    }

    // 2. Check if table is exposed
    const policy = policies[table];
    if (!policy) {
      res.status(403).json({ error: 'Table not exposed' });
      return;
    }

    // 3. Validate shape against policy
    const violation = validateShape(payload, policy, operation, ctx);
    if (violation) {
      res.status(403).json({ error: violation });
      return;
    }

    // 4. Inject required filters — server-built, cannot be overridden
    const requiredFilters = policy.requiredFilters(ctx);
    const mergedFilters = {
      ...payload.where,
      ...requiredFilters, // Required filters ALWAYS win — spread last
    };

    // 5. Compute column projection
    const columns = intersectColumns(payload.columns, policy.allowedColumns);

    try {
      // 6. Execute via Drizzle
      const rawResult = await executeQuery(db, policy, operation, {
        where: mergedFilters,
        columns,
        limit: payload.limit,
        offset: payload.offset,
        orderBy: payload.orderBy,
        data: payload.data,
      });

      // 7. Project columns server-side (defense in depth)
      const result = projectColumns(
        rawResult as Record<string, unknown>[],
        policy.allowedColumns,
      );

      res.json({ data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Query execution failed';
      res.status(500).json({ error: message });
    }
  });

  return router;
}
