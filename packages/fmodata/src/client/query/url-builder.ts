import type { FMTable } from "../../orm/table";
import { getTableName } from "../../orm/table";
import { resolveTableId } from "../builders/table-utils";

/**
 * Configuration for navigation from RecordBuilder or EntitySet
 */
export interface NavigationConfig {
  recordId?: string | number;
  relation: string;
  sourceTableName: string;
  baseRelation?: string; // For chained navigations from navigated EntitySets
  basePath?: string; // Full base path for chained entity set navigations
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
    const effectiveUseEntityIds = options.useEntityIds ?? this.useEntityIds;
    const tableId = resolveTableId(this.occurrence, getTableName(this.occurrence), effectiveUseEntityIds);

    const navigation = options.navigation;
    if (navigation?.recordId && navigation?.relation) {
      return this.buildRecordNavigation(queryString, tableId, navigation);
    }
    if (navigation?.relation) {
      return this.buildEntitySetNavigation(queryString, tableId, navigation);
    }
    if (options.isCount) {
      return `/${this.databaseName}/${tableId}/$count${queryString}`;
    }
    return `/${this.databaseName}/${tableId}${queryString}`;
  }

  /**
   * Builds URL for record navigation: /database/sourceTable('recordId')/relation
   * or /database/sourceTable/baseRelation('recordId')/relation for chained navigations
   */
  private buildRecordNavigation(queryString: string, _tableId: string, navigation: NavigationConfig): string {
    const { sourceTableName, baseRelation, recordId, relation } = navigation;
    const base = baseRelation
      ? `${sourceTableName}/${baseRelation}('${recordId}')`
      : `${sourceTableName}('${recordId}')`;
    return `/${this.databaseName}/${base}/${relation}${queryString}`;
  }

  /**
   * Builds URL for entity set navigation: /database/sourceTable/relation
   * or /database/basePath/relation for chained navigations
   */
  private buildEntitySetNavigation(queryString: string, _tableId: string, navigation: NavigationConfig): string {
    const { sourceTableName, basePath, relation } = navigation;
    const base = basePath || sourceTableName;
    return `/${this.databaseName}/${base}/${relation}${queryString}`;
  }

  /**
   * Builds a query string path (without database prefix) for getQueryString().
   * Used when the full URL is not needed.
   */
  buildPath(queryString: string, options?: { useEntityIds?: boolean; navigation?: NavigationConfig }): string {
    const effectiveUseEntityIds = options?.useEntityIds ?? this.useEntityIds;
    const navigation = options?.navigation;
    const tableId = resolveTableId(this.occurrence, getTableName(this.occurrence), effectiveUseEntityIds);

    if (navigation?.recordId && navigation?.relation) {
      const { sourceTableName, baseRelation, recordId, relation } = navigation;
      const base = baseRelation
        ? `${sourceTableName}/${baseRelation}('${recordId}')`
        : `${sourceTableName}('${recordId}')`;
      return queryString ? `/${base}/${relation}${queryString}` : `/${base}/${relation}`;
    }
    if (navigation?.relation) {
      const { sourceTableName, basePath, relation } = navigation;
      const base = basePath || sourceTableName;
      return queryString ? `/${base}/${relation}${queryString}` : `/${base}/${relation}`;
    }
    return queryString ? `/${tableId}${queryString}` : `/${tableId}`;
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
