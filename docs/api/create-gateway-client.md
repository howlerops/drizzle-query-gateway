# createGatewayClient

Creates a typed frontend client for querying the gateway.

## Signature

```ts
function createGatewayClient(
  config: ClientConfig,
  tableNames?: string[],
): Record<string, TableClient> & { batch: BatchClient }
```

## Parameters

### `config.baseUrl`

- **Type:** `string`
- **Required:** Yes

Full URL of the gateway endpoint (e.g., `http://localhost:3000/api/gateway`).

### `config.getToken`

- **Type:** `() => string | Promise<string>`
- **Required:** Yes

Function that returns the current auth token. Can be sync or async.

### `config.fetch`

- **Type:** `typeof fetch`
- **Required:** No
- **Default:** `globalThis.fetch`

Custom fetch implementation. Useful for testing or adding request interceptors.

### `tableNames`

- **Type:** `string[]`
- **Required:** No

If provided, accessing a table not in this list throws a `GatewayClientError` at runtime. Provides client-side validation before a request is sent.

## Return Value

Returns a Proxy object where each property access returns a `TableClient`:

### TableClient Methods

#### `findMany(options?)`

```ts
const contacts = await gateway.contacts.findMany({
  where: { status: 'active' },
  columns: ['id', 'name', 'email'],
  limit: 50,
  offset: 0,
  orderBy: [{ column: 'createdAt', direction: 'desc' }],
  cursor: { column: 'id', value: 'last-id', direction: 'asc' },
});
// Returns: Record<string, unknown>[]
```

#### `findFirst(options?)`

```ts
const contact = await gateway.contacts.findFirst({
  where: { ownerId: 'user-123' },
  columns: ['id', 'name'],
});
// Returns: Record<string, unknown> | null
```

#### `count(options?)`

```ts
const total = await gateway.contacts.count({
  where: { status: 'active' },
});
// Returns: number
```

#### `create(options)`

```ts
const created = await gateway.contacts.create({
  data: { name: 'Alice', email: 'alice@example.com' },
});
// Returns: Record<string, unknown>
```

#### `update(options)`

```ts
const updated = await gateway.contacts.update({
  where: { status: 'inactive' },
  data: { status: 'archived' },
});
// Returns: Record<string, unknown>[]
```

#### `delete(options)`

```ts
const deleted = await gateway.contacts.delete({
  where: { status: 'archived' },
});
// Returns: Record<string, unknown>[]
```

### Batch Client

The `batch` property provides batch query support:

```ts
const results = await gateway.batch.execute([
  { table: 'contacts', operation: 'findMany', payload: { where: { status: 'active' } } },
  { table: 'contacts', operation: 'count', payload: {} },
  { table: 'accounts', operation: 'findMany', payload: { limit: 10 } },
]);
// Returns: Array<{ data?: unknown; error?: string }>
```

## Error Handling

All methods throw `GatewayClientError` on failure:

```ts
import { GatewayClientError } from 'drizzle-query-gateway/client';

try {
  await gateway.contacts.findMany();
} catch (err) {
  if (err instanceof GatewayClientError) {
    console.log(err.message);    // "Table not exposed"
    console.log(err.statusCode); // 403
  }
}
```

## React Example

```tsx
import { createGatewayClient } from 'drizzle-query-gateway/client';
import { useEffect, useState } from 'react';

const gateway = createGatewayClient({
  baseUrl: '/api/gateway',
  getToken: () => localStorage.getItem('token')!,
});

function ContactsList() {
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    gateway.contacts.findMany({
      where: { status: 'active' },
      columns: ['id', 'name', 'email'],
      limit: 50,
    }).then(setContacts);
  }, []);

  return (
    <ul>
      {contacts.map((c) => (
        <li key={c.id}>{c.name} — {c.email}</li>
      ))}
    </ul>
  );
}
```
