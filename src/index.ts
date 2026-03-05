// Core gateway
export {
  definePolicy,
  createPolicyRegistry,
  validateShape,
  intersectColumns,
  projectColumns,
} from './gateway/policy.js';

export {
  createGatewayHandler,
  type GatewayHandlerConfig,
} from './gateway/handler.js';

export {
  createAuthMiddleware,
  type AuthConfig,
} from './gateway/middleware.js';

export {
  executeQuery,
  buildWhereClause,
  buildColumnSelection,
  applyCursor,
  type DrizzleDB,
} from './gateway/executor.js';

// Client
export {
  createGatewayClient,
  GatewayClientError,
  type ClientConfig,
  type TableClient,
  type FindManyOptions,
  type FindFirstOptions,
  type CountOptions,
  type MutateOptions,
  type BatchClient,
  type BatchQuery,
} from './client/index.js';

// Types
export type {
  GatewayContext,
  GatewayOperation,
  GatewayRequest,
  GatewayBatchRequest,
  GatewayResponse,
  GatewayBatchResponse,
  GatewayError,
  PolicyConfig,
  Policy,
  PolicyRegistry,
} from './types.js';

// Schema (example)
export * as schema from './schema/index.js';
