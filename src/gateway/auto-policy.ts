import { getTableName, getTableColumns, type Table } from 'drizzle-orm';
import type { Policy, GatewayContext } from '../types.js';

/**
 * Override options for auto-generated policies.
 */
export interface AutoPolicyOverrides {
  /** Columns to exclude from the auto-generated allowedColumns list */
  excludeColumns?: string[];
  /** Columns to exclude from the auto-generated allowedFilters list */
  excludeFilters?: string[];
  /** Explicit allowedColumns (overrides auto-detection entirely) */
  allowedColumns?: string[];
  /** Explicit allowedFilters (overrides auto-detection entirely) */
  allowedFilters?: string[];
  /** Server-injected filters (e.g. tenant isolation) */
  requiredFilters?: (ctx: GatewayContext) => Record<string, unknown>;
  /** Role guard for mutations */
  canWrite?: (ctx: GatewayContext) => boolean;
}

/**
 * Create a policy from a Drizzle table schema, auto-exposing all columns.
 *
 * Uses `getTableColumns()` to introspect the schema at runtime and expose
 * every column by default. Use overrides to exclude sensitive columns,
 * restrict filters, or add required filters.
 *
 * @example
 * ```ts
 * import { contacts } from './schema.js';
 *
 * const contactsPolicy = definePolicyFromSchema(contacts, {
 *   excludeColumns: ['notes'],
 *   requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
 * });
 * ```
 */
export function definePolicyFromSchema<T extends Table>(
  table: T,
  overrides: AutoPolicyOverrides = {},
): Policy<T> {
  const tableName = getTableName(table);
  const columns = Object.keys(getTableColumns(table));

  let allowedColumns: string[];
  if (overrides.allowedColumns) {
    allowedColumns = overrides.allowedColumns;
  } else if (overrides.excludeColumns) {
    const excluded = new Set(overrides.excludeColumns);
    allowedColumns = columns.filter(c => !excluded.has(c));
  } else {
    allowedColumns = columns;
  }

  let allowedFilters: string[];
  if (overrides.allowedFilters) {
    allowedFilters = overrides.allowedFilters;
  } else if (overrides.excludeFilters) {
    const excluded = new Set(overrides.excludeFilters);
    allowedFilters = columns.filter(c => !excluded.has(c));
  } else {
    allowedFilters = columns;
  }

  return {
    table,
    tableName,
    allowedColumns,
    allowedFilters,
    requiredFilters: overrides.requiredFilters ?? (() => ({})),
    canWrite: overrides.canWrite ?? (() => false),
  };
}

function isTable(value: unknown): value is Table {
  if (!value || typeof value !== 'object') return false;
  try {
    getTableName(value as Table);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate policies for all tables in a Drizzle schema object.
 *
 * @example
 * ```ts
 * import * as schema from './schema/index.js';
 *
 * const policies = definePoliciesFromSchema(schema, {
 *   defaults: {
 *     requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
 *   },
 *   overrides: {
 *     contacts: { excludeColumns: ['notes'] },
 *   },
 * });
 * ```
 */
export function definePoliciesFromSchema(
  schema: Record<string, unknown>,
  options: {
    defaults?: AutoPolicyOverrides;
    overrides?: Record<string, AutoPolicyOverrides>;
  } = {},
): Policy[] {
  const policies: Policy[] = [];

  for (const [_key, value] of Object.entries(schema)) {
    if (!isTable(value)) continue;

    const tableName = getTableName(value);
    const tableOverrides = {
      ...options.defaults,
      ...options.overrides?.[tableName],
    };

    policies.push(definePolicyFromSchema(value, tableOverrides));
  }

  return policies;
}
