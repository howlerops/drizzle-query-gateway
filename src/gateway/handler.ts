import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PolicyRegistry, GatewayContext } from '../types.js';
import { validateShape, intersectColumns, projectColumns } from './policy.js';
import { executeQuery, type DrizzleDB } from './executor.js';

const orderBySchema = z.object({
  column: z.string(),
  direction: z.enum(['asc', 'desc']),
});

const payloadSchema = z.object({
  where: z.record(z.unknown()).optional(),
  columns: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
  orderBy: z.array(orderBySchema).optional(),
  data: z.record(z.unknown()).optional(),
  cursor: z.object({
    column: z.string(),
    value: z.unknown(),
    direction: z.enum(['asc', 'desc']).optional(),
  }).optional(),
});

const gatewayRequestSchema = z.object({
  table: z.string().min(1),
  operation: z.enum(['findMany', 'findFirst', 'create', 'update', 'delete', 'count']),
  payload: payloadSchema,
});

const batchRequestSchema = z.object({
  queries: z.array(gatewayRequestSchema).min(1).max(10),
});

export interface GatewayHandlerConfig {
  db: DrizzleDB;
  policies: PolicyRegistry;
  /** Called on every gateway error — useful for logging/monitoring */
  onError?: (error: unknown, req: Request) => void;
  /** Maximum queries in a batch request (default: 10) */
  maxBatchSize?: number;
}

/**
 * Process a single gateway query and return the result or error.
 */
async function processQuery(
  db: DrizzleDB,
  policies: PolicyRegistry,
  query: z.infer<typeof gatewayRequestSchema>,
  ctx: GatewayContext,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { table, operation, payload } = query;

  const policy = policies[table];
  if (!policy) {
    return { status: 403, body: { error: 'Table not exposed' } };
  }

  const violation = validateShape(payload, policy, operation, ctx);
  if (violation) {
    return { status: 403, body: { error: violation } };
  }

  const requiredFilters = policy.requiredFilters(ctx);
  const mergedFilters = {
    ...payload.where,
    ...requiredFilters,
  };

  const columns = intersectColumns(payload.columns, policy.allowedColumns);

  const rawResult = await executeQuery(db, policy, operation, {
    where: mergedFilters,
    columns,
    limit: payload.limit,
    offset: payload.offset,
    orderBy: payload.orderBy,
    data: payload.data,
    cursor: payload.cursor as { column: string; value: unknown; direction?: 'asc' | 'desc' } | undefined,
  });

  if (operation === 'count') {
    return { status: 200, body: { data: rawResult } };
  }

  const result = projectColumns(
    rawResult as Record<string, unknown>[],
    policy.allowedColumns,
  );

  return { status: 200, body: { data: result } };
}

/**
 * Create the gateway router.
 *
 * Provides two endpoints:
 * - POST /          Single query
 * - POST /batch     Multiple queries in one round-trip
 */
export function createGatewayHandler(config: GatewayHandlerConfig): Router {
  const router = Router();
  const { db, policies, onError, maxBatchSize = 10 } = config;

  // Single query endpoint
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const parsed = gatewayRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request format',
        details: parsed.error.issues,
      });
      return;
    }

    const ctx = req.ctx as GatewayContext;
    if (!ctx) {
      res.status(401).json({ error: 'Missing authentication context' });
      return;
    }

    try {
      const result = await processQuery(db, policies, parsed.data, ctx);
      res.status(result.status).json(result.body);
    } catch (err) {
      onError?.(err, req);
      const message = err instanceof Error ? err.message : 'Query execution failed';
      res.status(500).json({ error: message });
    }
  });

  // Batch query endpoint
  router.post('/batch', async (req: Request, res: Response): Promise<void> => {
    const parsed = batchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid batch request format',
        details: parsed.error.issues,
      });
      return;
    }

    if (parsed.data.queries.length > maxBatchSize) {
      res.status(400).json({
        error: `Batch size exceeds maximum of ${maxBatchSize}`,
      });
      return;
    }

    const ctx = req.ctx as GatewayContext;
    if (!ctx) {
      res.status(401).json({ error: 'Missing authentication context' });
      return;
    }

    try {
      const results = await Promise.all(
        parsed.data.queries.map(query => processQuery(db, policies, query, ctx)),
      );
      res.json({ results: results.map(r => r.body) });
    } catch (err) {
      onError?.(err, req);
      const message = err instanceof Error ? err.message : 'Batch execution failed';
      res.status(500).json({ error: message });
    }
  });

  return router;
}
