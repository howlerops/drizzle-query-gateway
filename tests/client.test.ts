import { describe, it, expect, vi } from 'vitest';
import { createGatewayClient, GatewayClientError } from '../src/client/index.js';

function createMockFetch(responseData: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(status >= 200 && status < 300
      ? { data: responseData }
      : { error: responseData }),
  });
}

describe('createGatewayClient', () => {
  it('should create table clients via proxy', () => {
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'test-token',
    });

    expect(client.contacts).toBeDefined();
    expect(client.contacts.findMany).toBeTypeOf('function');
    expect(client.contacts.findFirst).toBeTypeOf('function');
    expect(client.contacts.create).toBeTypeOf('function');
    expect(client.contacts.update).toBeTypeOf('function');
    expect(client.contacts.delete).toBeTypeOf('function');
  });

  it('should cache table clients', () => {
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'test-token',
    });

    expect(client.contacts).toBe(client.contacts);
  });

  it('should reject access to non-exposed tables when tableNames provided', () => {
    const client = createGatewayClient(
      { baseUrl: 'http://localhost:3000/api/gateway', getToken: () => 'token' },
      ['contacts', 'accounts'],
    );

    expect(() => client.secret_table).toThrow(GatewayClientError);
    expect(() => client.secret_table).toThrow("Table 'secret_table' is not exposed");
  });

  it('should allow access to exposed tables when tableNames provided', () => {
    const client = createGatewayClient(
      { baseUrl: 'http://localhost:3000/api/gateway', getToken: () => 'token' },
      ['contacts'],
    );

    expect(() => client.contacts).not.toThrow();
  });
});

describe('TableClient.findMany', () => {
  it('should POST correct payload for findMany', async () => {
    const mockFetch = createMockFetch([{ id: '1', name: 'Alice' }]);
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'test-token',
      fetch: mockFetch,
    });

    const result = await client.contacts.findMany({
      where: { status: 'active' },
      columns: ['id', 'name'],
      limit: 10,
    });

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/gateway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify({
        table: 'contacts',
        operation: 'findMany',
        payload: { where: { status: 'active' }, columns: ['id', 'name'], limit: 10 },
      }),
    });

    expect(result).toEqual([{ id: '1', name: 'Alice' }]);
  });

  it('should handle empty results', async () => {
    const mockFetch = createMockFetch([]);
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'token',
      fetch: mockFetch,
    });

    const result = await client.contacts.findMany();
    expect(result).toEqual([]);
  });
});

describe('TableClient.findFirst', () => {
  it('should return first row or null', async () => {
    const mockFetch = createMockFetch([{ id: '1', name: 'Alice' }]);
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'token',
      fetch: mockFetch,
    });

    const result = await client.contacts.findFirst({ where: { status: 'active' } });
    expect(result).toEqual({ id: '1', name: 'Alice' });
  });

  it('should return null when no results', async () => {
    const mockFetch = createMockFetch([]);
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'token',
      fetch: mockFetch,
    });

    const result = await client.contacts.findFirst();
    expect(result).toBeNull();
  });
});

describe('TableClient.create', () => {
  it('should POST create operation', async () => {
    const mockFetch = createMockFetch([{ id: '1', name: 'New Contact' }]);
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'token',
      fetch: mockFetch,
    });

    const result = await client.contacts.create({ data: { name: 'New Contact', email: 'new@test.com' } });
    expect(result).toEqual({ id: '1', name: 'New Contact' });

    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.operation).toBe('create');
    expect(body.payload.data).toEqual({ name: 'New Contact', email: 'new@test.com' });
  });
});

describe('TableClient.upsert', () => {
  it('should POST upsert operation', async () => {
    const mockFetch = createMockFetch([{ id: '1', name: 'Alice' }]);
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'token',
      fetch: mockFetch,
    });

    const result = await client.contacts.upsert({
      data: { name: 'Alice', email: 'alice@test.com' },
      onConflict: ['email'],
    });
    expect(result).toEqual({ id: '1', name: 'Alice' });

    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.operation).toBe('upsert');
    expect(body.payload.data).toEqual({ name: 'Alice', email: 'alice@test.com' });
    expect(body.payload.onConflict).toEqual(['email']);
  });
});

describe('TableClient.update', () => {
  it('should POST update operation', async () => {
    const mockFetch = createMockFetch([{ id: '1', name: 'Updated' }]);
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'token',
      fetch: mockFetch,
    });

    const result = await client.contacts.update({
      where: { status: 'active' },
      data: { name: 'Updated' },
    });
    expect(result).toEqual([{ id: '1', name: 'Updated' }]);
  });
});

describe('TableClient.delete', () => {
  it('should POST delete operation', async () => {
    const mockFetch = createMockFetch([{ id: '1' }]);
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'token',
      fetch: mockFetch,
    });

    const result = await client.contacts.delete({ where: { status: 'inactive' } });
    expect(result).toEqual([{ id: '1' }]);
  });
});

describe('Error handling', () => {
  it('should throw GatewayClientError on 403', async () => {
    const mockFetch = createMockFetch('Table not exposed', 403);
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'token',
      fetch: mockFetch,
    });

    await expect(client.contacts.findMany()).rejects.toThrow(GatewayClientError);
    await expect(client.contacts.findMany()).rejects.toThrow('Table not exposed');
  });

  it('should throw GatewayClientError on 401', async () => {
    const mockFetch = createMockFetch('Invalid token', 401);
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'bad-token',
      fetch: mockFetch,
    });

    await expect(client.contacts.findMany()).rejects.toThrow(GatewayClientError);
  });

  it('should use async getToken', async () => {
    const mockFetch = createMockFetch([]);
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: async () => 'async-token',
      fetch: mockFetch,
    });

    await client.contacts.findMany();

    const call = mockFetch.mock.calls[0];
    expect(call[1].headers['Authorization']).toBe('Bearer async-token');
  });
});

describe('TableClient.count', () => {
  it('should POST count operation', async () => {
    const mockFetch = createMockFetch([{ count: 42 }]);
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'token',
      fetch: mockFetch,
    });

    const result = await client.contacts.count({ where: { status: 'active' } });
    expect(result).toBe(42);
  });

  it('should return 0 for empty results', async () => {
    const mockFetch = createMockFetch([]);
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'token',
      fetch: mockFetch,
    });

    const result = await client.contacts.count();
    expect(result).toBe(0);
  });
});

describe('Batch client', () => {
  it('should send batch queries to /batch endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        results: [
          { data: [{ id: '1' }] },
          { data: [{ id: '2' }] },
        ],
      }),
    });

    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'token',
      fetch: mockFetch,
    });

    const results = await client.batch.execute([
      { table: 'contacts', operation: 'findMany', payload: { where: { status: 'active' } } },
      { table: 'accounts', operation: 'findMany', payload: {} },
    ]);

    expect(results).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/gateway/batch',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should throw on batch failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Batch failed' }),
    });

    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'token',
      fetch: mockFetch,
    });

    await expect(client.batch.execute([
      { table: 'contacts', operation: 'findMany', payload: {} },
    ])).rejects.toThrow('Batch failed');
  });
});

describe('Cursor pagination', () => {
  it('should pass cursor in findMany payload', async () => {
    const mockFetch = createMockFetch([{ id: '2', name: 'Bob' }]);
    const client = createGatewayClient({
      baseUrl: 'http://localhost:3000/api/gateway',
      getToken: () => 'token',
      fetch: mockFetch,
    });

    await client.contacts.findMany({
      cursor: { column: 'id', value: 'cursor-value', direction: 'asc' },
      limit: 10,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.payload.cursor).toEqual({
      column: 'id',
      value: 'cursor-value',
      direction: 'asc',
    });
  });
});
