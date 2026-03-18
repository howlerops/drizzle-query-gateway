import { describe, it, expect } from 'vitest';
import { defineRelations, createRelationsRegistry, getTableRelations } from '../src/gateway/relations.js';
import { accounts, contacts } from '../src/schema/index.js';

describe('defineRelations', () => {
  it('should resolve a one-to-one relation', () => {
    const result = defineRelations(contacts, { account: { type: 'one', table: accounts, foreignKey: 'accountId' } });
    expect(result.tableName).toBe('contacts');
    expect(result.relations.account).toEqual({
      type: 'one', sourceTable: 'contacts', relatedTable: 'accounts',
      foreignKey: 'accountId', references: 'id', alias: 'account',
    });
  });

  it('should resolve a one-to-many relation', () => {
    const result = defineRelations(accounts, { contacts: { type: 'many', table: contacts, foreignKey: 'accountId' } });
    expect(result.relations.contacts).toEqual({
      type: 'many', sourceTable: 'accounts', relatedTable: 'contacts',
      foreignKey: 'accountId', references: 'id', alias: 'contacts',
    });
  });

  it('should support custom references column', () => {
    const result = defineRelations(contacts, { account: { type: 'one', table: accounts, foreignKey: 'accountId', references: 'tenantId' } });
    expect(result.relations.account.references).toBe('tenantId');
  });

  it('should handle multiple relations on one table', () => {
    const result = defineRelations(contacts, {
      account: { type: 'one', table: accounts, foreignKey: 'accountId' },
      owner: { type: 'one', table: accounts, foreignKey: 'ownerId' },
    });
    expect(Object.keys(result.relations)).toEqual(['account', 'owner']);
  });

  it('should handle empty relations', () => {
    const result = defineRelations(accounts, {});
    expect(result.relations).toEqual({});
  });
});

describe('createRelationsRegistry', () => {
  it('should build a registry from multiple definitions', () => {
    const registry = createRelationsRegistry([
      defineRelations(contacts, { account: { type: 'one', table: accounts, foreignKey: 'accountId' } }),
      defineRelations(accounts, { contacts: { type: 'many', table: contacts, foreignKey: 'accountId' } }),
    ]);
    expect(registry['contacts'].account.relatedTable).toBe('accounts');
    expect(registry['accounts'].contacts.relatedTable).toBe('contacts');
  });

  it('should overwrite on duplicate table names', () => {
    const registry = createRelationsRegistry([
      defineRelations(contacts, { account: { type: 'one', table: accounts, foreignKey: 'accountId' } }),
      defineRelations(contacts, { owner: { type: 'one', table: accounts, foreignKey: 'ownerId' } }),
    ]);
    expect(registry['contacts'].owner).toBeDefined();
    expect(registry['contacts'].account).toBeUndefined();
  });

  it('should handle empty array', () => {
    expect(createRelationsRegistry([])).toEqual({});
  });
});

describe('getTableRelations', () => {
  it('should return relations for a known table', () => {
    const registry = createRelationsRegistry([
      defineRelations(contacts, { account: { type: 'one', table: accounts, foreignKey: 'accountId' } }),
    ]);
    expect(getTableRelations(registry, 'contacts')!.account.type).toBe('one');
  });

  it('should return undefined for an unknown table', () => {
    expect(getTableRelations(createRelationsRegistry([]), 'nonexistent')).toBeUndefined();
  });
});
