# drizzle-query-gateway

A policy-enforced, type-safe query proxy for [Drizzle ORM](https://orm.drizzle.team). Expose your database through a single HTTP endpoint with row-level security, column filtering, and role-based mutation guards — all defined in plain TypeScript.

## Install

Add the `@howlerops` scope to your `.npmrc` (one-time setup):

```bash
echo "@howlerops:registry=https://npm.pkg.github.com" >> .npmrc
```

Then install:

```bash
npm install @howlerops/drizzle-query-gateway
```

The package is public — no auth token is required to install.

## Why

Frontend apps need data, but giving them raw database access is dangerous. Traditional approaches require writing one REST endpoint per resource, duplicating authorization logic everywhere. `drizzle-query-gateway` replaces all of that with:

- **One endpoint** — a single `POST /api/gateway` handles all reads and writes
- **Policy enforcement** — required filters (e.g. `tenantId`) are injected server-side and cannot be bypassed
- **Column projection** — clients only see columns you explicitly allow
- **Mutation guards** — role-based `canWrite` checks control who can create, update, or delete
- **Type-safe client** — a chainable query builder with Supabase-style ergonomics

## Quick Start

### Server

```ts
import express from 'express';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  createAuthMiddleware,
  createGatewayHandler,
  createPolicyRegistry,
  definePolicy,
} from '@howlerops/drizzle-query-gateway';
import { contacts } from './schema.js';

const db = drizzle(process.env.DATABASE_URL!);
const app = express();
app.use(express.json());

// Define a policy for the contacts table
const contactsPolicy = definePolicy({
  table: contacts,
  requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
  allowedFilters: ['status', 'ownerId', 'createdAt'],
  allowedColumns: ['id', 'name', 'email', 'status', 'ownerId', 'createdAt'],
  canWrite: (ctx) => ctx.roles.includes('editor'),
});

const auth = createAuthMiddleware({ secret: process.env.JWT_SECRET! });
const policies = createPolicyRegistry([contactsPolicy]);
const gateway = createGatewayHandler({ db, policies });

app.use('/api/gateway', auth, gateway);
app.listen(3000);
```

### Client

```ts
import { createQueryBuilder } from '@howlerops/drizzle-query-gateway';

const gateway = createQueryBuilder({
  baseUrl: 'http://localhost:3000/api/gateway',
  token: 'your-jwt-token',
});

// Supabase-style chainable API
const { data, error } = await gateway
  .from('contacts')
  .select('id, name, email')
  .eq('status', 'active')
  .order('createdAt', { ascending: false })
  .limit(50);
```

## API

### Server Exports

| Export | Description |
|---|---|
| `definePolicy(config)` | Create a typed policy for a Drizzle table |
| `createPolicyRegistry(policies)` | Build a registry from an array of policies |
| `createGatewayHandler({ db, policies })` | Express router handling query and batch endpoints |
| `createAuthMiddleware({ secret })` | JWT middleware that populates `req.ctx` with `GatewayContext` |
| `executeQuery(db, table, request, policy, ctx)` | Low-level query executor |

### Client Exports

| Export | Description |
|---|---|
| `createGatewayClient(config)` | Programmatic client with `findMany`, `findFirst`, `count`, `create`, `update`, `delete`, `upsert` |
| `createQueryBuilder(config)` | Supabase-style chainable `.from().select().eq().limit()` builder |
| `GatewayClientError` | Typed error class for gateway responses |

### Operations

| Operation | Description |
|---|---|
| `findMany` | Fetch multiple rows with filters, ordering, pagination |
| `findFirst` | Fetch a single row |
| `count` | Count matching rows |
| `create` | Insert a new row |
| `update` | Update rows matching filters |
| `delete` | Delete rows matching filters |
| `upsert` | Insert or update on conflict |

### Filter Operators

Supabase-compatible filter operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `like`, `ilike`, `is`.

## Batch Queries

Send multiple queries in a single round-trip:

```ts
const client = createGatewayClient({
  baseUrl: 'http://localhost:3000/api/gateway',
  token: 'your-jwt-token',
});

const results = await client.batch([
  { table: 'contacts', operation: 'findMany', payload: { where: { status: 'active' } } },
  { table: 'accounts', operation: 'count', payload: {} },
]);
```

## Policies

Policies are the core security primitive. Each policy defines what a table exposes and to whom:

```ts
const accountsPolicy = definePolicy({
  table: accounts,
  // Always injected server-side — ensures tenant isolation
  requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
  // Columns the client may filter on
  allowedFilters: ['isActive', 'industry'],
  // Columns the client may read
  allowedColumns: ['id', 'name', 'industry', 'isActive', 'website'],
  // Role guard for mutations
  canWrite: (ctx) => ctx.roles.includes('admin'),
});
```

## License

MIT
