# createGatewayHandler

Creates an Express router that handles gateway requests. This is the core of the gateway — it validates, enforces policies, and executes queries.

## Signature

```ts
function createGatewayHandler(config: GatewayHandlerConfig): Router
```

## Parameters

### `config.db`

- **Type:** `DrizzleDB`
- **Required:** Yes

Your Drizzle database instance. Must support `.select()`, `.insert()`, `.update()`, `.delete()`.

### `config.policies`

- **Type:** `PolicyRegistry`
- **Required:** Yes

The policy registry created by `createPolicyRegistry()`.

### `config.onError`

- **Type:** `(error: unknown, req: Request) => void`
- **Required:** No

Error callback for logging and monitoring. Called when a query execution fails (not for policy violations — those return structured errors).

```ts
onError: (error, req) => {
  logger.error('Gateway error', { table: req.body?.table, error });
}
```

### `config.maxBatchSize`

- **Type:** `number`
- **Default:** `10`

Maximum number of queries allowed in a single batch request.

## Endpoints

The router exposes two endpoints:

### `POST /` — Single Query

Request body:
```ts
{
  table: string;             // Table name (must be in policy registry)
  operation: 'findMany' | 'findFirst' | 'create' | 'update' | 'delete' | 'count';
  payload: {
    where?: Record<string, unknown>;    // Client filters
    columns?: string[];                  // Columns to return
    limit?: number;                      // Max 1000
    offset?: number;                     // For offset pagination
    orderBy?: { column: string; direction: 'asc' | 'desc' }[];
    cursor?: { column: string; value: unknown; direction?: 'asc' | 'desc' };
    data?: Record<string, unknown>;      // For create/update
  }
}
```

Response:
```ts
{ data: object[] }  // Success
{ error: string }   // Error
```

### `POST /batch` — Batch Queries

Request body:
```ts
{
  queries: Array<{
    table: string;
    operation: string;
    payload: object;
  }>
}
```

Response:
```ts
{
  results: Array<{ data?: object[] } | { error?: string }>
}
```

## Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Invalid request format (failed Zod validation) |
| `401` | Missing authentication context |
| `403` | Policy violation (table not exposed, disallowed filter/column, write denied) |
| `500` | Query execution error |

## Example

```ts
import express from 'express';
import { createGatewayHandler, createPolicyRegistry, createAuthMiddleware } from 'drizzle-query-gateway';

const app = express();
app.use(express.json());

const auth = createAuthMiddleware({ secret: process.env.JWT_SECRET! });
const policies = createPolicyRegistry([contactsPolicy, accountsPolicy]);
const gateway = createGatewayHandler({
  db,
  policies,
  onError: (err) => console.error('Gateway:', err),
  maxBatchSize: 20,
});

app.use('/api/gateway', auth, gateway);
```
