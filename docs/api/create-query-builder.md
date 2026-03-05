# createQueryBuilder

Creates a Supabase-style chainable query builder for the gateway. This is an alternative to the [object-style client](/api/create-gateway-client) — both hit the same server endpoint.

## Signature

```ts
function createQueryBuilder(config: QueryBuilderConfig): {
  from(table: string): QueryBuilder;
}
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

## Usage

```ts
import { createQueryBuilder } from 'drizzle-query-gateway';

const gateway = createQueryBuilder({
  baseUrl: '/api/gateway',
  getToken: () => localStorage.getItem('token')!,
});
```

## QueryBuilder API

All methods return the builder itself for chaining. The query executes when you `await` it (the builder implements `PromiseLike`).

### Selecting Data

#### `.select(columns?)`

Start a select query. Columns can be `'*'` (default), or a comma-separated string.

```ts
// All columns
const { data, error } = await gateway.from('contacts').select();

// Specific columns
const { data, error } = await gateway.from('contacts').select('id, name, email');
```

### Filter Operators

All filter methods accept a column name and a value. They can be chained.

#### `.eq(column, value)` — Equal

```ts
const { data } = await gateway.from('contacts').select().eq('status', 'active');
```

#### `.neq(column, value)` — Not equal

```ts
const { data } = await gateway.from('contacts').select().neq('status', 'archived');
```

#### `.gt(column, value)` — Greater than

```ts
const { data } = await gateway.from('contacts').select().gt('age', 18);
```

#### `.gte(column, value)` — Greater than or equal

```ts
const { data } = await gateway.from('contacts').select().gte('created_at', '2024-01-01');
```

#### `.lt(column, value)` — Less than

```ts
const { data } = await gateway.from('contacts').select().lt('age', 65);
```

#### `.lte(column, value)` — Less than or equal

```ts
const { data } = await gateway.from('contacts').select().lte('priority', 5);
```

#### `.in(column, values)` — In array

```ts
const { data } = await gateway.from('contacts').select().in('status', ['active', 'pending']);
```

#### `.like(column, pattern)` — LIKE (case-sensitive)

```ts
const { data } = await gateway.from('contacts').select().like('name', 'A%');
```

#### `.ilike(column, pattern)` — ILIKE (case-insensitive)

```ts
const { data } = await gateway.from('contacts').select().ilike('name', '%alice%');
```

#### `.is(column, value)` — IS NULL check

```ts
const { data } = await gateway.from('contacts').select().is('deleted_at', null);
```

### Chaining Multiple Filters

Filters are combined with AND:

```ts
const { data } = await gateway
  .from('contacts')
  .select()
  .eq('status', 'active')
  .gte('created_at', '2024-01-01')
  .ilike('name', '%alice%');
```

### Ordering

#### `.order(column, options?)`

```ts
// Ascending (default)
const { data } = await gateway.from('contacts').select().order('name');

// Descending
const { data } = await gateway.from('contacts').select().order('created_at', { ascending: false });
```

Multiple `.order()` calls add additional sort keys:

```ts
const { data } = await gateway
  .from('contacts')
  .select()
  .order('status')
  .order('name', { ascending: true });
```

### Pagination

#### `.limit(count)`

```ts
const { data } = await gateway.from('contacts').select().limit(25);
```

#### `.range(from, to)`

Offset-based pagination. Returns rows from index `from` to `to` (inclusive).

```ts
// First page (rows 0-24)
const { data } = await gateway.from('contacts').select().range(0, 24);

// Second page (rows 25-49)
const { data } = await gateway.from('contacts').select().range(25, 49);
```

### Result Modifiers

#### `.single()`

Returns a single object instead of an array. Errors if zero or multiple rows are returned.

```ts
const { data, error } = await gateway
  .from('contacts')
  .select()
  .eq('id', '123')
  .single();

// data is an object (not an array)
```

#### `.maybeSingle()`

Returns a single object or `null`. Unlike `.single()`, does not error on zero rows.

```ts
const { data, error } = await gateway
  .from('contacts')
  .select()
  .eq('email', 'maybe@test.com')
  .maybeSingle();

// data is an object or null
```

### Mutations

#### `.insert(data)`

```ts
const { data, error } = await gateway
  .from('contacts')
  .insert({ name: 'Alice', email: 'alice@test.com' });
```

#### `.update(data)`

Combine with filters to target specific rows:

```ts
const { data, error } = await gateway
  .from('contacts')
  .update({ name: 'Updated' })
  .eq('id', '123');
```

#### `.upsert(data, options?)`

Insert or update on conflict. Specify conflict columns with `onConflict`:

```ts
const { data, error } = await gateway
  .from('contacts')
  .upsert(
    { id: '123', name: 'Alice', email: 'alice@test.com' },
    { onConflict: 'id' }
  );
```

#### `.delete()`

Combine with filters to target specific rows:

```ts
const { data, error } = await gateway
  .from('contacts')
  .delete()
  .eq('id', '123');
```

## Response Format

All queries return `{ data, error }`:

```ts
// Success
{ data: [...], error: null }

// Error
{ data: null, error: "Error message" }
```

This matches the Supabase response pattern. See the [Supabase Migration Guide](/examples/supabase-migration) for a full comparison.

## Full Example

```ts
import { createQueryBuilder } from 'drizzle-query-gateway';

const gateway = createQueryBuilder({
  baseUrl: '/api/gateway',
  getToken: () => getAuthToken(),
});

// Complex query with chaining
const { data: contacts, error } = await gateway
  .from('contacts')
  .select('id, name, email, status')
  .eq('status', 'active')
  .ilike('name', '%search%')
  .order('created_at', { ascending: false })
  .range(0, 24);

if (error) {
  console.error('Failed:', error);
} else {
  console.log('Contacts:', contacts);
}
```

## See Also

- [Object-Style Client](/api/create-gateway-client) — Alternative API with explicit method calls
- [Supabase Migration Guide](/examples/supabase-migration) — Side-by-side API comparison
