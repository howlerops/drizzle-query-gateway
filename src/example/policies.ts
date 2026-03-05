import { definePolicy } from '../gateway/policy.js';
import { contacts, accounts } from '../schema/index.js';

/**
 * Example policy definitions demonstrating multi-tenant access control.
 *
 * Each policy defines:
 * - requiredFilters: Server-injected filters (tenantId isolation)
 * - allowedFilters: What the client can filter on
 * - allowedColumns: What the client can read
 * - canWrite: Role-based mutation guard
 */

export const contactsPolicy = definePolicy({
  table: contacts,
  requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
  allowedFilters: ['status', 'ownerId', 'createdAt'],
  allowedColumns: ['id', 'name', 'email', 'status', 'ownerId', 'createdAt'],
  canWrite: (ctx) => ctx.roles.includes('editor') || ctx.roles.includes('admin'),
});

export const accountsPolicy = definePolicy({
  table: accounts,
  requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
  allowedFilters: ['isActive', 'industry'],
  allowedColumns: ['id', 'name', 'industry', 'isActive', 'website'],
  canWrite: (ctx) => ctx.roles.includes('admin'),
});

export const allPolicies = [contactsPolicy, accountsPolicy];
