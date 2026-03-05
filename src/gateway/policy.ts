import { getTableName, type Table } from 'drizzle-orm';
import type { Policy, PolicyConfig, PolicyRegistry, GatewayContext } from '../types.js';

/**
 * Define a policy for a Drizzle table.
 *
 * Captures the table reference, required filters (server-injected),
 * allowed client filters, readable columns, and write guards.
 */
export function definePolicy<T extends Table>(config: PolicyConfig<T>): Policy<T> {
  return {
    ...config,
    tableName: getTableName(config.table),
  };
}

/**
 * Create a policy registry from an array of policies.
 */
export function createPolicyRegistry(policies: Policy[]): PolicyRegistry {
  const registry: PolicyRegistry = {};
  for (const policy of policies) {
    registry[policy.tableName] = policy;
  }
  return registry;
}

/**
 * Validate the shape of a client request against a policy.
 * Returns an error string if invalid, null if valid.
 */
export function validateShape(
  payload: {
    where?: Record<string, unknown>;
    columns?: string[];
    data?: Record<string, unknown>;
  },
  policy: Policy,
  operation: string,
  ctx: GatewayContext,
): string | null {
  // Check write permission for mutations
  const isWrite = operation === 'create' || operation === 'update' || operation === 'delete';
  if (isWrite && !policy.canWrite(ctx)) {
    return 'Write access denied';
  }

  // Validate client-supplied filters
  if (payload.where) {
    const clientFilterKeys = Object.keys(payload.where);
    const disallowed = clientFilterKeys.filter(k => !policy.allowedFilters.includes(k));
    if (disallowed.length > 0) {
      return `Disallowed filters: ${disallowed.join(', ')}`;
    }
  }

  // Validate requested columns
  if (payload.columns) {
    const disallowedCols = payload.columns.filter(c => !policy.allowedColumns.includes(c));
    if (disallowedCols.length > 0) {
      return `Disallowed columns: ${disallowedCols.join(', ')}`;
    }
  }

  // Validate write data columns
  if (payload.data && isWrite) {
    const dataKeys = Object.keys(payload.data);
    const disallowedData = dataKeys.filter(k => !policy.allowedColumns.includes(k));
    if (disallowedData.length > 0) {
      return `Disallowed write columns: ${disallowedData.join(', ')}`;
    }
  }

  return null;
}

/**
 * Compute the intersection of requested columns with allowed columns.
 * If no columns requested, returns all allowed columns.
 */
export function intersectColumns(
  requested: string[] | undefined,
  allowed: string[],
): string[] {
  if (!requested || requested.length === 0) {
    return allowed;
  }
  return requested.filter(c => allowed.includes(c));
}

/**
 * Project result rows to only include allowed columns.
 */
export function projectColumns<T extends Record<string, unknown>>(
  rows: T[],
  allowedColumns: string[],
): Partial<T>[] {
  return rows.map(row => {
    const projected: Record<string, unknown> = {};
    for (const col of allowedColumns) {
      if (col in row) {
        projected[col] = row[col];
      }
    }
    return projected as Partial<T>;
  });
}
