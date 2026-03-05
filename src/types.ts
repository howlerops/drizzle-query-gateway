import type { Table, InferSelectModel } from 'drizzle-orm';

/** User context built by auth middleware — never from the client */
export interface GatewayContext {
  userId: string;
  tenantId: string;
  roles: string[];
}

/** Operations the gateway supports */
export type GatewayOperation = 'findMany' | 'findFirst' | 'create' | 'update' | 'delete' | 'count';

/** Inbound request shape from the client */
export interface GatewayRequest {
  table: string;
  operation: GatewayOperation;
  payload: {
    where?: Record<string, unknown>;
    columns?: string[];
    limit?: number;
    offset?: number;
    orderBy?: { column: string; direction: 'asc' | 'desc' }[];
    data?: Record<string, unknown>;
    cursor?: { column: string; value: unknown; direction?: 'asc' | 'desc' };
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
  meta?: {
    count?: number;
  };
}

/** Batch response envelope */
export interface GatewayBatchResponse {
  results: { data?: unknown; error?: string }[];
}

/** Gateway error response */
export interface GatewayError {
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
