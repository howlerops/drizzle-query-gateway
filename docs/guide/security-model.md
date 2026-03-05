# Security Model

The Drizzle Query Gateway's security model is **structural, not conventional**. This means the client literally cannot express a query that bypasses your security rules — the server enforces them automatically.

## Core Principle: Server-Injected Filters

The most important security mechanism is **required filters**. These are filters that the server always injects into every query, based on the authenticated user's context:

```ts
const contactsPolicy = definePolicy({
  table: schema.contacts,
  requiredFilters: (ctx) => ({
    tenantId: ctx.tenantId,  // Always injected, never from client
  }),
  // ...
});
```

When a client sends:
```json
{ "table": "contacts", "operation": "findMany", "payload": { "where": { "status": "active" } } }
```

The gateway transforms it to:
```json
{ "where": { "status": "active", "tenantId": "tenant-from-jwt" } }
```

The client never supplies `tenantId`. It's never asked to. The server always sets it from the JWT-verified context.

## Defense in Depth

The gateway applies multiple layers of security checks:

### Layer 1: Authentication

Every request must include a valid JWT. The auth middleware verifies it and extracts:

```ts
ctx = {
  userId: "user-123",
  tenantId: "tenant-456",
  roles: ["editor", "viewer"]
}
```

Invalid or expired tokens get `401` immediately.

### Layer 2: Table Access Control

Only tables with an explicit policy are accessible. Requesting an unexposed table returns `403`:

```ts
// Only contacts and accounts are exposed
const policies = createPolicyRegistry([contactsPolicy, accountsPolicy]);

// POST { table: "users", ... } → 403 "Table not exposed"
```

### Layer 3: Filter Validation

Client-supplied filters must be in the `allowedFilters` list. Attempting to filter on a column not in the list (including `tenantId`) returns `403`:

```ts
allowedFilters: ['status', 'ownerId', 'createdAt']

// Client sends: where: { notes: 'secret' }
// → 403 "Disallowed filters: notes"

// Client tries: where: { tenantId: 'other-tenant' }
// → 403 "Disallowed filters: tenantId"
```

### Layer 4: Required Filter Injection

After validation, the server merges required filters. They always win over client-supplied values:

```ts
const mergedFilters = {
  ...payload.where,          // Client filters (already validated)
  ...requiredFilters(ctx),   // Server-injected — ALWAYS spread last
};
```

Even if the validation logic were bypassed, required filters override anything the client sends.

### Layer 5: Column Projection

Only columns in `allowedColumns` are returned. This happens at two levels:

1. **Query level** — Drizzle only selects allowed columns from the database
2. **Response level** — Results are projected server-side before sending (defense in depth)

```ts
allowedColumns: ['id', 'name', 'email', 'status']

// Even if the DB query returns more columns due to a join,
// the response only includes the allowed columns
```

### Layer 6: Mutation Guards

Write operations (`create`, `update`, `delete`) are gated by the `canWrite` function:

```ts
canWrite: (ctx) => ctx.roles.includes('editor')

// Viewer tries to create → 403 "Write access denied"
```

## Comparison to RLS

| Feature | Gateway Policies | Postgres RLS |
|---------|-----------------|--------------|
| **Where enforced** | Application layer | Database layer |
| **Portability** | Any database Drizzle supports | PostgreSQL only |
| **Type safety** | Full TypeScript types | SQL policies |
| **Column filtering** | Built-in `allowedColumns` | Requires views |
| **Mutation guards** | `canWrite(ctx)` | Row-level `WITH CHECK` |
| **Debug experience** | Application logs, standard errors | `pg_stat_activity` |
| **Performance** | Queries already filtered by app | DB does the filtering |

Both approaches are valid. The gateway is portable and TypeScript-native. Postgres RLS is closer to the data. You can even use both together for maximum security.

## What the Gateway Does NOT Do

- **Complex authorization logic** — If you need attribute-based access control (ABAC) or graph-based permissions, add those checks in custom middleware before the gateway.
- **Field-level encryption** — The gateway strips columns, it doesn't encrypt them.
- **Rate limiting** — Add rate limiting middleware upstream of the gateway.
- **SQL injection protection** — Drizzle ORM handles parameterized queries. The gateway never constructs raw SQL.

## Security Checklist

- [ ] JWT secret is stored securely (env var, not hardcoded)
- [ ] Every table that should be accessible has an explicit policy
- [ ] Required filters include `tenantId` for multi-tenant apps
- [ ] `allowedFilters` does NOT include columns used in required filters
- [ ] `allowedColumns` excludes sensitive fields (notes, internal IDs, etc.)
- [ ] `canWrite` properly checks roles for each table
- [ ] Auth middleware rejects requests without valid tokens
- [ ] The gateway is the only path to the database for frontend clients
