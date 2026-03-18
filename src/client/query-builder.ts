import type { GatewayOperation, GatewayResponse } from '../types.js';
import type { ClientConfig } from './index.js';
import { GatewayClientError } from './index.js';

type Row = Record<string, unknown>;

/**
 * Chainable query builder for the Drizzle Query Gateway.
 *
 * Usage:
 *   const { data, error } = await gateway
 *     .from('contacts')
 *     .select('id, name, email')
 *     .eq('status', 'active')
 *     .order('createdAt', { ascending: false })
 *     .limit(50);
 */
export class QueryBuilder implements PromiseLike<{ data: Row[] | Row | number | null; error: GatewayClientError | null }> {
  private _table: string;
  private _operation: GatewayOperation = 'findMany';
  private _columns: string[] = [];
  private _where: Record<string, unknown> = {};
  private _orderBy: { column: string; direction: 'asc' | 'desc' }[] = [];
  private _limit?: number;
  private _offset?: number;
  private _data?: Record<string, unknown>;
  private _single = false;
  private _maybeSingle = false;
  private _onConflict?: string[];
  private _config: ClientConfig;
  private _head = false;

  constructor(config: ClientConfig, table: string) {
    this._config = config;
    this._table = table;
  }

  // ─── Column Selection ──────────────────────────────────────────

  /**
   * Select columns to return. Comma-separated string (e.g. 'id, name, email').
   * If not called, returns all allowed columns.
   */
  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): this {
    if (columns && columns !== '*') {
      this._columns = columns.split(',').map(c => c.trim()).filter(Boolean);
    }
    if (options?.head) {
      this._head = true;
      this._operation = 'count';
    }
    if (options?.count === 'exact') {
      this._operation = 'count';
    }
    return this;
  }

  // ─── Filter Operators ──────────────────────────────────────────

  /** Equal */
  eq(column: string, value: unknown): this {
    this._where[column] = value;
    return this;
  }

  /** Not equal */
  neq(column: string, value: unknown): this {
    this._where[column] = { neq: value };
    return this;
  }

  /** Greater than */
  gt(column: string, value: unknown): this {
    this._where[column] = { gt: value };
    return this;
  }

  /** Greater than or equal */
  gte(column: string, value: unknown): this {
    this._where[column] = { gte: value };
    return this;
  }

  /** Less than */
  lt(column: string, value: unknown): this {
    this._where[column] = { lt: value };
    return this;
  }

  /** Less than or equal */
  lte(column: string, value: unknown): this {
    this._where[column] = { lte: value };
    return this;
  }

  /** Column is in array */
  in(column: string, values: unknown[]): this {
    this._where[column] = { in: values };
    return this;
  }

  /** LIKE pattern match */
  like(column: string, pattern: string): this {
    this._where[column] = { like: pattern };
    return this;
  }

  /** Case-insensitive LIKE */
  ilike(column: string, pattern: string): this {
    this._where[column] = { ilike: pattern };
    return this;
  }

  /** IS NULL check */
  is(column: string, value: null): this {
    this._where[column] = { is: value };
    return this;
  }

  // ─── Ordering ──────────────────────────────────────────────────

  /** Add an order clause: .order('col', { ascending: false }) */
  order(column: string, options?: { ascending?: boolean }): this {
    const direction = options?.ascending === false ? 'desc' as const : 'asc' as const;
    this._orderBy.push({ column, direction });
    return this;
  }

  // ─── Pagination ────────────────────────────────────────────────

  /** Limit number of rows returned */
  limit(count: number): this {
    this._limit = count;
    return this;
  }

  /** Range pagination: .range(0, 9) returns rows 0-9 (10 rows) */
  range(from: number, to: number): this {
    this._offset = from;
    this._limit = to - from + 1;
    return this;
  }

  // ─── Result Modifiers ──────────────────────────────────────────

  /** Return exactly one row. Errors if zero or more than one. */
  single(): PromiseLike<{ data: Row | null; error: GatewayClientError | null }> {
    this._single = true;
    this._limit = 1;
    if (this._operation === 'findMany') this._operation = 'findFirst';
    return this as any;
  }

  /** Return zero or one row. No error if zero rows. */
  maybeSingle(): PromiseLike<{ data: Row | null; error: GatewayClientError | null }> {
    this._maybeSingle = true;
    this._limit = 1;
    if (this._operation === 'findMany') this._operation = 'findFirst';
    return this as any;
  }

  // ─── Mutations ─────────────────────────────────────────────────

  /** Insert a new row */
  insert(data: Row | Row[]): this {
    this._operation = 'create';
    this._data = Array.isArray(data) ? data[0] : data;
    return this;
  }

  /** Update rows matching the current filters */
  update(data: Row): this {
    this._operation = 'update';
    this._data = data;
    return this;
  }

  /** Upsert (insert or update on conflict) */
  upsert(data: Row, options?: { onConflict?: string }): this {
    this._operation = 'upsert';
    this._data = data;
    if (options?.onConflict) {
      this._onConflict = options.onConflict.split(',').map(s => s.trim());
    }
    return this;
  }

  /** Delete rows matching the current filters */
  delete(): this {
    this._operation = 'delete';
    return this;
  }

  // ─── Execution ─────────────────────────────────────────────────

  private _buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (Object.keys(this._where).length > 0) payload.where = this._where;
    if (this._columns.length > 0) payload.columns = this._columns;
    if (this._limit !== undefined) payload.limit = this._limit;
    if (this._offset !== undefined) payload.offset = this._offset;
    if (this._orderBy.length > 0) payload.orderBy = this._orderBy;
    if (this._data) payload.data = this._data;
    if (this._single || this._maybeSingle) payload.single = true;
    if (this._onConflict) payload.onConflict = this._onConflict;

    return payload;
  }

  private async _execute(): Promise<{ data: Row[] | Row | number | null; error: GatewayClientError | null }> {
    const fetchFn = this._config.fetch ?? globalThis.fetch;
    const token = await this._config.getToken();

    const body = {
      table: this._table,
      operation: this._operation,
      payload: this._buildPayload(),
    };

    try {
      const response = await fetchFn(this._config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json() as { data: unknown; error: string | null };

      if (!response.ok || result.error) {
        return {
          data: null,
          error: new GatewayClientError(
            result.error ?? 'Request failed',
            response.status,
          ),
        };
      }

      return { data: result.data as any, error: null };
    } catch (err) {
      return {
        data: null,
        error: new GatewayClientError(
          err instanceof Error ? err.message : 'Network error',
          0,
        ),
      };
    }
  }

  /**
   * Makes the builder thenable — you can `await` it directly.
   * Returns `{ data, error }`.
   */
  then<TResult1 = { data: Row[] | Row | number | null; error: GatewayClientError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | Row | number | null; error: GatewayClientError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this._execute().then(onfulfilled, onrejected);
  }
}

/**
 * Create a gateway client with chainable query builder.
 *
 * Usage:
 *   const gateway = createQueryBuilder(config);
 *
 *   const { data, error } = await gateway.from('contacts')
 *     .select('id, name, email')
 *     .eq('status', 'active')
 *     .order('createdAt', { ascending: false })
 *     .limit(50);
 */
export function createQueryBuilder(config: ClientConfig) {
  return {
    from(table: string): QueryBuilder {
      return new QueryBuilder(config, table);
    },
  };
}
