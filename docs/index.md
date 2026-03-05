---
layout: home

hero:
  name: Drizzle Query Gateway
  text: Policy-Enforced, Type-Safe Query Proxy
  tagline: Call Drizzle directly from the frontend — safely. Define policies once, enforce them everywhere.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/jbeck018/drizzle-query-gateway

features:
  - title: Structural Security
    details: Required filters (like tenantId) are injected server-side. The client can never bypass, omit, or override them. Security is enforced by design, not convention.
  - title: Type-Safe Client
    details: The frontend client is generated from your policy definitions. Requesting a disallowed column or filter is a TypeScript error at compile time and a 403 at runtime.
  - title: Zero Boilerplate
    details: No per-endpoint route handlers for read operations. Define a policy in ~10 lines. Types flow automatically from DB schema → policy → frontend client.
  - title: Batch Queries
    details: Send multiple queries in a single HTTP request. Reduce round-trips and improve frontend performance with the built-in batch endpoint.
  - title: Cursor Pagination
    details: Built-in support for cursor-based pagination alongside traditional offset/limit. Efficient for large datasets and infinite scroll UIs.
  - title: Gradual Adoption
    details: Works alongside your existing API layer (GraphQL, tRPC, REST). Use the gateway for straightforward data access where you'd otherwise write thin CRUD endpoints.
---

## Quick Example

**Server — define a policy:**

```ts
import { definePolicy, createPolicyRegistry, createGatewayHandler } from 'drizzle-query-gateway';

const contactsPolicy = definePolicy({
  table: schema.contacts,
  requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
  allowedFilters: ['status', 'ownerId'],
  allowedColumns: ['id', 'name', 'email', 'status'],
  canWrite: (ctx) => ctx.roles.includes('editor'),
});
```

**Client — query with full type safety:**

```ts
import { createGatewayClient } from 'drizzle-query-gateway/client';

const gateway = createGatewayClient({ baseUrl: '/api/gateway', getToken });

const contacts = await gateway.contacts.findMany({
  where: { status: 'active' },
  columns: ['id', 'name', 'email'],
  limit: 50,
});
// tenantId is always injected server-side — you never pass it
```
