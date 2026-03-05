import { eq, and, gt, lt, asc, desc, count as drizzleCount, type SQL, type Table, getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Policy } from '../types.js';

export interface QueryParams {
  where: Record<string, unknown>;
  columns: string[];
  limit?: number;
  offset?: number;
  orderBy?: { column: string; direction: 'asc' | 'desc' }[];
  data?: Record<string, unknown>;
  cursor?: { column: string; value: unknown; direction?: 'asc' | 'desc' };
}

/**
 * Build a Drizzle WHERE clause from a flat filter object.
 * Each key maps to an `eq()` condition, combined with `and()`.
 */
export function buildWhereClause(
  table: Table,
  filters: Record<string, unknown>,
): SQL | undefined {
  const columns = getTableColumns(table);
  const conditions: SQL[] = [];

  for (const [key, value] of Object.entries(filters)) {
    const column = columns[key];
    if (column && value !== undefined) {
      conditions.push(eq(column, value));
    }
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
}

/**
 * Build a column selection object for Drizzle's `select()`.
 * Returns a map of { columnName: columnRef }.
 */
export function buildColumnSelection(
  table: Table,
  requestedColumns: string[],
): Record<string, unknown> {
  const allColumns = getTableColumns(table);
  const selection: Record<string, unknown> = {};

  for (const colName of requestedColumns) {
    if (allColumns[colName]) {
      selection[colName] = allColumns[colName];
    }
  }

  return selection;
}

/**
 * Build an ORDER BY clause from the request.
 */
export function buildOrderBy(
  table: Table,
  orderBy?: { column: string; direction: 'asc' | 'desc' }[],
): SQL[] {
  if (!orderBy || orderBy.length === 0) return [];

  const columns = getTableColumns(table);
  const clauses: SQL[] = [];

  for (const { column, direction } of orderBy) {
    const col = columns[column];
    if (col) {
      clauses.push(direction === 'desc' ? desc(col) : asc(col));
    }
  }

  return clauses;
}

/**
 * Apply cursor-based pagination to a query's WHERE clause.
 * Adds a condition like `column > cursorValue` (or < for desc).
 */
export function applyCursor(
  table: Table,
  existingWhere: SQL | undefined,
  cursor: { column: string; value: unknown; direction?: 'asc' | 'desc' },
): SQL | undefined {
  const columns = getTableColumns(table);
  const col = columns[cursor.column];
  if (!col) return existingWhere;

  const cursorCondition = cursor.direction === 'desc'
    ? lt(col, cursor.value)
    : gt(col, cursor.value);

  if (!existingWhere) return cursorCondition;
  return and(existingWhere, cursorCondition);
}

export type DrizzleDB = {
  select: (columns?: Record<string, unknown>) => any;
  insert: (table: any) => any;
  update: (table: any) => any;
  delete: (table: any) => any;
};

/**
 * Execute a query through Drizzle with policy-enforced parameters.
 */
export async function executeQuery(
  db: DrizzleDB,
  policy: Policy,
  operation: string,
  params: QueryParams,
): Promise<unknown[]> {
  const { table } = policy;
  let whereClause = buildWhereClause(table, params.where);
  const columnSelection = buildColumnSelection(table, params.columns);

  // Apply cursor pagination if provided
  if (params.cursor) {
    whereClause = applyCursor(table, whereClause, params.cursor);
  }

  switch (operation) {
    case 'findMany': {
      let query = db.select(columnSelection).from(table as PgTable);
      if (whereClause) query = query.where(whereClause);
      const orderClauses = buildOrderBy(table, params.orderBy);
      if (orderClauses.length > 0) query = query.orderBy(...orderClauses);
      if (params.limit) query = query.limit(params.limit);
      if (params.offset) query = query.offset(params.offset);
      return await query;
    }

    case 'findFirst': {
      let query = db.select(columnSelection).from(table as PgTable);
      if (whereClause) query = query.where(whereClause);
      query = query.limit(1);
      const rows = await query;
      return rows.slice(0, 1);
    }

    case 'count': {
      let query = db.select({ count: drizzleCount() }).from(table as PgTable);
      if (whereClause) query = query.where(whereClause);
      const rows = await query;
      return rows;
    }

    case 'create': {
      if (!params.data) throw new Error('Create requires data');
      const result = await db.insert(table as PgTable)
        .values(params.data)
        .returning();
      return result;
    }

    case 'update': {
      if (!params.data) throw new Error('Update requires data');
      let query = db.update(table as PgTable).set(params.data);
      if (whereClause) query = query.where(whereClause);
      const result = await query.returning();
      return result;
    }

    case 'delete': {
      let query = db.delete(table as PgTable);
      if (whereClause) query = query.where(whereClause);
      const result = await query.returning();
      return result;
    }

    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}
