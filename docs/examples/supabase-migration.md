# Supabase Migration Guide

Moving from Supabase to Drizzle Query Gateway? This guide shows side-by-side comparisons so you can translate your existing queries.

## Why Migrate?

| Feature | Supabase | Drizzle Query Gateway |
|---------|----------|----------------------|
| Query builder | Chainable | Chainable (same style) |
| Security model | Row-Level Security (RLS) | Policy-enforced filters (server-injected) |
| Schema definition | Dashboard / SQL | Drizzle ORM (TypeScript) |
| Type safety | Generated types | Native TypeScript types |
| Self-hosted | Supabase self-host | Any Express/Node server |
| Database | PostgreSQL only | Any Drizzle-supported DB |
| Vendor lock-in | Supabase platform | None — standard Drizzle ORM |

## Setup Comparison

### Supabase

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
);
```

### Drizzle Query Gateway

```ts
import { createQueryBuilder } from 'drizzle-query-gateway';

// Supabase-style chainable API
const gateway = createQueryBuilder({
  baseUrl: 'https://your-api.com/gateway',
  getToken: () => getAuthToken(),
});

// Or use the object-style API
import { createGatewayClient } from 'drizzle-query-gateway';

const client = createGatewayClient({
  baseUrl: 'https://your-api.com/gateway',
  getToken: () => getAuthToken(),
});
```

## Query Comparisons

### Select All Rows

::: code-group
```ts [Supabase]
const { data, error } = await supabase
  .from('contacts')
  .select('*');
```

```ts [Drizzle Gateway]
const { data, error } = await gateway
  .from('contacts')
  .select('*');
```
:::

### Select Specific Columns

::: code-group
```ts [Supabase]
const { data, error } = await supabase
  .from('contacts')
  .select('id, name, email');
```

```ts [Drizzle Gateway]
const { data, error } = await gateway
  .from('contacts')
  .select('id, name, email');
```
:::

### Filter with Equality

::: code-group
```ts [Supabase]
const { data, error } = await supabase
  .from('contacts')
  .select()
  .eq('status', 'active');
```

```ts [Drizzle Gateway]
const { data, error } = await gateway
  .from('contacts')
  .select()
  .eq('status', 'active');
```
:::

### Multiple Filters

::: code-group
```ts [Supabase]
const { data, error } = await supabase
  .from('contacts')
  .select()
  .eq('status', 'active')
  .gte('created_at', '2024-01-01')
  .lt('age', 30);
```

```ts [Drizzle Gateway]
const { data, error } = await gateway
  .from('contacts')
  .select()
  .eq('status', 'active')
  .gte('created_at', '2024-01-01')
  .lt('age', 30);
```
:::

### Not Equal

::: code-group
```ts [Supabase]
const { data } = await supabase
  .from('contacts')
  .select()
  .neq('status', 'archived');
```

```ts [Drizzle Gateway]
const { data } = await gateway
  .from('contacts')
  .select()
  .neq('status', 'archived');
```
:::

### IN Filter

::: code-group
```ts [Supabase]
const { data } = await supabase
  .from('contacts')
  .select()
  .in('status', ['active', 'pending']);
```

```ts [Drizzle Gateway]
const { data } = await gateway
  .from('contacts')
  .select()
  .in('status', ['active', 'pending']);
```
:::

### LIKE / ILIKE

::: code-group
```ts [Supabase]
const { data } = await supabase
  .from('contacts')
  .select()
  .ilike('name', '%alice%');
```

```ts [Drizzle Gateway]
const { data } = await gateway
  .from('contacts')
  .select()
  .ilike('name', '%alice%');
```
:::

### IS NULL

::: code-group
```ts [Supabase]
const { data } = await supabase
  .from('contacts')
  .select()
  .is('deleted_at', null);
```

```ts [Drizzle Gateway]
const { data } = await gateway
  .from('contacts')
  .select()
  .is('deleted_at', null);
```
:::

### Ordering

::: code-group
```ts [Supabase]
const { data } = await supabase
  .from('contacts')
  .select()
  .order('created_at', { ascending: false });
```

```ts [Drizzle Gateway]
const { data } = await gateway
  .from('contacts')
  .select()
  .order('created_at', { ascending: false });
```
:::

### Limit

::: code-group
```ts [Supabase]
const { data } = await supabase
  .from('contacts')
  .select()
  .limit(10);
```

```ts [Drizzle Gateway]
const { data } = await gateway
  .from('contacts')
  .select()
  .limit(10);
```
:::

### Range Pagination

::: code-group
```ts [Supabase]
const { data } = await supabase
  .from('contacts')
  .select()
  .range(0, 9); // rows 0-9 (10 rows)
```

```ts [Drizzle Gateway]
const { data } = await gateway
  .from('contacts')
  .select()
  .range(0, 9); // rows 0-9 (10 rows)
```
:::

### Single Row

::: code-group
```ts [Supabase]
const { data, error } = await supabase
  .from('contacts')
  .select()
  .eq('id', '123')
  .single();
```

```ts [Drizzle Gateway]
const { data, error } = await gateway
  .from('contacts')
  .select()
  .eq('id', '123')
  .single();
```
:::

### Maybe Single (no error if zero rows)

::: code-group
```ts [Supabase]
const { data } = await supabase
  .from('contacts')
  .select()
  .eq('email', 'maybe@test.com')
  .maybeSingle();
```

```ts [Drizzle Gateway]
const { data } = await gateway
  .from('contacts')
  .select()
  .eq('email', 'maybe@test.com')
  .maybeSingle();
```
:::

### Count

::: code-group
```ts [Supabase]
const { count } = await supabase
  .from('contacts')
  .select('*', { count: 'exact', head: true });
```

```ts [Drizzle Gateway]
const { data } = await gateway
  .from('contacts')
  .select('*', { count: 'exact', head: true });
```
:::

## Mutation Comparisons

### Insert

::: code-group
```ts [Supabase]
const { data, error } = await supabase
  .from('contacts')
  .insert({ name: 'Alice', email: 'alice@test.com' })
  .select();
```

```ts [Drizzle Gateway]
const { data, error } = await gateway
  .from('contacts')
  .insert({ name: 'Alice', email: 'alice@test.com' });
```
:::

### Update

::: code-group
```ts [Supabase]
const { data, error } = await supabase
  .from('contacts')
  .update({ name: 'Updated' })
  .eq('id', '123');
```

```ts [Drizzle Gateway]
const { data, error } = await gateway
  .from('contacts')
  .update({ name: 'Updated' })
  .eq('id', '123');
```
:::

### Upsert

::: code-group
```ts [Supabase]
const { data, error } = await supabase
  .from('contacts')
  .upsert({ id: '123', name: 'Alice', email: 'alice@test.com' });
```

```ts [Drizzle Gateway]
const { data, error } = await gateway
  .from('contacts')
  .upsert(
    { id: '123', name: 'Alice', email: 'alice@test.com' },
    { onConflict: 'id' }
  );
```
:::

### Delete

::: code-group
```ts [Supabase]
const { error } = await supabase
  .from('contacts')
  .delete()
  .eq('id', '123');
```

```ts [Drizzle Gateway]
const { data, error } = await gateway
  .from('contacts')
  .delete()
  .eq('id', '123');
```
:::

## Security Model Comparison

### Supabase RLS

```sql
-- Supabase: Row Level Security in SQL
CREATE POLICY "Users can only see their own data"
ON contacts FOR SELECT
USING (auth.uid() = user_id);
```

### Drizzle Query Gateway Policies

```ts
// Drizzle Gateway: Policy in TypeScript
import { definePolicy } from 'drizzle-query-gateway';
import { contacts } from './schema';

const contactsPolicy = definePolicy({
  table: contacts,
  // Server-injected filter — always applied, never client-controlled
  requiredFilters: (ctx) => ({
    tenantId: ctx.tenantId,
  }),
  allowedFilters: ['status', 'name', 'email', 'createdAt'],
  allowedColumns: ['id', 'name', 'email', 'status', 'createdAt'],
  canWrite: (ctx) => ctx.role === 'admin' || ctx.role === 'editor',
});
```

**Key difference**: Supabase uses SQL-level RLS policies. Drizzle Query Gateway uses TypeScript policies that are enforced at the application layer before queries reach the database. Both achieve row-level security, but the Gateway approach gives you:

- Full TypeScript type safety in policy definitions
- Easy testing of policies in unit tests
- No dependency on database-specific RLS features
- Works with any database Drizzle supports

## Object-Style API (Alternative)

If you prefer a more explicit API over the chainable builder, Drizzle Query Gateway also offers an object-style client:

```ts
import { createGatewayClient } from 'drizzle-query-gateway';

const client = createGatewayClient({
  baseUrl: 'https://your-api.com/gateway',
  getToken: () => getAuthToken(),
});

// Find many
const contacts = await client.contacts.findMany({
  where: { status: 'active' },
  columns: ['id', 'name', 'email'],
  limit: 50,
});

// Find first
const contact = await client.contacts.findFirst({
  where: { id: '123' },
});

// Create
const created = await client.contacts.create({
  data: { name: 'Alice', email: 'alice@test.com' },
});

// Update
const updated = await client.contacts.update({
  where: { id: '123' },
  data: { name: 'Updated' },
});

// Upsert
const upserted = await client.contacts.upsert({
  data: { name: 'Alice', email: 'alice@test.com' },
  onConflict: ['email'],
});

// Delete
const deleted = await client.contacts.delete({
  where: { id: '123' },
});

// Count
const count = await client.contacts.count({
  where: { status: 'active' },
});

// Batch queries
const results = await client.batch.execute([
  { table: 'contacts', operation: 'findMany', payload: { where: { status: 'active' } } },
  { table: 'accounts', operation: 'findMany', payload: {} },
]);
```

## Features Not Yet Supported

These Supabase features are on the roadmap but not yet implemented:

| Feature | Status |
|---------|--------|
| Real-time subscriptions | Planned |
| Full-text search | Planned |
| Stored procedures (RPC) | Planned |
| Nested relation selection | Planned |
| `nullsFirst` / `nullsLast` ordering | Planned |
| `contains` / `containedBy` (JSON/array) | Planned |
| Storage (file uploads) | Out of scope |
| Auth (user management) | Out of scope (use your own) |

## Complete Migration Example

Here's a full before/after for a typical Supabase query pattern:

### Before (Supabase)

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// List active contacts, paginated
const { data: contacts, error } = await supabase
  .from('contacts')
  .select('id, name, email, status')
  .eq('status', 'active')
  .ilike('name', '%search%')
  .order('created_at', { ascending: false })
  .range(0, 24);

if (error) {
  console.error('Failed:', error.message);
} else {
  console.log('Contacts:', contacts);
}
```

### After (Drizzle Query Gateway)

```ts
import { createQueryBuilder } from 'drizzle-query-gateway';

const gateway = createQueryBuilder({
  baseUrl: '/api/gateway',
  getToken: () => getAuthToken(),
});

// Identical query — same chaining API
const { data: contacts, error } = await gateway
  .from('contacts')
  .select('id, name, email, status')
  .eq('status', 'active')
  .ilike('name', '%search%')
  .order('created_at', { ascending: false })
  .range(0, 24);

if (error) {
  console.error('Failed:', error.message);
} else {
  console.log('Contacts:', contacts);
}
```

The query code is identical. The difference is on the server side, where you define policies in TypeScript instead of SQL-based RLS.
