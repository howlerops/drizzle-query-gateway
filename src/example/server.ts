/**
 * Example server demonstrating the Drizzle Query Gateway.
 *
 * Run with: npx tsx src/example/server.ts
 *
 * This shows how to wire up:
 * 1. Express with JSON body parsing
 * 2. JWT auth middleware
 * 3. Policy-based gateway handler
 *
 * In a real app, replace the Drizzle DB connection with your actual database.
 */

import express from 'express';
import { createAuthMiddleware } from '../gateway/middleware.js';
import { createGatewayHandler } from '../gateway/handler.js';
import { createPolicyRegistry } from '../gateway/policy.js';
import { allPolicies } from './policies.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'development-secret-change-in-production';
const PORT = parseInt(process.env.PORT ?? '3000', 10);

const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Auth middleware — verifies JWT and builds GatewayContext
const auth = createAuthMiddleware({ secret: JWT_SECRET });

// Policy registry — defines what each table exposes
const policies = createPolicyRegistry(allPolicies);

// Gateway handler — single endpoint for all policy-enforced queries
// NOTE: In a real app, pass your actual Drizzle `db` instance here.
// This example shows the wiring; you need a real DB connection to execute queries.
const gateway = createGatewayHandler({
  db: null as any, // Replace with: drizzle(pool) or drizzle(client)
  policies,
  onError: (error, req) => {
    console.error(`Gateway error on ${req.body?.table}:`, error);
  },
});

// Mount: auth middleware protects the gateway
app.use('/api/gateway', auth, gateway);

app.listen(PORT, () => {
  console.log(`Drizzle Query Gateway listening on http://localhost:${PORT}`);
  console.log(`Gateway endpoint: POST http://localhost:${PORT}/api/gateway`);
  console.log(`Batch endpoint:   POST http://localhost:${PORT}/api/gateway/batch`);
  console.log(`\nExposed tables: ${Object.keys(policies).join(', ')}`);
});
