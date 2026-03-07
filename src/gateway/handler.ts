import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PolicyRegistry, GatewayContext, IncludeOption } from '../types.js';
import { validateShape, intersectColumns, projectColumns } from './policy.js';
import { executeQuery, type DrizzleDB } from './executor.js';
import type { RelationsRegistry } from './relations.js';

/** Maximum depth for nested includes to prevent unbounded recursion */
const MAX_INCLUDE_DEPTH = 3;

/** Maximum number of include aliases per query to limit N+1 amplification */
const MAX_INCLUDE_ALIASES = 5;

const orderBySchema = z.object({
  column: z.string(),
  direction: z.enum(['asc', 'desc']),
});

const includeOptionSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.record(
    z.union([
      z.boolean(),
      z.object({
        columns: z.array(z.string()).optional(),
        where: z.record(z.unknown()).optional(),
        limit: z.number().int().positive().max(1000).optional(),
        orderBy: z.array(orderBySchema).optional(),
        include: includeOptionSchema.optional(),
      }),
    ]),
  ),
);

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
  onConflict: z.array(z.string()).optional(),
  single: z.boolean().optional(),
  include: includeOptionSchema.optional(),
});

const gatewayRequestSchema = z.object({
  table: z.string().min(1),
  operation: z.enum(['findMany', 'findFirst', 'create', 'update', 'delete', 'count', 'upsert']),
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
  /** Relations registry for include support */
  relations?: RelationsRegistry;
  /** Maximum depth for nested includes (default: 3) */
  maxIncludeDepth?: number;
}

/**
 * Recursively load related data for each row based on the include directive.
 */
async function loadRelations(
  db: DrizzleDB,
  policies: PolicyRegistry,
  relations: RelationsRegistry,
  ctx: GatewayContext,
  tableName: string,
  rows: Record<string, unknown>[],
  include: Record<string, IncludeOption | boolean>,
  depth: number,
  maxDepth: number,
): Promise<void> {
  if (depth >= maxDepth) return;

  const tableRelations = relations[tableName];
  if (!tableRelations) return;

  const aliases = Object.keys(include).slice(0, MAX_INCLUDE_ALIASES);

  for (const alias of aliases) {
    const relation = tableRelations[alias];
    if (!relation) continue;

    const relatedPolicy = policies[relation.relatedTable];
    if (!relatedPolicy) continue;

    const includeOpt = include[alias];
    const opts: IncludeOption = typeof includeOpt === 'boolean' ? {} : includeOpt;

    // Enforce required filters on related table (e.g. tenant isolation)
    const requiredFilters = relatedPolicy.requiredFilters(ctx);

    for (const row of rows) {
      const linkValue = relation.type === 'one'
        ? row[relation.foreignKey]
        : row[relation.references];

      if (linkValue === undefined || linkValue === null) {
        row[alias] = relation.type === 'one' ? null : [];
        continue;
      }

      const lookupColumn = relation.type === 'one'
        ? relation.references
        : relation.foreignKey;

      const where = {
        ...opts.where,
        ...requiredFilters,
        [lookupColumn]: linkValue,
      };

      const columns = intersectColumns(opts.columns, relatedPolicy.allowedColumns);

      const rawResult = await executeQuery(db, relatedPolicy, 'findMany', {
        where,
        columns,
        limit: relation.type === 'one' ? 1 : opts.limit,
        orderBy: opts.orderBy,
      });

      const projected = projectColumns(
        rawResult as Record<string, unknown>[],
        relatedPolicy.allowedColumns,
      );

      // Recurse into nested includes
      const nestedInclude = typeof includeOpt !== 'boolean' && includeOpt
        ? (includeOpt as Record<string, unknown>).include as Record<string, IncludeOption | boolean> | undefined
        : undefined;
      if (nestedInclude && projected.length > 0) {
        await loadRelations(
          db, policies, relations, ctx,
          relation.relatedTable, projected,
          nestedInclude, depth + 1, maxDepth,
        );
      }

      row[alias] = relation.type === 'one' ? (projected[0] ?? null) : projected;
    }
  }
}

/**
 * Process a single gateway query and return the result or error.
 */
async function processQuery(
  db: DrizzleDB,
  policies: PolicyRegistry,
  query: z.infer<typeof gatewayRequestSchema>,
  ctx: GatewayContext,
  relations?: RelationsRegistry,
  maxIncludeDepth = MAX_INCLUDE_DEPTH,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { table, operation, payload } = query;

  const policy = policies[table];
  if (!policy) {
    return { status: 403, body: { data: null, error: 'Table not exposed' } };
  }

  const violation = validateShape(payload, policy, operation, ctx);
  if (violation) {
    return { status: 403, body: { data: null, error: violation } };
  }

  // Security: validate orderBy columns against allowedColumns
  if (payload.orderBy) {
    const disallowed = payload.orderBy.map(o => o.column).filter(c => !policy.allowedColumns.includes(c));
    if (disallowed.length > 0) {
      return { status: 403, body: { data: null, error: 'Disallowed orderBy columns: ' + disallowed.join(', ') } };
    }
  }

  // Security: validate cursor column against allowedColumns
  if (payload.cursor && !policy.allowedColumns.includes(payload.cursor.column)) {
    return { status: 403, body: { data: null, error: 'Disallowed cursor column: ' + payload.cursor.column } };
  }

  // Security: validate onConflict columns against allowedColumns
  if (payload.onConflict) {
    const disallowed = payload.onConflict.filter(c => !policy.allowedColumns.includes(c));
    if (disallowed.length > 0) {
      return { status: 403, body: { data: null, error: 'Disallowed onConflict columns: ' + disallowed.join(', ') } };
    }
  }

  const requiredFilters = policy.requiredFilters(ctx);
  const mergedFilters = {
    ...payload.where,
    ...requiredFilters,
  };

  const columns = intersectColumns(payload.columns, policy.allowedColumns);

  const isWrite = operation === 'create' || operation === 'update' || operation === 'upsert';

  // Security: inject requiredFilters into write data for tenant isolation
  let writeData = payload.data;
  if (writeData && isWrite) {
    writeData = { ...writeData, ...requiredFilters };
  }

  // Security: reject update/delete with no effective WHERE clause
  if ((operation === 'update' || operation === 'delete') && Object.keys(mergedFilters).length === 0) {
    return { status: 403, body: { data: null, error: 'Update/delete requires at least one filter' } };
  }

  const rawResult = await executeQuery(db, policy, operation, {
    where: mergedFilters,
    columns,
    limit: payload.limit,
    offset: payload.offset,
    orderBy: payload.orderBy,
    data: writeData,
    cursor: payload.cursor as { column: string; value: unknown; direction?: 'asc' | 'desc' } | undefined,
    onConflict: payload.onConflict,
    single: payload.single,
  });

  if (operation === 'count') {
    return { status: 200, body: { data: rawResult, error: null } };
  }

  const result = projectColumns(
    rawResult as Record<string, unknown>[],
    policy.allowedColumns,
  );

  // Load related data if include is specified and relations are configured
  if (payload.include && relations) {
    await loadRelations(
      db, policies, relations, ctx, table, result,
      payload.include as Record<string, IncludeOption | boolean>,
      0, maxIncludeDepth,
    );
  }

  // Single mode: return one row or null
  if (payload.single) {
    const row = result[0] ?? null;
    return { status: 200, body: { data: row, error: null } };
  }

  return { status: 200, body: { data: result, error: null } };
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
  const { db, policies, onError, maxBatchSize = 10, relations, maxIncludeDepth } = config;

  // Single query endpoint
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const parsed = gatewayRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        data: null,
        error: 'Invalid request format',
        details: parsed.error.issues,
      });
      return;
    }

    const ctx = req.ctx as GatewayContext;
    if (!ctx) {
      res.status(401).json({ data: null, error: 'Missing authentication context' });
      return;
    }

    try {
      const result = await processQuery(db, policies, parsed.data, ctx, relations, maxIncludeDepth);
      res.status(result.status).json(result.body);
    } catch (err) {
      onError?.(err, req);
      res.status(500).json({ data: null, error: 'Query execution failed' });
    }
  });

  // Batch query endpoint
  router.post('/batch', async (req: Request, res: Response): Promise<void> => {
    const parsed = batchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        data: null,
        error: 'Invalid batch request format',
        details: parsed.error.issues,
      });
      return;
    }

    if (parsed.data.queries.length > maxBatchSize) {
      res.status(400).json({
        data: null,
        error: 'Batch size exceeds maximum of ' + maxBatchSize,
      });
      return;
    }

    const ctx = req.ctx as GatewayContext;
    if (!ctx) {
      res.status(401).json({ data: null, error: 'Missing authentication context' });
      return;
    }

    try {
      const results = await Promise.allSettled(
        parsed.data.queries.map(query => processQuery(db, policies, query, ctx, relations, maxIncludeDepth)),
      );
      res.json({
        results: results.map(r =>
          r.status === 'fulfilled'
            ? r.value.body
            : { data: null, error: 'Query execution failed' },
        ),
      });
    } catch (err) {
      onError?.(err, req);
      res.status(500).json({ data: null, error: 'Batch execution failed' });
    }
  });

  return router;
}
