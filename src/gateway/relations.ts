import { getTableName, type Table } from 'drizzle-orm';

/**
 * Relation types supported by the gateway.
 */
export type RelationType = 'one' | 'many';

/**
 * A single relation definition between two tables.
 */
export interface RelationConfig {
  /** The type of relation: 'one' (belongs-to / has-one) or 'many' (has-many) */
  type: RelationType;
  /** The related Drizzle table */
  table: Table;
  /** The foreign key column on the source table (for 'one') or on the related table (for 'many') */
  foreignKey: string;
  /** The referenced column on the other side (defaults to 'id') */
  references?: string;
}

/**
 * A resolved relation with table names attached.
 */
export interface ResolvedRelation {
  type: RelationType;
  sourceTable: string;
  relatedTable: string;
  foreignKey: string;
  references: string;
  alias: string;
}

/**
 * Relations definition for a single table — maps alias names to relation configs.
 */
export type TableRelations = Record<string, RelationConfig>;

/**
 * The full relations registry maps source table names to their resolved relations.
 */
export type RelationsRegistry = Record<string, Record<string, ResolvedRelation>>;

/**
 * Define relations for a Drizzle table, similar to Drizzle ORM's `relations()` API.
 *
 * @example
 * ```ts
 * import { contacts, accounts } from './schema.js';
 *
 * const contactRelations = defineRelations(contacts, {
 *   account: { type: 'one', table: accounts, foreignKey: 'accountId' },
 * });
 *
 * const accountRelations = defineRelations(accounts, {
 *   contacts: { type: 'many', table: contacts, foreignKey: 'accountId' },
 * });
 * ```
 */
export function defineRelations(
  sourceTable: Table,
  relations: TableRelations,
): { tableName: string; relations: Record<string, ResolvedRelation> } {
  const sourceTableName = getTableName(sourceTable);
  const resolved: Record<string, ResolvedRelation> = {};

  for (const [alias, config] of Object.entries(relations)) {
    resolved[alias] = {
      type: config.type,
      sourceTable: sourceTableName,
      relatedTable: getTableName(config.table),
      foreignKey: config.foreignKey,
      references: config.references ?? 'id',
      alias,
    };
  }

  return { tableName: sourceTableName, relations: resolved };
}

/**
 * Create a relations registry from an array of defineRelations results.
 *
 * @example
 * ```ts
 * const registry = createRelationsRegistry([
 *   defineRelations(contacts, {
 *     account: { type: 'one', table: accounts, foreignKey: 'accountId' },
 *   }),
 *   defineRelations(accounts, {
 *     contacts: { type: 'many', table: contacts, foreignKey: 'accountId' },
 *   }),
 * ]);
 * ```
 */
export function createRelationsRegistry(
  definitions: { tableName: string; relations: Record<string, ResolvedRelation> }[],
): RelationsRegistry {
  const registry: RelationsRegistry = {};

  for (const def of definitions) {
    registry[def.tableName] = def.relations;
  }

  return registry;
}

/**
 * Get the relations for a specific table from the registry.
 */
export function getTableRelations(
  registry: RelationsRegistry,
  tableName: string,
): Record<string, ResolvedRelation> | undefined {
  return registry[tableName];
}
