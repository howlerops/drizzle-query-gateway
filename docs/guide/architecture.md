# Architecture

## System Flow

```
┌─────────────────────┐        HTTPS / JSON         ┌──────────────────────────────┐       TCP / Drizzle       ┌──────────────────┐
│      FRONTEND       │ ──────────────────────────► │       GATEWAY LAYER          │ ─────────────────────── ► │   DATA LAYER     │
│                     │                              │                              │                           │                  │
│  Gateway Client     │                              │  1. Auth Middleware          │                           │  PostgreSQL      │
│  (typed SDK)        │                              │     Verify JWT / session     │                           │                  │
│                     │                              │     Build user context       │                           │  Drizzle Schema  │
│  React / Vue / etc  │                              │                              │                           │  (single source  │
│  (no credentials,   │                              │  2. Policy Engine            │                           │   of truth)      │
│   no raw SQL)       │                              │     Validate query shape     │                           │                  │
│                     │                              │     Inject required filters  │                           │                  │
│                     │                              │     Strip disallowed cols    │                           │                  │
│                     │                              │                              │                           │                  │
│                     │                              │  3. Query Executor           │                           │                  │
│                     │                              │     Full Drizzle API         │                           │                  │
│                     │                              │     (server-side only)       │                           │                  │
└─────────────────────┘                              └──────────────────────────────┘                           └──────────────────┘
```

## Request Pipeline

Every gateway request flows through exactly six steps:

```
Client Request
    │
    ▼
┌───────────┐    401
│ Auth      │──────────► Reject
│ Middleware│
└─────┬─────┘
      │ ctx = { userId, tenantId, roles }
      ▼
┌───────────┐    400
│ Zod       │──────────► Reject (invalid format)
│ Validate  │
└─────┬─────┘
      │
      ▼
┌───────────┐    403
│ Policy    │──────────► Reject (table/filter/column not allowed)
│ Check     │
└─────┬─────┘
      │
      ▼
┌───────────┐
│ Filter    │  Server merges required filters
│ Injection │  (tenantId always overrides client)
└─────┬─────┘
      │
      ▼
┌───────────┐
│ Drizzle   │  Execute with full Drizzle API
│ Execute   │
└─────┬─────┘
      │
      ▼
┌───────────┐
│ Column    │  Strip columns not in allowedColumns
│ Projection│
└─────┬─────┘
      │
      ▼
  JSON Response
```

## Key Design Decisions

### Single Endpoint vs Multiple Endpoints

The gateway uses a **single POST endpoint** (`/api/gateway`) for all operations. This is intentional:

- **Simpler routing** — One endpoint to auth-protect, rate-limit, and monitor
- **Uniform policy enforcement** — Same validation pipeline for every query
- **Batch-friendly** — Multiple queries share one HTTP connection (`/api/gateway/batch`)

### Policies as Code

Policies are TypeScript objects, not database rows or config files:

- **Type-checked** — TypeScript catches mismatches between your schema and policies
- **Testable** — Unit test policies like any other function
- **Version-controlled** — Policies change with your code, reviewed in PRs
- **Composable** — Build policies from shared helpers

### Server-Side Projection

Column filtering happens at two levels:

1. **Drizzle SELECT** — Only requested (and allowed) columns are fetched from the DB
2. **Response projection** — Allowed columns are re-applied to the response

The second pass is defense-in-depth. Even if a Drizzle join returns extra columns, they're stripped before the response is sent.

## Comparison to Alternatives

| Approach | Type Safety | Auth/Policy | Boilerplate | Notes |
|----------|------------|-------------|-------------|-------|
| **This gateway** | Full | Structural | Low | ~400 line core |
| tRPC + Drizzle | Full | Per-procedure | Medium | Auth is convention-based |
| Drizzle HTTP proxy | Full | DIY | Low | No policy layer |
| Supabase client | Full | Structural (RLS) | Low | PostgreSQL-only |
| ZenStack | Full | Structural | Low | Prisma only |
| GraphQL | Codegen | Resolver-level | High | Better for complex queries |

## Stack Integration

```
Frontend (React, Vue, Svelte, etc.)
  └── createGatewayClient()
        └── POST /api/gateway
              └── createAuthMiddleware()   ← Verifies JWT
              └── createGatewayHandler()   ← Policy engine
              └── Drizzle ORM              ← Query execution
                    └── PostgreSQL / MySQL / SQLite
```

The gateway sits **alongside** your existing API layer — it doesn't replace it. Use your existing API for complex queries, mutations with business logic, and real-time subscriptions. Use the gateway for straightforward data access.
