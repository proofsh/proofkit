/** biome-ignore-all lint/performance/noBarrelFile: Re-exporting QueryBuilder and types */

// Re-export QueryBuilder as the main export

// Export ExpandConfig from canonical shared builder types
export type { ExpandConfig } from "../builders/shared-types";

// Export types
export type {
  CountedListResult,
  ExpandedRelations,
  QueryReturnType,
  TypeSafeOrderBy,
} from "./query-builder";
export { QueryBuilder } from "./query-builder";
