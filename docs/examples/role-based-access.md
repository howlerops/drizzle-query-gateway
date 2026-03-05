# Role-Based Access

This example demonstrates how to use `canWrite` and different policies per role to control access levels.

## Roles

| Role | Can Read | Can Write | Notes |
|------|----------|-----------|-------|
| `viewer` | Yes | No | Read-only access to allowed columns |
| `editor` | Yes | Contacts only | Can create/update/delete contacts |
| `admin` | Yes | Everything | Full write access |

## Policies

```ts
import { definePolicy, createPolicyRegistry } from 'drizzle-query-gateway';
import { contacts, accounts, auditLog } from './schema';

const contactsPolicy = definePolicy({
  table: contacts,
  requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
  allowedFilters: ['status', 'ownerId', 'createdAt'],
  allowedColumns: ['id', 'name', 'email', 'status', 'ownerId'],
  canWrite: (ctx) => ctx.roles.includes('editor') || ctx.roles.includes('admin'),
});

const accountsPolicy = definePolicy({
  table: accounts,
  requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
  allowedFilters: ['isActive', 'industry'],
  allowedColumns: ['id', 'name', 'industry', 'isActive', 'website'],
  canWrite: (ctx) => ctx.roles.includes('admin'),
});

// Audit log — read-only for admins, invisible to others
const auditLogPolicy = definePolicy({
  table: auditLog,
  requiredFilters: (ctx) => ({ tenantId: ctx.tenantId }),
  allowedFilters: ['action', 'createdAt'],
  allowedColumns: ['id', 'action', 'details', 'userId', 'createdAt'],
  canWrite: () => false, // Nobody writes through the gateway
});

export const policies = createPolicyRegistry([
  contactsPolicy,
  accountsPolicy,
  auditLogPolicy,
]);
```

## What Each Role Experiences

### Viewer

```ts
// ✅ Can read contacts
const contacts = await gateway.contacts.findMany({
  where: { status: 'active' },
});

// ❌ Cannot create contacts
try {
  await gateway.contacts.create({ data: { name: 'Test' } });
} catch (err) {
  // GatewayClientError: "Write access denied" (403)
}
```

### Editor

```ts
// ✅ Can read and write contacts
const contact = await gateway.contacts.create({
  data: { name: 'Alice', email: 'alice@example.com' },
});

// ✅ Can read accounts
const accounts = await gateway.accounts.findMany();

// ❌ Cannot write accounts
try {
  await gateway.accounts.create({ data: { name: 'New Corp' } });
} catch (err) {
  // GatewayClientError: "Write access denied" (403)
}
```

### Admin

```ts
// ✅ Full read and write access to contacts and accounts
await gateway.contacts.create({ data: { name: 'Alice' } });
await gateway.accounts.create({ data: { name: 'Acme Corp' } });

// ✅ Can read audit log
const logs = await gateway.audit_log.findMany({
  where: { action: 'contact.created' },
  orderBy: [{ column: 'createdAt', direction: 'desc' }],
  limit: 100,
});

// ❌ Cannot write to audit log (nobody can through the gateway)
try {
  await gateway.audit_log.create({ data: { action: 'fake' } });
} catch (err) {
  // GatewayClientError: "Write access denied" (403)
}
```

## Advanced: Owner-Based Access

For cases where users should only modify their own records, combine `requiredFilters` with `canWrite`:

```ts
const contactsPolicy = definePolicy({
  table: contacts,
  requiredFilters: (ctx) => ({
    tenantId: ctx.tenantId,
    // For reads: users see all tenant contacts
  }),
  allowedFilters: ['status', 'ownerId'],
  allowedColumns: ['id', 'name', 'email', 'status', 'ownerId'],
  canWrite: (ctx) => {
    // Only editors+ can write, and the handler
    // injects tenantId to scope mutations to the tenant
    return ctx.roles.includes('editor');
  },
});
```

For strict owner-only updates, you can inject `ownerId` into required filters for writes in a custom middleware layer before the gateway.

## Testing Roles

```ts
import { validateShape } from 'drizzle-query-gateway';

// Test that viewers cannot write
const violation = validateShape(
  { data: { name: 'Test' } },
  contactsPolicy,
  'create',
  { userId: 'u1', tenantId: 't1', roles: ['viewer'] },
);
expect(violation).toBe('Write access denied');

// Test that editors can write
const allowed = validateShape(
  { data: { name: 'Test' } },
  contactsPolicy,
  'create',
  { userId: 'u1', tenantId: 't1', roles: ['editor'] },
);
expect(allowed).toBeNull();
```
