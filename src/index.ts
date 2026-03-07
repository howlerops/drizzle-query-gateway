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

// Auto-policy (schema-driven)
export {
  definePolicyFromSchema,
  definePoliciesFromSchema,
  type AutoPolicyOverrides,
} from './gateway/auto-policy.js';

// Relations
export {
  defineRelations,
  createRelationsRegistry,
  getTableRelations,
  type RelationType,
  type RelationConfig,
  type ResolvedRelation,
  type TableRelations,
  type RelationsRegistry,
} from './gateway/relations.js';

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
  type UpsertOptions,
  type BatchClient,
  type BatchQuery,
} from './client/index.js';

// Query Builder (chainable API)
export {
  createQueryBuilder,
  QueryBuilder,
} from './client/query-builder.js';

// Types
export type {
  GatewayContext,
  GatewayOperation,
  GatewayRequest,
  GatewayBatchRequest,
  GatewayResponse,
  GatewayBatchResponse,
  GatewayError,
  FilterOperator,
  FilterValue,
  PolicyConfig,
  Policy,
  PolicyRegistry,
  IncludeOption,
} from './types.js';

// Schema (example)
export * as schema from './schema/index.js';
