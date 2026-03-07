import type { Table, InferSelectModel } from 'drizzle-orm';

/** User context built by auth middleware — never from the client */
export interface GatewayContext {
  userId: string;
  tenantId: string;
  roles: string[];
}

/** Supported filter operators */
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'ilike' | 'is';

/** A filter value can be a plain value (shorthand for eq) or an operator object */
export type FilterValue =
  | unknown
  | { eq: unknown }
  | { neq: unknown }
  | { gt: unknown }
  | { gte: unknown }
  | { lt: unknown }
  | { lte: unknown }
  | { in: unknown[] }
  | { like: string }
  | { ilike: string }
  | { is: null };

/** Operations the gateway supports */
export type GatewayOperation = 'findMany' | 'findFirst' | 'create' | 'update' | 'delete' | 'count' | 'upsert';

/** Inbound request shape from the client */
export interface GatewayRequest {
  table: string;
  operation: GatewayOperation;
  payload: {
    where?: Record<string, FilterValue>;
    columns?: string[];
    limit?: number;
    offset?: number;
    orderBy?: { column: string; direction: 'asc' | 'desc' }[];
    data?: Record<string, unknown>;
    cursor?: { column: string; value: unknown; direction?: 'asc' | 'desc' };
    /** For upsert: columns that determine conflict */
    onConflict?: string[];
    /** Return single row instead of array */
    single?: boolean;
    /** Include related data */
    include?: Record<string, IncludeOption | boolean>;
  };
}

/** Batch request — multiple queries in one round-trip */
export interface GatewayBatchRequest {
  queries: GatewayRequest[];
}

/** Policy definition for a single table */
export interface PolicyConfig<T extends Table> {
  table: T;
  /** Filters always injected from server context — client cannot override */
  requiredFilters: (ctx: GatewayContext) => Record<string, unknown>;
  /** Columns the client is allowed to filter on */
  allowedFilters: string[];
  /** Columns the client may read */
  allowedColumns: string[];
  /** Role guard for mutations — return true to allow writes */
  canWrite: (ctx: GatewayContext) => boolean;
}

/** A resolved policy with the table name attached */
export interface Policy<T extends Table = Table> extends PolicyConfig<T> {
  tableName: string;
}

/** The policy registry maps table names to policies */
export type PolicyRegistry = Record<string, Policy>;

/** Gateway response envelope */
export interface GatewayResponse<T = unknown> {
  data: T;
  error: null;
}

/** Batch response envelope */
export interface GatewayBatchResponse {
  results: { data?: unknown; error?: string | null }[];
}

/** Gateway error response */
export interface GatewayError {
  data: null;
  error: string;
  code?: string;
}

/** Extend Express Request with gateway context */
declare global {
  namespace Express {
    interface Request {
      ctx?: GatewayContext;
    }
  }
}

/** Options for including related data in queries */
export interface IncludeOption {
  columns?: string[];
  where?: Record<string, FilterValue>;
  limit?: number;
  orderBy?: { column: string; direction: 'asc' | 'desc' }[];
}
