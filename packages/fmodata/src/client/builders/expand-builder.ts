import type { StandardSchemaV1 } from "@standard-schema/spec";
import buildQuery, { type QueryOptions } from "odata-query";
import type { InternalLogger } from "../../logger";
import { FMTable, getBaseTableConfig, getNavigationPaths, getTableName } from "../../orm/table";
import type { ExpandValidationConfig } from "../../validation";
import { getDefaultSelectFields } from "./default-select";
import { formatSelectFields } from "./select-utils";
import type { ExpandConfig } from "./shared-types";

const FILTER_QUERY_REGEX = /\$filter=([^&]+)/;

/**
 * Builds OData expand query strings and validation configs.
 * Handles nested expands recursively and transforms relation names to FMTIDs
 * when using entity IDs.
 */
export class ExpandBuilder {
  private readonly useEntityIds: boolean;
  private readonly logger: InternalLogger;

  constructor(useEntityIds: boolean, logger: InternalLogger) {
    this.useEntityIds = useEntityIds;
    this.logger = logger;
  }

  /**
   * Builds OData $expand query string from expand configurations.
   */
  buildExpandString(configs: ExpandConfig[]): string {
    if (configs.length === 0) {
      return "";
    }

    return configs.map((config) => this.buildSingleExpand(config)).join(",");
  }

  /**
   * Builds validation configs for expanded navigation properties.
   */
  buildValidationConfigs(configs: ExpandConfig[]): ExpandValidationConfig[] {
    return configs.map((config) => {
      const targetTable = config.targetTable;

      let targetSchema: Partial<Record<string, StandardSchemaV1>> | undefined;
      if (targetTable) {
        const baseTableConfig = getBaseTableConfig(targetTable);
        const containerFields = baseTableConfig.containerFields || [];

        // Filter out container fields from schema
        const schema = { ...baseTableConfig.schema };
        for (const containerField of containerFields) {
          delete schema[containerField as string];
        }

        targetSchema = schema;
      }

      let selectedFields: string[] | undefined;
      if (config.options?.select) {
        selectedFields = Array.isArray(config.options.select)
          ? config.options.select.map(String)
          : [String(config.options.select)];
      }

      // Recursively build validation configs for nested expands
      const nestedExpands = config.nestedExpandConfigs
        ? this.buildValidationConfigs(config.nestedExpandConfigs)
        : undefined;

      return {
        relation: config.relation,
        targetSchema,
        targetTable,
        table: targetTable,
        selectedFields,
        nestedExpands,
      };
    });
  }

  /**
   * Process an expand() call and return the expand config.
   * Used by both QueryBuilder and RecordBuilder to eliminate duplication.
   *
   * @param targetTable - The target table to expand to
   * @param sourceTable - The source table (for validation)
   * @param callback - Optional callback to configure the expand query
   * @param builderFactory - Function that creates a QueryBuilder for the target table
   * @returns ExpandConfig to add to the builder's expandConfigs array
   */
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration, generic Builder type
  processExpand<TargetTable extends FMTable<any, any>, Builder = any>(
    targetTable: TargetTable,
    // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
    sourceTable: FMTable<any, any> | undefined,
    callback?: (builder: Builder) => Builder,
    builderFactory?: () => Builder,
  ): ExpandConfig {
    // Extract name and validate
    const relationName = getTableName(targetTable);

    // Runtime validation: Check if relation name is in navigationPaths
    if (sourceTable) {
      const navigationPaths = getNavigationPaths(sourceTable);
      if (navigationPaths && !navigationPaths.includes(relationName)) {
        this.logger.warn(
          `Cannot expand to "${relationName}". Valid navigation paths: ${navigationPaths.length > 0 ? navigationPaths.join(", ") : "none"}`,
        );
      }
    }

    if (callback && builderFactory) {
      // Create a new QueryBuilder for the target table
      const targetBuilder = builderFactory();

      // Pass to callback and get configured builder
      const configuredBuilder = callback(targetBuilder);

      // Extract the builder's query options
      // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any QueryOptions configuration
      const expandOptions: Partial<QueryOptions<any>> = {
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion for internal builder property access
        ...(configuredBuilder as any).queryOptions,
      };

      // QueryBuilder stores typed filter expressions separately from queryOptions
      // and serializes later. For nested expands, serialize immediately so
      // where(eq(...)) inside expand callbacks is preserved.
      // biome-ignore lint/suspicious/noExplicitAny: Internal builder state access
      const filterExpression = (configuredBuilder as any).readState?.filterExpression;
      if (filterExpression && !expandOptions.filter && typeof filterExpression.toODataFilter === "function") {
        expandOptions.filter = filterExpression.toODataFilter(this.useEntityIds);
      }

      // If callback didn't provide select, apply defaultSelect from target table
      if (!expandOptions.select) {
        const defaultFields = getDefaultSelectFields(targetTable);
        if (defaultFields) {
          expandOptions.select = defaultFields;
        }
      }

      // If the configured builder has nested expands, we need to include them
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for internal builder property access
      const nestedExpandConfigs = (configuredBuilder as any).expandConfigs;
      if (nestedExpandConfigs?.length > 0) {
        // Build nested expand string from the configured builder's expand configs
        const nestedExpandString = this.buildExpandString(nestedExpandConfigs);
        if (nestedExpandString) {
          // Add nested expand to options
          // biome-ignore lint/suspicious/noExplicitAny: Type assertion for expand string
          expandOptions.expand = nestedExpandString as any;
        }
      }

      return {
        relation: relationName,
        options: expandOptions,
        targetTable,
        nestedExpandConfigs: nestedExpandConfigs?.length > 0 ? nestedExpandConfigs : undefined,
      };
    }
    // Simple expand without callback - apply defaultSelect if available
    const defaultFields = getDefaultSelectFields(targetTable);
    if (defaultFields) {
      return {
        relation: relationName,
        options: { select: defaultFields },
        targetTable,
      };
    }
    return {
      relation: relationName,
      targetTable,
    };
  }

  /**
   * Builds a single expand string with its options.
   */
  private buildSingleExpand(config: ExpandConfig): string {
    const relationName = this.resolveRelationName(config);
    const parts = this.buildExpandParts(config);

    if (parts.length === 0) {
      return relationName;
    }

    return `${relationName}(${parts.join(";")})`;
  }

  /**
   * Resolves relation name, using FMTID if entity IDs are enabled.
   */
  private resolveRelationName(config: ExpandConfig): string {
    if (!this.useEntityIds) {
      return config.relation;
    }

    const targetTable = config.targetTable;
    if (targetTable && FMTable.Symbol.EntityId in targetTable) {
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for Symbol property access
      const tableId = (targetTable as any)[FMTable.Symbol.EntityId] as `FMTID:${string}` | undefined;
      if (tableId) {
        return tableId;
      }
    }

    return config.relation;
  }

  /**
   * Builds expand parts (select, filter, orderBy, etc.) for a single expand.
   */
  private buildExpandParts(config: ExpandConfig): string[] {
    if (!config.options || Object.keys(config.options).length === 0) {
      return [];
    }

    const parts: string[] = [];
    const opts = config.options;

    if (opts.select) {
      const selectArray = Array.isArray(opts.select) ? opts.select.map(String) : [String(opts.select)];
      const selectFields = formatSelectFields(selectArray, config.targetTable, this.useEntityIds);
      if (selectFields) {
        parts.push(`$select=${selectFields}`);
      }
    }

    if (opts.filter) {
      if (typeof opts.filter === "string") {
        parts.push(`$filter=${opts.filter}`);
      } else {
        const filterQuery = buildQuery({ filter: opts.filter });
        const match = filterQuery.match(FILTER_QUERY_REGEX);
        if (match) {
          parts.push(`$filter=${match[1]}`);
        }
      }
    }

    if (opts.orderBy) {
      const orderByValue = Array.isArray(opts.orderBy) ? opts.orderBy.join(",") : String(opts.orderBy);
      parts.push(`$orderby=${orderByValue}`);
    }

    if (opts.top !== undefined) {
      parts.push(`$top=${opts.top}`);
    }
    if (opts.skip !== undefined) {
      parts.push(`$skip=${opts.skip}`);
    }

    if (opts.expand && typeof opts.expand === "string") {
      parts.push(`$expand=${opts.expand}`);
    }

    return parts;
  }
}
