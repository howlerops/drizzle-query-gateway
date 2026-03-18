// Core gateway

// Client
export {
  type BatchClient,
  type BatchQuery,
  type ClientConfig,
  type CountOptions,
  createGatewayClient,
  type FindFirstOptions,
  type FindManyOptions,
  GatewayClientError,
  type MutateOptions,
  type TableClient,
  type UpsertOptions,
} from "./client/index.js";
// Query Builder (chainable API)
export {
  createQueryBuilder,
  QueryBuilder,
} from "./client/query-builder.js";
// Auto-policy (schema-driven)
export {
  type AutoPolicyOverrides,
  definePoliciesFromSchema,
  definePolicyFromSchema,
} from "./gateway/auto-policy.js";

export {
  applyCursor,
  buildColumnSelection,
  buildWhereClause,
  type DrizzleDB,
  executeQuery,
} from "./gateway/executor.js";
export {
  createGatewayHandler,
  type GatewayHandlerConfig,
} from "./gateway/handler.js";
export {
  type AuthConfig,
  createAuthMiddleware,
} from "./gateway/middleware.js";
export {
  createPolicyRegistry,
  definePolicy,
  intersectColumns,
  projectColumns,
  validateShape,
} from "./gateway/policy.js";
// Relations
export {
  createRelationsRegistry,
  defineRelations,
  getTableRelations,
  type RelationConfig,
  type RelationsRegistry,
  type RelationType,
  type ResolvedRelation,
  type TableRelations,
} from "./gateway/relations.js";
// Schema (example)
export * as schema from "./schema/index.js";
// Types
export type {
  FilterOperator,
  FilterValue,
  GatewayBatchRequest,
  GatewayBatchResponse,
  GatewayContext,
  GatewayError,
  GatewayOperation,
  GatewayRequest,
  GatewayResponse,
  IncludeOption,
  Policy,
  PolicyConfig,
  PolicyRegistry,
} from "./types.js";
