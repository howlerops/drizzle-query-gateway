# definePolicy

Creates a policy definition for a Drizzle table. Policies control what the gateway exposes for each table.

## Signature

```ts
function definePolicy<T extends Table>(config: PolicyConfig<T>): Policy<T>
```

## Parameters

### `config.table`

- **Type:** `Table` (Drizzle table reference)
- **Required:** Yes

The Drizzle table this policy applies to. The table name is extracted automatically.

### `config.requiredFilters`

- **Type:** `(ctx: GatewayContext) => Record<string, unknown>`
- **Required:** Yes

A function that returns filters to always inject into every query. These filters:
- Are built from the server-side user context (JWT claims)
- Cannot be omitted by the client
- Cannot be overridden by the client (they're spread last)
- Typically enforce tenant isolation

```ts
requiredFilters: (ctx) => ({
  tenantId: ctx.tenantId,
  // Can inject multiple required filters
  deletedAt: null,
})
```

### `config.allowedFilters`

- **Type:** `string[]`
- **Required:** Yes

Column names the client is permitted to filter on. Any filter not in this list returns `403`.

::: warning
Do **not** include columns that appear in `requiredFilters`. If `tenantId` is a required filter, it should not be in `allowedFilters` — this prevents the client from even attempting to filter on it.
:::

### `config.allowedColumns`

- **Type:** `string[]`
- **Required:** Yes

Column names the client may read. Any column not in this list is:
- Rejected if explicitly requested (returns `403`)
- Stripped from query results (defense in depth)

### `config.canWrite`

- **Type:** `(ctx: GatewayContext) => boolean`
- **Required:** Yes

A function that determines whether the current user can perform mutations (`create`, `update`, `delete`). Receives the full user context.

```ts
canWrite: (ctx) => ctx.roles.includes('editor') || ctx.roles.includes('admin')
```

## Return Value

Returns a `Policy<T>` object with all the config fields plus a `tableName` string extracted from the Drizzle table.

## Example

```ts
import { definePolicy } from 'drizzle-query-gateway';
import { contacts } from './schema';

export const contactsPolicy = definePolicy({
  table: contacts,
  requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
  allowedFilters: ['status', 'ownerId', 'createdAt'],
  allowedColumns: ['id', 'name', 'email', 'status', 'ownerId'],
  canWrite: (ctx) => ctx.roles.includes('editor'),
});
```

## Related

- [`createPolicyRegistry`](#createpolicyregistry) — Combine policies into a registry
- [`createGatewayHandler`](/api/create-gateway-handler) — Mount policies as an Express handler

---

# createPolicyRegistry

Combines an array of policies into a registry keyed by table name.

## Signature

```ts
function createPolicyRegistry(policies: Policy[]): PolicyRegistry
```

## Example

```ts
import { createPolicyRegistry } from 'drizzle-query-gateway';

const policies = createPolicyRegistry([
  contactsPolicy,
  accountsPolicy,
]);
// policies = { contacts: contactsPolicy, accounts: accountsPolicy }
```
