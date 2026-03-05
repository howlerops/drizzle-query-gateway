import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createGatewayHandler } from '../src/gateway/handler.js';
import { definePolicy, createPolicyRegistry } from '../src/gateway/policy.js';
import { contacts, accounts } from '../src/schema/index.js';
import type { PolicyRegistry } from '../src/types.js';

// Mock DB that returns predictable data and is fully chainable/awaitable
function createMockDb() {
  const mockRows = [
    { id: '1', name: 'Alice', email: 'alice@example.com', status: 'active', tenantId: 'tenant-1', notes: 'secret' },
    { id: '2', name: 'Bob', email: 'bob@example.com', status: 'active', tenantId: 'tenant-1', notes: 'hidden' },
  ];

  function makeChain(rows: typeof mockRows) {
    const chain: any = {};
    for (const method of ['from', 'where', 'orderBy', 'limit', 'offset']) {
      chain[method] = vi.fn(() => chain);
    }
    chain.values = vi.fn(() => ({ returning: vi.fn().mockResolvedValue(rows.slice(0, 1)) }));
    chain.set = vi.fn(() => {
      const sub: any = {};
      sub.where = vi.fn(() => ({ returning: vi.fn().mockResolvedValue(rows.slice(0, 1)) }));
      sub.returning = vi.fn().mockResolvedValue(rows.slice(0, 1));
      return sub;
    });
    chain.returning = vi.fn().mockResolvedValue(rows.slice(0, 1));
    chain.then = (resolve: Function, reject?: Function) => Promise.resolve(rows).then(resolve, reject);
    chain.catch = (fn: Function) => Promise.resolve(rows).catch(fn);
    return chain;
  }

  return {
    select: vi.fn(() => makeChain(mockRows)),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue(mockRows.slice(0, 1)),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue(mockRows.slice(0, 1)),
        })),
        returning: vi.fn().mockResolvedValue(mockRows.slice(0, 1)),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue(mockRows.slice(0, 1)),
      })),
      returning: vi.fn().mockResolvedValue(mockRows.slice(0, 1)),
    })),
  };
}

describe('Gateway Handler', () => {
  let app: express.Express;
  let mockDb: ReturnType<typeof createMockDb>;
  let policies: PolicyRegistry;

  beforeEach(() => {
    mockDb = createMockDb();

    const contactsPolicy = definePolicy({
      table: contacts,
      requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
      allowedFilters: ['status', 'ownerId', 'createdAt'],
      allowedColumns: ['id', 'name', 'email', 'status'],
      canWrite: (ctx) => ctx.roles.includes('editor'),
    });

    const accountsPolicy = definePolicy({
      table: accounts,
      requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
      allowedFilters: ['isActive', 'industry'],
      allowedColumns: ['id', 'name', 'industry', 'isActive'],
      canWrite: (ctx) => ctx.roles.includes('admin'),
    });

    policies = createPolicyRegistry([contactsPolicy, accountsPolicy]);

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.ctx = { userId: 'user-1', tenantId: 'tenant-1', roles: ['editor'] };
      next();
    });
    app.use('/api/gateway', createGatewayHandler({ db: mockDb as any, policies }));
  });

  it('should reject requests to unexposed tables', async () => {
    const res = await request(app)
      .post('/api/gateway')
      .send({ table: 'secret_table', operation: 'findMany', payload: {} });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Table not exposed');
  });

  it('should reject invalid request format', async () => {
    const res = await request(app)
      .post('/api/gateway')
      .send({ garbage: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request format');
  });

  it('should reject disallowed filters', async () => {
    const res = await request(app)
      .post('/api/gateway')
      .send({ table: 'contacts', operation: 'findMany', payload: { where: { notes: 'secret' } } });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Disallowed filters');
  });

  it('should reject disallowed columns', async () => {
    const res = await request(app)
      .post('/api/gateway')
      .send({ table: 'contacts', operation: 'findMany', payload: { columns: ['id', 'notes'] } });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Disallowed columns');
  });

  it('should accept valid findMany requests', async () => {
    const res = await request(app)
      .post('/api/gateway')
      .send({
        table: 'contacts',
        operation: 'findMany',
        payload: { where: { status: 'active' }, columns: ['id', 'name', 'email'], limit: 50 },
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should project columns in response (strip disallowed)', async () => {
    const res = await request(app)
      .post('/api/gateway')
      .send({ table: 'contacts', operation: 'findMany', payload: {} });
    expect(res.status).toBe(200);
    for (const row of res.body.data) {
      expect(row).not.toHaveProperty('notes');
      expect(row).not.toHaveProperty('tenantId');
    }
  });

  it('should only include allowed columns in response', async () => {
    const res = await request(app)
      .post('/api/gateway')
      .send({ table: 'contacts', operation: 'findMany', payload: {} });
    expect(res.status).toBe(200);
    for (const row of res.body.data) {
      for (const key of Object.keys(row)) {
        expect(['id', 'name', 'email', 'status']).toContain(key);
      }
    }
  });

  it('should reject writes for unauthorized roles', async () => {
    const viewerApp = express();
    viewerApp.use(express.json());
    viewerApp.use((req, _res, next) => {
      req.ctx = { userId: 'user-2', tenantId: 'tenant-1', roles: ['viewer'] };
      next();
    });
    viewerApp.use('/api/gateway', createGatewayHandler({ db: mockDb as any, policies }));

    const res = await request(viewerApp)
      .post('/api/gateway')
      .send({ table: 'contacts', operation: 'create', payload: { data: { name: 'Test' } } });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Write access denied');
  });

  it('should reject invalid operation', async () => {
    const res = await request(app)
      .post('/api/gateway')
      .send({ table: 'contacts', operation: 'dropTable', payload: {} });
    expect(res.status).toBe(400);
  });

  it('should reject limit > 1000', async () => {
    const res = await request(app)
      .post('/api/gateway')
      .send({ table: 'contacts', operation: 'findMany', payload: { limit: 5000 } });
    expect(res.status).toBe(400);
  });

  it('should prevent client from overriding tenantId filter', async () => {
    const res = await request(app)
      .post('/api/gateway')
      .send({ table: 'contacts', operation: 'findMany', payload: { where: { tenantId: 'attacker-tenant' } } });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Disallowed filters');
  });
});
