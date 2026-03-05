import type { GatewayOperation, GatewayResponse, GatewayBatchResponse } from '../types.js';

export interface ClientConfig {
  /** Base URL of the gateway endpoint (e.g. 'http://localhost:3000/api/gateway') */
  baseUrl: string;
  /** Function that returns the current auth token */
  getToken: () => string | Promise<string>;
  /** Optional custom fetch implementation */
  fetch?: typeof fetch;
}

export interface FindManyOptions {
  where?: Record<string, unknown>;
  columns?: string[];
  limit?: number;
  offset?: number;
  orderBy?: { column: string; direction: 'asc' | 'desc' }[];
  cursor?: { column: string; value: unknown; direction?: 'asc' | 'desc' };
}

export interface FindFirstOptions {
  where?: Record<string, unknown>;
  columns?: string[];
}

export interface CountOptions {
  where?: Record<string, unknown>;
}

export interface MutateOptions {
  where?: Record<string, unknown>;
  data: Record<string, unknown>;
}

export interface TableClient {
  findMany: (options?: FindManyOptions) => Promise<Record<string, unknown>[]>;
  findFirst: (options?: FindFirstOptions) => Promise<Record<string, unknown> | null>;
  count: (options?: CountOptions) => Promise<number>;
  create: (options: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  update: (options: MutateOptions) => Promise<Record<string, unknown>[]>;
  delete: (options: { where: Record<string, unknown> }) => Promise<Record<string, unknown>[]>;
}

async function gatewayFetch(
  config: ClientConfig,
  table: string,
  operation: GatewayOperation,
  payload: object,
): Promise<unknown> {
  const fetchFn = config.fetch ?? globalThis.fetch;
  const token = await config.getToken();

  const response = await fetchFn(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ table, operation, payload }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new GatewayClientError(
      (error as { error?: string }).error ?? 'Request failed',
      response.status,
    );
  }

  const result = await response.json() as GatewayResponse;
  return result.data;
}

export class GatewayClientError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'GatewayClientError';
  }
}

function createTableClient(config: ClientConfig, tableName: string): TableClient {
  return {
    async findMany(options: FindManyOptions = {}) {
      const result = await gatewayFetch(config, tableName, 'findMany', options);
      return result as Record<string, unknown>[];
    },

    async findFirst(options: FindFirstOptions = {}) {
      const result = await gatewayFetch(config, tableName, 'findFirst', options);
      const rows = result as Record<string, unknown>[];
      return rows[0] ?? null;
    },

    async count(options: CountOptions = {}) {
      const result = await gatewayFetch(config, tableName, 'count', options);
      const rows = result as { count: number }[];
      return rows[0]?.count ?? 0;
    },

    async create(options: { data: Record<string, unknown> }) {
      const result = await gatewayFetch(config, tableName, 'create', options);
      const rows = result as Record<string, unknown>[];
      return rows[0];
    },

    async update(options: MutateOptions) {
      const result = await gatewayFetch(config, tableName, 'update', options);
      return result as Record<string, unknown>[];
    },

    async delete(options: { where: Record<string, unknown> }) {
      const result = await gatewayFetch(config, tableName, 'delete', options);
      return result as Record<string, unknown>[];
    },
  };
}

/**
 * Create a typed gateway client.
 *
 * Returns a proxy object where each property access creates a table client:
 *   gateway.contacts.findMany({ where: { status: 'active' } })
 *
 * Table names are validated at runtime against the policy registry.
 */
export function createGatewayClient(
  config: ClientConfig,
  tableNames?: string[],
): Record<string, TableClient> & { batch: BatchClient } {
  const cache = new Map<string, TableClient>();

  const batchClient: BatchClient = {
    async execute(queries) {
      const fetchFn = config.fetch ?? globalThis.fetch;
      const token = await config.getToken();

      const response = await fetchFn(`${config.baseUrl}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ queries }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Batch request failed' }));
        throw new GatewayClientError(
          (error as { error?: string }).error ?? 'Batch request failed',
          response.status,
        );
      }

      const result = await response.json() as GatewayBatchResponse;
      return result.results;
    },
  };

  return new Proxy({} as Record<string, TableClient> & { batch: BatchClient }, {
    get(_target, prop: string) {
      if (prop === 'batch') return batchClient;

      if (tableNames && !tableNames.includes(prop)) {
        throw new GatewayClientError(`Table '${prop}' is not exposed by the gateway`, 403);
      }

      let client = cache.get(prop);
      if (!client) {
        client = createTableClient(config, prop);
        cache.set(prop, client);
      }
      return client;
    },
  });
}

export interface BatchQuery {
  table: string;
  operation: GatewayOperation;
  payload: object;
}

export interface BatchClient {
  execute: (queries: BatchQuery[]) => Promise<{ data?: unknown; error?: string }[]>;
}
