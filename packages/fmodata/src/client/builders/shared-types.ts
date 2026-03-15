import type { QueryOptions } from "odata-query";
import type { FMTable } from "../../orm/table";

/**
 * Expand configuration used by both QueryBuilder and RecordBuilder
 */
export interface ExpandConfig {
  relation: string;
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any QueryOptions configuration
  options?: Partial<QueryOptions<any>>;
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  targetTable?: FMTable<any, any>;
  nestedExpandConfigs?: ExpandConfig[];
}

/**
 * Type to represent expanded relations in return types
 */
// biome-ignore lint/suspicious/noExplicitAny: Dynamic schema and selected types from user input
export type ExpandedRelations = Record<string, { schema: any; selected: any }>;

/**
 * Navigation context shared between builders
 */
export interface NavigationContext {
  isNavigate?: boolean;
  navigateRecordId?: string | number;
  navigateRelation?: string;
  navigateSourceTableName?: string;
  navigateBaseRelation?: string;
  navigateBasePath?: string;
}
