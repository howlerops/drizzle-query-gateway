import { describe, it, expect } from 'vitest';
import { definePolicyFromSchema, definePoliciesFromSchema } from '../src/gateway/auto-policy.js';
import { accounts, contacts } from '../src/schema/index.js';
import type { GatewayContext } from '../src/types.js';

const mockCtx: GatewayContext = { userId: 'user-1', tenantId: 'tenant-1', roles: ['admin'] };

describe('definePolicyFromSchema', () => {
  it('should auto-expose all columns from a table', () => {
    const policy = definePolicyFromSchema(accounts);
    expect(policy.tableName).toBe('accounts');
    expect(policy.allowedColumns).toEqual(['id', 'tenantId', 'name', 'industry', 'website', 'isActive', 'createdAt', 'updatedAt']);
  });

  it('should auto-expose all columns as filterable', () => {
    const policy = definePolicyFromSchema(accounts);
    expect(policy.allowedFilters).toEqual(policy.allowedColumns);
  });

  it('should default canWrite to false', () => {
    const policy = definePolicyFromSchema(accounts);
    expect(policy.canWrite(mockCtx)).toBe(false);
  });

  it('should default requiredFilters to empty', () => {
    const policy = definePolicyFromSchema(accounts);
    expect(policy.requiredFilters(mockCtx)).toEqual({});
  });

  it('should exclude columns via excludeColumns', () => {
    const policy = definePolicyFromSchema(accounts, { excludeColumns: ['createdAt', 'updatedAt'] });
    expect(policy.allowedColumns).not.toContain('createdAt');
    expect(policy.allowedColumns).not.toContain('updatedAt');
    expect(policy.allowedColumns).toContain('id');
  });

  it('should exclude filters via excludeFilters', () => {
    const policy = definePolicyFromSchema(contacts, { excludeFilters: ['notes'] });
    expect(policy.allowedFilters).not.toContain('notes');
    expect(policy.allowedFilters).toContain('email');
  });

  it('should override allowedColumns explicitly', () => {
    const policy = definePolicyFromSchema(accounts, { allowedColumns: ['id', 'name'] });
    expect(policy.allowedColumns).toEqual(['id', 'name']);
  });

  it('should override allowedFilters explicitly', () => {
    const policy = definePolicyFromSchema(accounts, { allowedFilters: ['id', 'tenantId'] });
    expect(policy.allowedFilters).toEqual(['id', 'tenantId']);
  });

  it('should apply requiredFilters override', () => {
    const policy = definePolicyFromSchema(accounts, { requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }) });
    expect(policy.requiredFilters(mockCtx)).toEqual({ tenantId: 'tenant-1' });
  });

  it('should apply canWrite override', () => {
    const policy = definePolicyFromSchema(accounts, { canWrite: (ctx) => ctx.roles.includes('admin') });
    expect(policy.canWrite(mockCtx)).toBe(true);
    expect(policy.canWrite({ ...mockCtx, roles: ['viewer'] })).toBe(false);
  });

  it('should keep table reference', () => {
    const policy = definePolicyFromSchema(contacts);
    expect(policy.table).toBe(contacts);
  });

  it('should combine excludeColumns and requiredFilters', () => {
    const policy = definePolicyFromSchema(contacts, {
      excludeColumns: ['notes', 'phone'],
      requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
    });
    expect(policy.allowedColumns).not.toContain('notes');
    expect(policy.allowedColumns).not.toContain('phone');
    expect(policy.requiredFilters(mockCtx)).toEqual({ tenantId: 'tenant-1' });
  });
});

describe('definePoliciesFromSchema', () => {
  it('should generate policies for all tables in schema', () => {
    const policies = definePoliciesFromSchema({ accounts, contacts });
    expect(policies).toHaveLength(2);
    expect(policies.map(p => p.tableName).sort()).toEqual(['accounts', 'contacts']);
  });

  it('should skip non-table exports', () => {
    const policies = definePoliciesFromSchema({ accounts, contacts, someHelper: () => 'nope', someStr: 'nope' });
    expect(policies).toHaveLength(2);
  });

  it('should apply defaults to all tables', () => {
    const policies = definePoliciesFromSchema({ accounts, contacts }, {
      defaults: { requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }), canWrite: () => false },
    });
    for (const p of policies) {
      expect(p.requiredFilters(mockCtx)).toEqual({ tenantId: 'tenant-1' });
      expect(p.canWrite(mockCtx)).toBe(false);
    }
  });

  it('should apply per-table overrides', () => {
    const policies = definePoliciesFromSchema({ accounts, contacts }, {
      overrides: { contacts: { excludeColumns: ['notes'] } },
    });
    expect(policies.find(p => p.tableName === 'contacts')!.allowedColumns).not.toContain('notes');
    expect(policies.find(p => p.tableName === 'accounts')!.allowedColumns).toContain('name');
  });

  it('should merge defaults with per-table overrides', () => {
    const policies = definePoliciesFromSchema({ accounts, contacts }, {
      defaults: { requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }) },
      overrides: { contacts: { excludeColumns: ['notes'], canWrite: (ctx) => ctx.roles.includes('admin') } },
    });
    const cp = policies.find(p => p.tableName === 'contacts')!;
    expect(cp.allowedColumns).not.toContain('notes');
    expect(cp.canWrite(mockCtx)).toBe(true);
  });
});
