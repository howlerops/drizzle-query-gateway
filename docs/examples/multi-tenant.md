# Multi-Tenant Isolation

This example shows how the gateway enforces tenant isolation structurally. Tenants can never access each other's data — the server always injects `tenantId`.

## Schema

```ts
import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  industry: varchar('industry', { length: 100 }),
  website: text('website'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  accountId: uuid('account_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

## Policies

```ts
import { definePolicy, createPolicyRegistry } from 'drizzle-query-gateway';
import { accounts, contacts } from './schema';

const accountsPolicy = definePolicy({
  table: accounts,
  requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
  allowedFilters: ['isActive', 'industry'],
  allowedColumns: ['id', 'name', 'industry', 'website', 'isActive'],
  canWrite: (ctx) => ctx.roles.includes('admin'),
});

const contactsPolicy = definePolicy({
  table: contacts,
  requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
  allowedFilters: ['status', 'accountId'],
  allowedColumns: ['id', 'name', 'email', 'status', 'accountId'],
  canWrite: (ctx) => ctx.roles.includes('editor') || ctx.roles.includes('admin'),
});

export const policies = createPolicyRegistry([accountsPolicy, contactsPolicy]);
```

## Why This is Secure

### 1. tenantId is Never in the Client's Hands

The client sends:
```json
{
  "table": "contacts",
  "operation": "findMany",
  "payload": { "where": { "status": "active" } }
}
```

The server transforms it to:
```sql
SELECT id, name, email, status, account_id
FROM contacts
WHERE status = 'active' AND tenant_id = 'tenant-from-jwt'
```

### 2. tenantId Cannot Be Filtered By the Client

Since `tenantId` is not in `allowedFilters`, attempting to filter on it returns `403`:

```json
{
  "table": "contacts",
  "operation": "findMany",
  "payload": { "where": { "tenantId": "other-tenant" } }
}
// → 403 "Disallowed filters: tenantId"
```

### 3. Required Filters Always Win

Even if validation were bypassed, required filters are spread **last**:

```ts
const mergedFilters = {
  ...payload.where,           // Client's filters
  ...requiredFilters(ctx),    // Server always wins
};
```

### 4. tenantId is Stripped from Responses

Since `tenantId` is not in `allowedColumns`, it never appears in responses.

## Batch Queries Across Tables

Load related data in one request:

```ts
const results = await gateway.batch.execute([
  {
    table: 'accounts',
    operation: 'findMany',
    payload: { where: { isActive: true }, limit: 20 },
  },
  {
    table: 'contacts',
    operation: 'count',
    payload: { where: { status: 'active' } },
  },
]);

const accounts = results[0].data;
const contactCount = results[1].data;
```

Each query in the batch is independently validated against its policy. Tenant isolation applies to every query.
