import type { FMTable } from "../../orm/table";
import { getTableName } from "../../orm/table";
import { resolveTableId } from "../builders/table-utils";

/**
 * Configuration for navigation from RecordBuilder or EntitySet
 */
export interface NavigationConfig {
  recordId?: string | number;
  relation: string;
  relationEntityId?: string;
  sourceTableName: string;
  sourceTableEntityId?: string;
  baseRelation?: string; // For chained navigations from navigated EntitySets
  baseRelationEntityId?: string;
  basePath?: string; // Full base path for chained entity set navigations
  basePathEntityId?: string;
}

/**
 * Builds OData query URLs for different navigation modes.
 * Handles:
 * - Record navigation: /database/sourceTable('recordId')/relation
 * - Entity set navigation: /database/sourceTable/relation
 * - Count endpoint: /database/tableId/$count
 * - Standard queries: /database/tableId
 */
export class QueryUrlBuilder {
  private readonly databaseName: string;
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  private readonly occurrence: FMTable<any, any>;
  private readonly useEntityIds: boolean;

  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  constructor(databaseName: string, occurrence: FMTable<any, any>, useEntityIds: boolean) {
    this.databaseName = databaseName;
    this.occurrence = occurrence;
    this.useEntityIds = useEntityIds;
  }

  /**
   * Builds the full URL for a query request.
   *
   * @param queryString - The OData query string (e.g., "?$filter=...&$select=...")
   * @param options - Options including whether this is a count query, useEntityIds override, and navigation config
   */
  build(
    queryString: string,
    options: {
      isCount?: boolean;
      useEntityIds?: boolean;
      navigation?: NavigationConfig;
    },
  ): string {
    return `/${this.databaseName}${this.buildPath(queryString, options)}`;
  }

  /**
   * Builds a query string path (without database prefix) for getQueryString().
   * Used when the full URL is not needed.
   */
  buildPath(
    queryString: string,
    options?: { isCount?: boolean; useEntityIds?: boolean; navigation?: NavigationConfig },
  ): string {
    const effectiveUseEntityIds = options?.useEntityIds ?? this.useEntityIds;
    const navigation = options?.navigation;
    const tableId = resolveTableId(this.occurrence, getTableName(this.occurrence), effectiveUseEntityIds);
    const suffix = options?.isCount ? "/$count" : "";

    if (navigation?.recordId && navigation?.relation) {
      const sourceTable = effectiveUseEntityIds
        ? (navigation.sourceTableEntityId ?? navigation.sourceTableName)
        : navigation.sourceTableName;
      const baseRelation = effectiveUseEntityIds
        ? (navigation.baseRelationEntityId ?? navigation.baseRelation)
        : navigation.baseRelation;
      const relation = effectiveUseEntityIds
        ? (navigation.relationEntityId ?? navigation.relation)
        : navigation.relation;
      const { recordId } = navigation;
      const base = baseRelation ? `${sourceTable}/${baseRelation}('${recordId}')` : `${sourceTable}('${recordId}')`;
      return queryString ? `/${base}/${relation}${suffix}${queryString}` : `/${base}/${relation}${suffix}`;
    }
    if (navigation?.relation) {
      const sourceTable = effectiveUseEntityIds
        ? (navigation.sourceTableEntityId ?? navigation.sourceTableName)
        : navigation.sourceTableName;
      const basePath = effectiveUseEntityIds
        ? (navigation.basePathEntityId ?? navigation.basePath)
        : navigation.basePath;
      const relation = effectiveUseEntityIds
        ? (navigation.relationEntityId ?? navigation.relation)
        : navigation.relation;
      const base = basePath || sourceTable;
      return queryString ? `/${base}/${relation}${suffix}${queryString}` : `/${base}/${relation}${suffix}`;
    }
    return queryString ? `/${tableId}${suffix}${queryString}` : `/${tableId}${suffix}`;
  }

  /**
   * Build URL for record operations (single record by ID).
   * Used by RecordBuilder to build URLs like /database/table('id').
   *
   * @param recordId - The record ID
   * @param queryString - The OData query string (e.g., "?$select=...")
   * @param options - Options including operation type and useEntityIds override
   */
  buildRecordUrl(
    recordId: string | number,
    queryString: string,
    options?: {
      operation?: "getSingleField";
      operationParam?: string;
      useEntityIds?: boolean;
      isNavigateFromEntitySet?: boolean;
      navigateSourceTableName?: string;
      navigateRelation?: string;
    },
  ): string {
    const effectiveUseEntityIds = options?.useEntityIds ?? this.useEntityIds;
    const tableId = resolveTableId(this.occurrence, getTableName(this.occurrence), effectiveUseEntityIds);

    // Build the base URL depending on whether this came from a navigated EntitySet
    let url: string;
    if (options?.isNavigateFromEntitySet && options.navigateSourceTableName && options.navigateRelation) {
      // From navigated EntitySet: /sourceTable/relation('recordId')
      url = `/${this.databaseName}/${options.navigateSourceTableName}/${options.navigateRelation}('${recordId}')`;
    } else {
      // Normal record: /tableName('recordId') - use FMTID if configured
      url = `/${this.databaseName}/${tableId}('${recordId}')`;
    }

    if (options?.operation === "getSingleField" && options.operationParam) {
      url += `/${options.operationParam}`;
    }

    return url + queryString;
  }
}
