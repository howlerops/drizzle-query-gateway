# Basic CRUD

This example shows the simplest gateway setup: one table, basic CRUD operations.

## Schema

```ts
// schema.ts
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const todos = pgTable('todos', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

## Policy

```ts
// policies.ts
import { definePolicy } from 'drizzle-query-gateway';
import { todos } from './schema';

export const todosPolicy = definePolicy({
  table: todos,
  requiredFilters: (ctx) => ({
    tenantId: ctx.tenantId,
    userId: ctx.userId,           // Users can only see their own todos
  }),
  allowedFilters: ['status'],     // Filter by status only
  allowedColumns: ['id', 'title', 'status', 'createdAt'],
  canWrite: () => true,           // All authenticated users can write
});
```

## Server

```ts
// server.ts
import express from 'express';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  createAuthMiddleware,
  createGatewayHandler,
  createPolicyRegistry,
} from 'drizzle-query-gateway';
import { todosPolicy } from './policies';

const app = express();
app.use(express.json());

const db = drizzle(process.env.DATABASE_URL!);

app.use(
  '/api/gateway',
  createAuthMiddleware({ secret: process.env.JWT_SECRET! }),
  createGatewayHandler({
    db,
    policies: createPolicyRegistry([todosPolicy]),
  }),
);

app.listen(3000);
```

## Client Usage

```ts
import { createGatewayClient } from 'drizzle-query-gateway/client';

const gateway = createGatewayClient({
  baseUrl: '/api/gateway',
  getToken: () => getAuthToken(),
});

// List all pending todos
const pending = await gateway.todos.findMany({
  where: { status: 'pending' },
  orderBy: [{ column: 'createdAt', direction: 'desc' }],
});

// Create a new todo
const newTodo = await gateway.todos.create({
  data: { title: 'Buy groceries', status: 'pending' },
});

// Mark as complete
await gateway.todos.update({
  where: { status: 'pending' },
  data: { status: 'complete' },
});

// Delete completed todos
await gateway.todos.delete({
  where: { status: 'complete' },
});

// Get count
const count = await gateway.todos.count({
  where: { status: 'pending' },
});
console.log(`You have ${count} pending todos`);
```

## What's Happening

- `tenantId` and `userId` are **always injected** — the client never sees or sends them
- The client can only filter by `status` — everything else is blocked
- Only `id`, `title`, `status`, and `createdAt` are returned — `tenantId` and `userId` are stripped
- All authenticated users can create/update/delete their own todos
