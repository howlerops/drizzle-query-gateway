# Getting Started

## Installation

```bash
npm install drizzle-query-gateway
```

The package includes both the server-side gateway and the frontend client.

**Peer dependencies** (install separately):
```bash
npm install drizzle-orm express jose zod
```

## 1. Define Your Schema

The gateway uses your existing Drizzle schema as the single source of truth:

```ts
// schema.ts
import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  ownerId: uuid('owner_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

## 2. Define Policies

Each policy declares what a table exposes through the gateway:

```ts
// policies.ts
import { definePolicy } from 'drizzle-query-gateway';
import * as schema from './schema';

export const contactsPolicy = definePolicy({
  table: schema.contacts,

  // Always injected from server context — client cannot omit or override
  requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),

  // Client may filter on these columns only
  allowedFilters: ['status', 'ownerId', 'createdAt'],

  // Only these columns are readable
  allowedColumns: ['id', 'name', 'email', 'status', 'ownerId'],

  // Role guard for mutations
  canWrite: (ctx) => ctx.roles.includes('editor'),
});
```

## 3. Mount the Gateway

Wire up the gateway as Express middleware:

```ts
// server.ts
import express from 'express';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  createAuthMiddleware,
  createGatewayHandler,
  createPolicyRegistry,
} from 'drizzle-query-gateway';
import { contactsPolicy } from './policies';

const app = express();
app.use(express.json());

// Auth middleware — verifies JWT, builds { userId, tenantId, roles }
const auth = createAuthMiddleware({
  secret: process.env.JWT_SECRET!,
});

// Policy registry
const policies = createPolicyRegistry([contactsPolicy]);

// Drizzle database connection
const db = drizzle(process.env.DATABASE_URL!);

// Mount the gateway behind auth
app.use('/api/gateway', auth, createGatewayHandler({ db, policies }));

app.listen(3000, () => {
  console.log('Gateway running on http://localhost:3000');
});
```

## 4. Query from the Frontend

The gateway offers two client styles. Both hit the same server endpoint.

### Option A: Chainable Query Builder (Supabase-style)

```ts
import { createQueryBuilder } from 'drizzle-query-gateway';

const gateway = createQueryBuilder({
  baseUrl: 'http://localhost:3000/api/gateway',
  getToken: () => localStorage.getItem('token')!,
});

// Select with filters — tenantId is injected server-side automatically
const { data: contacts, error } = await gateway
  .from('contacts')
  .select('id, name, email')
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(50);

// Single row
const { data: contact } = await gateway
  .from('contacts')
  .select()
  .eq('id', 'user-123')
  .single();

// Insert
const { data: created } = await gateway
  .from('contacts')
  .insert({ name: 'Alice', email: 'alice@example.com', status: 'active' });

// Upsert
const { data: upserted } = await gateway
  .from('contacts')
  .upsert({ id: '123', name: 'Alice' }, { onConflict: 'id' });
```

### Option B: Object-Style Client

```ts
import { createGatewayClient } from 'drizzle-query-gateway/client';

const gateway = createGatewayClient({
  baseUrl: 'http://localhost:3000/api/gateway',
  getToken: () => localStorage.getItem('token')!,
});

// findMany — tenantId is injected server-side automatically
const contacts = await gateway.contacts.findMany({
  where: { status: 'active' },
  columns: ['id', 'name', 'email'],
  limit: 50,
});

// findFirst
const contact = await gateway.contacts.findFirst({
  where: { ownerId: 'user-123' },
});

// count
const total = await gateway.contacts.count({
  where: { status: 'active' },
});

// create (requires editor role via canWrite)
const created = await gateway.contacts.create({
  data: { name: 'Alice', email: 'alice@example.com', status: 'active' },
});

// upsert
const upserted = await gateway.contacts.upsert({
  data: { name: 'Alice', email: 'alice@example.com' },
  onConflict: ['email'],
});

// batch — multiple queries in one request
const results = await gateway.batch.execute([
  { table: 'contacts', operation: 'findMany', payload: { where: { status: 'active' } } },
  { table: 'contacts', operation: 'count', payload: {} },
]);
```

## What Happens Under the Hood

Every request goes through this pipeline:

1. **Serialize** — Client serializes the query to JSON and POSTs to `/api/gateway`
2. **Verify auth** — JWT is verified; `ctx = { userId, tenantId, roles }` is built
3. **Validate shape** — Table exposed? Columns allowed? Filters allowed? Violations → `403`
4. **Inject filters** — Server merges required filters (`tenantId`) — client cannot override
5. **Execute** — Policy-validated query is handed to Drizzle server-side
6. **Project & respond** — Disallowed columns are stripped; typed response is returned

## Next Steps

- [Security Model](/guide/security-model) — How structural security works
- [Architecture](/guide/architecture) — System diagram and design decisions
- [API Reference](/api/define-policy) — Full API documentation
- [Examples](/examples/basic-crud) — Common patterns
