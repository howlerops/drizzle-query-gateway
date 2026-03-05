import { describe, it, expect } from 'vitest';
import { definePolicy, createPolicyRegistry, validateShape, intersectColumns, projectColumns } from '../src/gateway/policy.js';
import { contacts, accounts } from '../src/schema/index.js';
import type { GatewayContext } from '../src/types.js';

const mockCtx: GatewayContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  roles: ['editor'],
};

const readOnlyCtx: GatewayContext = {
  userId: 'user-2',
  tenantId: 'tenant-1',
  roles: ['viewer'],
};

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

describe('definePolicy', () => {
  it('should create a policy with the correct table name', () => {
    expect(contactsPolicy.tableName).toBe('contacts');
    expect(accountsPolicy.tableName).toBe('accounts');
  });

  it('should preserve all config fields', () => {
    expect(contactsPolicy.allowedFilters).toEqual(['status', 'ownerId', 'createdAt']);
    expect(contactsPolicy.allowedColumns).toEqual(['id', 'name', 'email', 'status']);
    expect(contactsPolicy.requiredFilters(mockCtx)).toEqual({ tenantId: 'tenant-1' });
    expect(contactsPolicy.canWrite(mockCtx)).toBe(true);
  });
});

describe('createPolicyRegistry', () => {
  it('should create a registry keyed by table name', () => {
    const registry = createPolicyRegistry([contactsPolicy, accountsPolicy]);
    expect(registry['contacts']).toBe(contactsPolicy);
    expect(registry['accounts']).toBe(accountsPolicy);
    expect(Object.keys(registry)).toHaveLength(2);
  });
});

describe('validateShape', () => {
  it('should return null for valid read requests', () => {
    const result = validateShape(
      { where: { status: 'active' }, columns: ['id', 'name'] },
      contactsPolicy,
      'findMany',
      mockCtx,
    );
    expect(result).toBeNull();
  });

  it('should reject disallowed filters', () => {
    const result = validateShape(
      { where: { notes: 'secret' } },
      contactsPolicy,
      'findMany',
      mockCtx,
    );
    expect(result).toBe('Disallowed filters: notes');
  });

  it('should reject multiple disallowed filters', () => {
    const result = validateShape(
      { where: { notes: 'x', phone: '555' } },
      contactsPolicy,
      'findMany',
      mockCtx,
    );
    expect(result).toContain('Disallowed filters');
    expect(result).toContain('notes');
    expect(result).toContain('phone');
  });

  it('should reject disallowed columns', () => {
    const result = validateShape(
      { columns: ['id', 'notes'] },
      contactsPolicy,
      'findMany',
      mockCtx,
    );
    expect(result).toBe('Disallowed columns: notes');
  });

  it('should reject writes for non-writers', () => {
    const result = validateShape(
      { data: { name: 'New' } },
      contactsPolicy,
      'create',
      readOnlyCtx,
    );
    expect(result).toBe('Write access denied');
  });

  it('should allow writes for editors', () => {
    const result = validateShape(
      { data: { name: 'New' } },
      contactsPolicy,
      'create',
      mockCtx,
    );
    expect(result).toBeNull();
  });

  it('should reject write data with disallowed columns', () => {
    const result = validateShape(
      { data: { name: 'New', notes: 'secret' } },
      contactsPolicy,
      'update',
      mockCtx,
    );
    expect(result).toBe('Disallowed write columns: notes');
  });

  it('should allow requests with no where or columns', () => {
    const result = validateShape({}, contactsPolicy, 'findMany', mockCtx);
    expect(result).toBeNull();
  });

  it('should block client from filtering on required filter columns', () => {
    // tenantId is NOT in allowedFilters, so it should be rejected
    const result = validateShape(
      { where: { tenantId: 'attacker-tenant' } },
      contactsPolicy,
      'findMany',
      mockCtx,
    );
    expect(result).toBe('Disallowed filters: tenantId');
  });
});

describe('intersectColumns', () => {
  it('should return only columns in both sets', () => {
    const result = intersectColumns(['id', 'name', 'notes'], ['id', 'name', 'email', 'status']);
    expect(result).toEqual(['id', 'name']);
  });

  it('should return all allowed columns when none requested', () => {
    const result = intersectColumns(undefined, ['id', 'name', 'email']);
    expect(result).toEqual(['id', 'name', 'email']);
  });

  it('should return all allowed columns for empty array', () => {
    const result = intersectColumns([], ['id', 'name']);
    expect(result).toEqual(['id', 'name']);
  });
});

describe('projectColumns', () => {
  it('should strip disallowed columns from result rows', () => {
    const rows = [
      { id: '1', name: 'Alice', email: 'a@b.com', notes: 'secret', phone: '555' },
      { id: '2', name: 'Bob', email: 'b@b.com', notes: 'hidden', phone: '666' },
    ];
    const result = projectColumns(rows, ['id', 'name', 'email']);
    expect(result).toEqual([
      { id: '1', name: 'Alice', email: 'a@b.com' },
      { id: '2', name: 'Bob', email: 'b@b.com' },
    ]);
  });

  it('should handle empty rows', () => {
    const result = projectColumns([], ['id', 'name']);
    expect(result).toEqual([]);
  });

  it('should handle missing columns gracefully', () => {
    const rows = [{ id: '1', name: 'Alice' }];
    const result = projectColumns(rows, ['id', 'name', 'email']);
    expect(result).toEqual([{ id: '1', name: 'Alice' }]);
  });
});
