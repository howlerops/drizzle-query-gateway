import { describe, it, expect, vi } from 'vitest';
import { createQueryBuilder, QueryBuilder } from '../src/client/query-builder.js';
import { GatewayClientError } from '../src/client/index.js';

function createMockFetch(responseData: unknown, status = 200, error: string | null = null) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({ data: responseData, error }),
  });
}

const mockConfig = {
  baseUrl: 'http://localhost:3000/api/gateway',
  getToken: () => 'test-token',
};

describe('QueryBuilder - Supabase-style API', () => {
  describe('.from().select()', () => {
    it('should build a basic select query', async () => {
      const mockFetch = createMockFetch([{ id: '1', name: 'Alice' }]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      const { data, error } = await gw.from('contacts').select('id, name');

      expect(error).toBeNull();
      expect(data).toEqual([{ id: '1', name: 'Alice' }]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.table).toBe('contacts');
      expect(body.operation).toBe('findMany');
      expect(body.payload.columns).toEqual(['id', 'name']);
    });

    it('should handle select() without columns (all columns)', async () => {
      const mockFetch = createMockFetch([{ id: '1' }]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      const { data } = await gw.from('contacts').select();

      expect(data).toEqual([{ id: '1' }]);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.columns).toBeUndefined();
    });

    it('should handle select("*")', async () => {
      const mockFetch = createMockFetch([{ id: '1' }]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select('*');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.columns).toBeUndefined();
    });
  });

  describe('Filter operators', () => {
    it('.eq() should set plain value filter', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().eq('status', 'active');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.where).toEqual({ status: 'active' });
    });

    it('.neq() should set neq operator', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().neq('status', 'archived');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.where).toEqual({ status: { neq: 'archived' } });
    });

    it('.gt() should set gt operator', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().gt('createdAt', '2024-01-01');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.where).toEqual({ createdAt: { gt: '2024-01-01' } });
    });

    it('.gte() should set gte operator', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().gte('createdAt', '2024-01-01');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.where).toEqual({ createdAt: { gte: '2024-01-01' } });
    });

    it('.lt() should set lt operator', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().lt('createdAt', '2024-12-31');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.where).toEqual({ createdAt: { lt: '2024-12-31' } });
    });

    it('.lte() should set lte operator', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().lte('createdAt', '2024-12-31');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.where).toEqual({ createdAt: { lte: '2024-12-31' } });
    });

    it('.in() should set in operator with array', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().in('status', ['active', 'pending']);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.where).toEqual({ status: { in: ['active', 'pending'] } });
    });

    it('.like() should set like operator', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().like('status', '%act%');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.where).toEqual({ status: { like: '%act%' } });
    });

    it('.ilike() should set ilike operator', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().ilike('status', '%ACT%');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.where).toEqual({ status: { ilike: '%ACT%' } });
    });

    it('.is() should set is operator for null', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().is('status', null);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.where).toEqual({ status: { is: null } });
    });

    it('should chain multiple filters', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts')
        .select('id, name')
        .eq('status', 'active')
        .gte('createdAt', '2024-01-01')
        .lte('createdAt', '2024-12-31');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.where).toEqual({
        status: 'active',
        createdAt: { lte: '2024-12-31' }, // last one wins for same column
      });
      expect(body.payload.columns).toEqual(['id', 'name']);
    });
  });

  describe('.order()', () => {
    it('should set ascending order by default', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().order('name');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.orderBy).toEqual([{ column: 'name', direction: 'asc' }]);
    });

    it('should set descending order', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().order('createdAt', { ascending: false });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.orderBy).toEqual([{ column: 'createdAt', direction: 'desc' }]);
    });

    it('should support multiple order clauses', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select()
        .order('status')
        .order('name', { ascending: false });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.orderBy).toEqual([
        { column: 'status', direction: 'asc' },
        { column: 'name', direction: 'desc' },
      ]);
    });
  });

  describe('.limit() and .range()', () => {
    it('.limit() should set limit', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().limit(50);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.limit).toBe(50);
    });

    it('.range() should set offset and limit', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().range(10, 19);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.offset).toBe(10);
      expect(body.payload.limit).toBe(10); // 19 - 10 + 1
    });

    it('.range(0, 9) should return first 10 rows', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      await gw.from('contacts').select().range(0, 9);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.offset).toBe(0);
      expect(body.payload.limit).toBe(10);
    });
  });

  describe('.single() and .maybeSingle()', () => {
    it('.single() should set single flag and findFirst', async () => {
      const mockFetch = createMockFetch({ id: '1', name: 'Alice' });
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      const { data } = await gw.from('contacts').select().eq('status', 'active').single();

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.payload.single).toBe(true);
      expect(body.payload.limit).toBe(1);
    });

    it('.maybeSingle() should work when no rows returned', async () => {
      const mockFetch = createMockFetch(null);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      const { data, error } = await gw.from('contacts').select().maybeSingle();

      expect(error).toBeNull();
      expect(data).toBeNull();
    });
  });

  describe('Mutations', () => {
    it('.insert() should create a row', async () => {
      const mockFetch = createMockFetch([{ id: '1', name: 'Alice' }]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      const { data } = await gw.from('contacts').insert({ name: 'Alice', email: 'a@b.com' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.operation).toBe('create');
      expect(body.payload.data).toEqual({ name: 'Alice', email: 'a@b.com' });
    });

    it('.update() should update rows', async () => {
      const mockFetch = createMockFetch([{ id: '1', status: 'archived' }]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      const { data } = await gw.from('contacts')
        .update({ status: 'archived' })
        .eq('status', 'inactive');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.operation).toBe('update');
      expect(body.payload.data).toEqual({ status: 'archived' });
      expect(body.payload.where).toEqual({ status: 'inactive' });
    });

    it('.upsert() should send upsert operation', async () => {
      const mockFetch = createMockFetch([{ id: '1', name: 'Alice' }]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      const { data } = await gw.from('contacts')
        .upsert({ name: 'Alice', email: 'a@b.com' }, { onConflict: 'email' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.operation).toBe('upsert');
      expect(body.payload.data).toEqual({ name: 'Alice', email: 'a@b.com' });
      expect(body.payload.onConflict).toEqual(['email']);
    });

    it('.delete() should delete rows', async () => {
      const mockFetch = createMockFetch([{ id: '1' }]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      const { data } = await gw.from('contacts')
        .delete()
        .eq('status', 'archived');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.operation).toBe('delete');
      expect(body.payload.where).toEqual({ status: 'archived' });
    });
  });

  describe('Error handling', () => {
    it('should return { data: null, error } on HTTP error', async () => {
      const mockFetch = createMockFetch(null, 403, 'Table not exposed');
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      const { data, error } = await gw.from('secret').select();

      expect(data).toBeNull();
      expect(error).toBeInstanceOf(GatewayClientError);
      expect(error!.message).toBe('Table not exposed');
      expect(error!.statusCode).toBe(403);
    });

    it('should return error on network failure', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      const { data, error } = await gw.from('contacts').select();

      expect(data).toBeNull();
      expect(error).toBeInstanceOf(GatewayClientError);
      expect(error!.message).toBe('Network error');
    });
  });

  describe('Full chaining example (Supabase parity)', () => {
    it('should support full Supabase-style chain', async () => {
      const mockFetch = createMockFetch([
        { id: '1', name: 'Alice', email: 'alice@test.com', status: 'active' },
      ]);
      const gw = createQueryBuilder({ ...mockConfig, fetch: mockFetch });

      const { data, error } = await gw
        .from('contacts')
        .select('id, name, email, status')
        .eq('status', 'active')
        .order('name', { ascending: true })
        .limit(50);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        table: 'contacts',
        operation: 'findMany',
        payload: {
          columns: ['id', 'name', 'email', 'status'],
          where: { status: 'active' },
          orderBy: [{ column: 'name', direction: 'asc' }],
          limit: 50,
        },
      });
    });

    it('should send auth token', async () => {
      const mockFetch = createMockFetch([]);
      const gw = createQueryBuilder({
        ...mockConfig,
        getToken: () => 'my-jwt-token',
        fetch: mockFetch,
      });

      await gw.from('contacts').select();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer my-jwt-token');
    });
  });
});
