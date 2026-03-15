/** biome-ignore-all lint/style/useReadonlyClassProperties: properties are reassigned in cloneWithChanges() */
import type { FFetchOptions } from "@fetchkit/ffetch";
import { Effect } from "effect";
import buildQuery, { type QueryOptions } from "odata-query";
import { makeRequestEffect, runAsResult, withSpan } from "../../effect";
import { RecordCountMismatchError } from "../../errors";
import { createLogger, type InternalLogger } from "../../logger";
import { type Column, isColumn } from "../../orm/column";
import { type FilterExpression, isOrderByExpression, type OrderByExpression } from "../../orm/operators";
import {
  type ExtractTableName,
  type FMTable,
  getTableName,
  type InferSchemaOutputFromFMTable,
  type ValidExpandTarget,
} from "../../orm/table";
import { transformOrderByField } from "../../transform";
import type {
  ConditionallyWithODataAnnotations,
  ConditionallyWithSpecialColumns,
  ExecutableBuilder,
  ExecuteMethodOptions,
  ExecuteOptions,
  ExecutionContext,
  NormalizeIncludeSpecialColumns,
  Result,
} from "../../types";
import {
  buildSelectExpandQueryString,
  createODataRequest,
  ExpandBuilder,
  type ExpandConfig,
  type ExpandedRelations,
  mergeExecuteOptions,
  processQueryResponse,
  processSelectWithRenames,
} from "../builders/index";
import { parseErrorResponse } from "../error-parser";
import { safeJsonParse } from "../sanitize-json";
import type { QueryReturnType, SystemColumnsOption, TypeSafeOrderBy } from "./types";
import { type NavigationConfig, QueryUrlBuilder } from "./url-builder";

export type { ExpandedRelations } from "../builders/index";
// Re-export types for backward compatibility
export type { QueryReturnType, SystemColumnsOption, TypeSafeOrderBy } from "./types";

/**
 * Default maximum number of records to return in a list query.
 * This prevents stack overflow issues with large datasets while still
 * allowing substantial data retrieval. Users can override with .top().
 */
const _DEFAULT_TOP = 1000;

export class QueryBuilder<
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  Occ extends FMTable<any, any>,
  Selected extends
    | keyof InferSchemaOutputFromFMTable<Occ>
    // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
    | Record<string, Column<any, any, ExtractTableName<Occ>>> = keyof InferSchemaOutputFromFMTable<Occ>,
  SingleMode extends "exact" | "maybe" | false = false,
  IsCount extends boolean = false,
  // biome-ignore lint/complexity/noBannedTypes: Empty object type represents no expands by default
  Expands extends ExpandedRelations = {},
  DatabaseIncludeSpecialColumns extends boolean = false,
  SystemCols extends SystemColumnsOption | undefined = undefined,
> implements
    ExecutableBuilder<
      QueryReturnType<InferSchemaOutputFromFMTable<Occ>, Selected, SingleMode, IsCount, Expands, SystemCols>
    >
{
  // These properties are reassigned in cloneWithChanges() on new instances, not on this
  private queryOptions: Partial<QueryOptions<InferSchemaOutputFromFMTable<Occ>>>;
  private expandConfigs: ExpandConfig[];
  private singleMode: SingleMode;
  private isCountMode: IsCount;
  private readonly occurrence: Occ;
  private readonly databaseName: string;
  private readonly context: ExecutionContext;
  private navigation?: NavigationConfig;
  private readonly databaseUseEntityIds: boolean;
  private readonly databaseIncludeSpecialColumns: boolean;
  private readonly expandBuilder: ExpandBuilder;
  private urlBuilder: QueryUrlBuilder;
  // Mapping from field names to output keys (for renamed fields in select)
  private fieldMapping?: Record<string, string>;
  // System columns requested via select() second argument
  private systemColumns?: SystemColumnsOption;
  private readonly logger: InternalLogger;

  constructor(config: {
    occurrence: Occ;
    databaseName: string;
    context: ExecutionContext;
    databaseUseEntityIds?: boolean;
    databaseIncludeSpecialColumns?: boolean;
  }) {
    this.occurrence = config.occurrence;
    this.databaseName = config.databaseName;
    this.context = config.context;
    this.logger = config.context?._getLogger?.() ?? createLogger();
    this.databaseUseEntityIds = config.databaseUseEntityIds ?? false;
    this.databaseIncludeSpecialColumns = config.databaseIncludeSpecialColumns ?? false;
    this.expandBuilder = new ExpandBuilder(this.databaseUseEntityIds, this.logger);
    this.urlBuilder = new QueryUrlBuilder(this.databaseName, this.occurrence, this.context);
    this.queryOptions = {};
    this.expandConfigs = [];
    this.singleMode = false as SingleMode;
    this.isCountMode = false as IsCount;
  }

  /**
   * Helper to merge database-level useEntityIds and includeSpecialColumns with per-request options
   */
  private mergeExecuteOptions(options?: RequestInit & FFetchOptions & ExecuteOptions): RequestInit &
    FFetchOptions & {
      useEntityIds?: boolean;
      includeSpecialColumns?: boolean;
    } {
    const merged = mergeExecuteOptions(options, this.databaseUseEntityIds);
    return {
      ...merged,
      includeSpecialColumns: options?.includeSpecialColumns ?? this.databaseIncludeSpecialColumns,
    };
  }

  /**
   * Creates a new QueryBuilder with modified configuration.
   * Used by single(), maybeSingle(), count(), and select() to create new instances.
   */
  private cloneWithChanges<
    NewSelected extends
      | keyof InferSchemaOutputFromFMTable<Occ>
      // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
      | Record<string, Column<any, any, ExtractTableName<Occ>>> = Selected,
    NewSingle extends "exact" | "maybe" | false = SingleMode,
    NewCount extends boolean = IsCount,
    NewSystemCols extends SystemColumnsOption | undefined = SystemCols,
  >(changes: {
    selectedFields?: NewSelected;
    singleMode?: NewSingle;
    isCountMode?: NewCount;
    queryOptions?: Partial<QueryOptions<InferSchemaOutputFromFMTable<Occ>>>;
    fieldMapping?: Record<string, string>;
    systemColumns?: NewSystemCols;
  }): QueryBuilder<Occ, NewSelected, NewSingle, NewCount, Expands, DatabaseIncludeSpecialColumns, NewSystemCols> {
    const newBuilder = new QueryBuilder<
      Occ,
      NewSelected,
      NewSingle,
      NewCount,
      Expands,
      DatabaseIncludeSpecialColumns,
      NewSystemCols
    >({
      occurrence: this.occurrence,
      databaseName: this.databaseName,
      context: this.context,
      databaseUseEntityIds: this.databaseUseEntityIds,
      databaseIncludeSpecialColumns: this.databaseIncludeSpecialColumns,
    });
    newBuilder.queryOptions = {
      ...this.queryOptions,
      ...changes.queryOptions,
    };
    newBuilder.expandConfigs = [...this.expandConfigs];
    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type parameter
    newBuilder.singleMode = (changes.singleMode ?? this.singleMode) as any;
    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type parameter
    newBuilder.isCountMode = (changes.isCountMode ?? this.isCountMode) as any;
    newBuilder.fieldMapping = "fieldMapping" in changes ? changes.fieldMapping : this.fieldMapping;
    newBuilder.systemColumns = changes.systemColumns !== undefined ? changes.systemColumns : this.systemColumns;
    // Copy navigation metadata
    newBuilder.navigation = this.navigation;
    newBuilder.urlBuilder = new QueryUrlBuilder(this.databaseName, this.occurrence, this.context);
    return newBuilder;
  }

  /**
   * Select fields using column references, or pass "all" to clear any defaultSelect and fetch all fields.
   * Allows renaming fields by using different keys in the object.
   * Container fields cannot be selected and will cause a type error.
   *
   * @example
   * db.from(users).list().select({
   *   name: users.name,
   *   userEmail: users.email  // renamed!
   * })
   *
   * @example
   * // Include system columns (ROWID, ROWMODID) when using select()
   * db.from(users).list().select(
   *   { name: users.name },
   *   { ROWID: true, ROWMODID: true }
   * )
   *
   * @example
   * // Override defaultSelect to fetch all fields
   * db.from(users).list().select("all")
   *
   * @param fields - Object mapping output keys to column references (container fields excluded), or "all" to select all fields
   * @param systemColumns - Optional object to request system columns (ROWID, ROWMODID)
   * @returns QueryBuilder with updated selected fields
   */
  select(
    fields: "all",
  ): QueryBuilder<
    Occ,
    keyof InferSchemaOutputFromFMTable<Occ>,
    SingleMode,
    IsCount,
    Expands,
    DatabaseIncludeSpecialColumns,
    undefined
  >;
  select<
    // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
    TSelect extends Record<string, Column<any, any, ExtractTableName<Occ>, false>>,
    // biome-ignore lint/complexity/noBannedTypes: Empty object type represents no system columns by default
    TSystemCols extends SystemColumnsOption = {},
  >(
    fields: TSelect,
    systemColumns?: TSystemCols,
  ): QueryBuilder<Occ, TSelect, SingleMode, IsCount, Expands, DatabaseIncludeSpecialColumns, TSystemCols>;
  // biome-ignore lint/suspicious/noExplicitAny: Implementation signature hidden from callers
  select(fields: any, systemColumns?: any): any {
    if (fields === "all") {
      return this.cloneWithChanges({
        queryOptions: {
          select: undefined,
        },
        fieldMapping: undefined,
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type parameter
        systemColumns: undefined as any,
      });
    }

    const tableName = getTableName(this.occurrence);
    const { selectedFields, fieldMapping } = processSelectWithRenames(fields, tableName, this.logger);

    // Add system columns to selectedFields if requested
    const finalSelectedFields = [...selectedFields];
    if (systemColumns?.ROWID) {
      finalSelectedFields.push("ROWID");
    }
    if (systemColumns?.ROWMODID) {
      finalSelectedFields.push("ROWMODID");
    }

    return this.cloneWithChanges({
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type parameter
      selectedFields: fields as any,
      queryOptions: {
        select: finalSelectedFields,
      },
      fieldMapping: Object.keys(fieldMapping).length > 0 ? fieldMapping : undefined,
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type parameter
      systemColumns: systemColumns as any,
    });
  }

  /**
   * Filter results using operator expressions (new ORM-style API).
   * Supports eq, gt, lt, and, or, etc. operators with Column references.
   * Also supports raw OData filter strings as an escape hatch.
   *
   * @example
   * .where(eq(users.hobby, "reading"))
   * .where(and(eq(users.active, true), gt(users.age, 18)))
   * .where("status eq 'active'")  // Raw OData string escape hatch
   */
  where(
    expression: FilterExpression | string,
  ): QueryBuilder<Occ, Selected, SingleMode, IsCount, Expands, DatabaseIncludeSpecialColumns, SystemCols> {
    // Handle raw string filters (escape hatch)
    if (typeof expression === "string") {
      this.queryOptions.filter = expression;
      return this;
    }
    // Convert FilterExpression to OData filter string
    const filterString = expression.toODataFilter(this.databaseUseEntityIds);
    this.queryOptions.filter = filterString;
    return this;
  }

  /**
   * Specify the sort order for query results.
   *
   * @example Single field (ascending by default)
   * ```ts
   * .orderBy("name")
   * .orderBy(users.name)  // Column reference
   * .orderBy(asc(users.name))  // Explicit ascending
   * ```
   *
   * @example Single field with explicit direction
   * ```ts
   * .orderBy(["name", "desc"])
   * .orderBy([users.name, "desc"])  // Column reference
   * .orderBy(desc(users.name))  // Explicit descending
   * ```
   *
   * @example Multiple fields with directions
   * ```ts
   * .orderBy([["name", "asc"], ["createdAt", "desc"]])
   * .orderBy([[users.name, "asc"], [users.createdAt, "desc"]])  // Column references
   * .orderBy(users.name, desc(users.age))  // Variadic with helpers
   * ```
   */
  orderBy(
    ...orderByArgs:
      | [
          | TypeSafeOrderBy<InferSchemaOutputFromFMTable<Occ>>
          // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
          | Column<any, any, ExtractTableName<Occ>>
          | OrderByExpression<ExtractTableName<Occ>>,
        ]
      | [
          // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
          Column<any, any, ExtractTableName<Occ>>,
          // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
          ...Array<Column<any, any, ExtractTableName<Occ>> | OrderByExpression<ExtractTableName<Occ>>>,
        ]
  ): QueryBuilder<Occ, Selected, SingleMode, IsCount, Expands, DatabaseIncludeSpecialColumns, SystemCols> {
    const tableName = getTableName(this.occurrence);

    // Handle variadic arguments (multiple fields)
    if (orderByArgs.length > 1) {
      const orderByParts = orderByArgs.map((arg) => {
        if (isOrderByExpression(arg)) {
          // Validate table match
          if (arg.column.tableName !== tableName) {
            this.logger.warn(
              `Column ${arg.column.toString()} is from table "${arg.column.tableName}", but query is for table "${tableName}"`,
            );
          }
          const fieldName = arg.column.fieldName;
          const transformedField = this.occurrence ? transformOrderByField(fieldName, this.occurrence) : fieldName;
          return `${transformedField} ${arg.direction}`;
        }
        if (isColumn(arg)) {
          // Validate table match
          if (arg.tableName !== tableName) {
            this.logger.warn(
              `Column ${arg.toString()} is from table "${arg.tableName}", but query is for table "${tableName}"`,
            );
          }
          const fieldName = arg.fieldName;
          const transformedField = this.occurrence ? transformOrderByField(fieldName, this.occurrence) : fieldName;
          return transformedField; // Default to ascending
        }
        throw new Error("Variadic orderBy() only accepts Column or OrderByExpression arguments");
      });
      this.queryOptions.orderBy = orderByParts;
      return this;
    }

    // Handle single argument
    const orderBy = orderByArgs[0];

    // Handle OrderByExpression
    if (isOrderByExpression(orderBy)) {
      // Validate table match
      if (orderBy.column.tableName !== tableName) {
        this.logger.warn(
          `Column ${orderBy.column.toString()} is from table "${orderBy.column.tableName}", but query is for table "${tableName}"`,
        );
      }
      const fieldName = orderBy.column.fieldName;
      const transformedField = this.occurrence ? transformOrderByField(fieldName, this.occurrence) : fieldName;
      this.queryOptions.orderBy = `${transformedField} ${orderBy.direction}`;
      return this;
    }

    // Handle Column references
    if (isColumn(orderBy)) {
      // Validate table match
      if (orderBy.tableName !== tableName) {
        this.logger.warn(
          `Column ${orderBy.toString()} is from table "${orderBy.tableName}", but query is for table "${tableName}"`,
        );
      }
      // Single Column reference without direction (defaults to ascending)
      const fieldName = orderBy.fieldName;
      this.queryOptions.orderBy = this.occurrence ? transformOrderByField(fieldName, this.occurrence) : fieldName;
      return this;
    }
    // Transform field names to FMFIDs if using entity IDs
    if (this.occurrence && orderBy) {
      if (Array.isArray(orderBy)) {
        // Check if it's a single tuple [field, direction] or array of tuples
        if (
          orderBy.length === 2 &&
          (typeof orderBy[0] === "string" || isColumn(orderBy[0])) &&
          (orderBy[1] === "asc" || orderBy[1] === "desc")
        ) {
          // Single tuple: [field, direction] or [column, direction]
          const field = isColumn(orderBy[0]) ? orderBy[0].fieldName : orderBy[0];
          const direction = orderBy[1] as "asc" | "desc";
          this.queryOptions.orderBy = `${transformOrderByField(field, this.occurrence)} ${direction}`;
        } else {
          // Array of tuples: [[field, dir], [field, dir], ...]
          // biome-ignore lint/suspicious/noExplicitAny: Dynamic orderBy tuple type from user input
          this.queryOptions.orderBy = (orderBy as [any, "asc" | "desc"][]).map(([fieldOrCol, direction]) => {
            const field = isColumn(fieldOrCol) ? fieldOrCol.fieldName : String(fieldOrCol);
            const transformedField = this.occurrence ? transformOrderByField(field, this.occurrence) : field;
            return `${transformedField} ${direction}`;
          });
        }
      } else {
        // Single field name (string)
        this.queryOptions.orderBy = transformOrderByField(String(orderBy), this.occurrence);
      }
    } else if (Array.isArray(orderBy)) {
      if (
        orderBy.length === 2 &&
        (typeof orderBy[0] === "string" || isColumn(orderBy[0])) &&
        (orderBy[1] === "asc" || orderBy[1] === "desc")
      ) {
        // Single tuple: [field, direction] or [column, direction]
        const field = isColumn(orderBy[0]) ? orderBy[0].fieldName : orderBy[0];
        const direction = orderBy[1] as "asc" | "desc";
        this.queryOptions.orderBy = `${field} ${direction}`;
      } else {
        // Array of tuples
        // biome-ignore lint/suspicious/noExplicitAny: Dynamic orderBy tuple type from user input
        this.queryOptions.orderBy = (orderBy as [any, "asc" | "desc"][]).map(([fieldOrCol, direction]) => {
          const field = isColumn(fieldOrCol) ? fieldOrCol.fieldName : String(fieldOrCol);
          return `${field} ${direction}`;
        });
      }
    } else {
      this.queryOptions.orderBy = orderBy;
    }
    return this;
  }

  top(
    count: number,
  ): QueryBuilder<Occ, Selected, SingleMode, IsCount, Expands, DatabaseIncludeSpecialColumns, SystemCols> {
    this.queryOptions.top = count;
    return this;
  }

  skip(
    count: number,
  ): QueryBuilder<Occ, Selected, SingleMode, IsCount, Expands, DatabaseIncludeSpecialColumns, SystemCols> {
    this.queryOptions.skip = count;
    return this;
  }

  expand<
    // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
    TargetTable extends FMTable<any, any>,
    TSelected extends
      | keyof InferSchemaOutputFromFMTable<TargetTable>
      | Record<
          string,
          // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
          Column<any, any, ExtractTableName<TargetTable>>
        > = keyof InferSchemaOutputFromFMTable<TargetTable>,
    // biome-ignore lint/complexity/noBannedTypes: Empty object type represents no nested expands by default
    TNestedExpands extends ExpandedRelations = {},
  >(
    targetTable: ValidExpandTarget<Occ, TargetTable>,
    callback?: (
      // biome-ignore lint/complexity/noBannedTypes: Empty object type represents no expands in initial builder
      builder: QueryBuilder<TargetTable, keyof InferSchemaOutputFromFMTable<TargetTable>, false, false, {}>,
      // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any QueryBuilder configuration
    ) => QueryBuilder<TargetTable, TSelected, any, any, TNestedExpands>,
  ): QueryBuilder<
    Occ,
    Selected,
    SingleMode,
    IsCount,
    Expands & {
      [K in ExtractTableName<TargetTable>]: {
        schema: InferSchemaOutputFromFMTable<TargetTable>;
        selected: TSelected;
        nested: TNestedExpands;
      };
    },
    DatabaseIncludeSpecialColumns,
    SystemCols
  > {
    // Use ExpandBuilder.processExpand to handle the expand logic
    type TargetBuilder = QueryBuilder<
      TargetTable,
      keyof InferSchemaOutputFromFMTable<TargetTable>,
      false,
      false,
      // biome-ignore lint/complexity/noBannedTypes: Empty object type represents no expands in new builder
      {},
      DatabaseIncludeSpecialColumns
    >;
    const expandConfig = this.expandBuilder.processExpand<TargetTable, TargetBuilder>(
      targetTable,
      this.occurrence,
      callback as ((builder: TargetBuilder) => TargetBuilder) | undefined,
      () =>
        // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any QueryBuilder configuration
        new QueryBuilder<TargetTable, any, any, any, any, DatabaseIncludeSpecialColumns, undefined>({
          occurrence: targetTable,
          databaseName: this.databaseName,
          context: this.context,
          databaseUseEntityIds: this.databaseUseEntityIds,
          databaseIncludeSpecialColumns: this.databaseIncludeSpecialColumns,
        }),
    );

    this.expandConfigs.push(expandConfig);
    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for complex generic return type
    return this as any;
  }

  single(): QueryBuilder<Occ, Selected, "exact", IsCount, Expands, DatabaseIncludeSpecialColumns, SystemCols> {
    return this.cloneWithChanges({ singleMode: "exact" as const });
  }

  maybeSingle(): QueryBuilder<Occ, Selected, "maybe", IsCount, Expands, DatabaseIncludeSpecialColumns, SystemCols> {
    return this.cloneWithChanges({ singleMode: "maybe" as const });
  }

  count(): QueryBuilder<Occ, Selected, SingleMode, true, Expands, DatabaseIncludeSpecialColumns, SystemCols> {
    return this.cloneWithChanges({
      isCountMode: true as const,
      queryOptions: { count: true },
    });
  }

  /**
   * Builds the OData query string from current query options and expand configs.
   */
  private buildQueryString(includeSpecialColumns?: boolean, useEntityIds?: boolean): string {
    // Build query without expand and select (we'll add them manually if using entity IDs)
    const queryOptionsWithoutExpandAndSelect = { ...this.queryOptions };
    const originalSelect = queryOptionsWithoutExpandAndSelect.select;
    queryOptionsWithoutExpandAndSelect.expand = undefined;
    queryOptionsWithoutExpandAndSelect.select = undefined;

    let queryString = buildQuery(queryOptionsWithoutExpandAndSelect);

    // Use shared helper for select/expand portion
    let selectArray: string[] | undefined;
    if (originalSelect) {
      selectArray = Array.isArray(originalSelect) ? originalSelect.map(String) : [String(originalSelect)];
    }

    // Use merged includeSpecialColumns if provided, otherwise use database-level default
    const finalIncludeSpecialColumns = includeSpecialColumns ?? this.databaseIncludeSpecialColumns;

    // Use provided useEntityIds if provided, otherwise use database-level default
    const finalUseEntityIds = useEntityIds ?? this.databaseUseEntityIds;

    const selectExpandString = buildSelectExpandQueryString({
      selectedFields: selectArray,
      expandConfigs: this.expandConfigs,
      table: this.occurrence,
      useEntityIds: finalUseEntityIds,
      logger: this.logger,
      includeSpecialColumns: finalIncludeSpecialColumns,
    });

    // Append select/expand to existing query string
    if (selectExpandString) {
      // Strip leading ? from helper result and append with appropriate separator
      const params = selectExpandString.startsWith("?") ? selectExpandString.slice(1) : selectExpandString;
      const separator = queryString.includes("?") ? "&" : "?";
      queryString = `${queryString}${separator}${params}`;
    }

    return queryString;
  }

  async execute<EO extends ExecuteOptions>(
    options?: ExecuteMethodOptions<EO>,
  ): Promise<
    Result<
      ConditionallyWithODataAnnotations<
        ConditionallyWithSpecialColumns<
          QueryReturnType<InferSchemaOutputFromFMTable<Occ>, Selected, SingleMode, IsCount, Expands, SystemCols>,
          // Use the merged value: if explicitly provided in options, use that; otherwise use database default
          NormalizeIncludeSpecialColumns<EO["includeSpecialColumns"], DatabaseIncludeSpecialColumns>,
          // Check if select was applied: if Selected is Record (object select) or a subset of keys, select was applied
          // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
          Selected extends Record<string, Column<any, any, any>>
            ? true
            : Selected extends keyof InferSchemaOutputFromFMTable<Occ>
              ? false
              : true
        >,
        EO["includeODataAnnotations"] extends true ? true : false
      >
    >
  > {
    const mergedOptions = this.mergeExecuteOptions(options);
    const queryString = this.buildQueryString(mergedOptions.includeSpecialColumns, mergedOptions.useEntityIds);

    // Handle $count endpoint
    if (this.isCountMode) {
      const url = this.urlBuilder.build(queryString, {
        isCount: true,
        useEntityIds: mergedOptions.useEntityIds,
        navigation: this.navigation,
      });

      const pipeline = withSpan(
        makeRequestEffect(this.context, url, mergedOptions).pipe(
          Effect.map((data) => {
            const count = typeof data === "string" ? Number(data) : data;
            return count as number;
          }),
        ),
        "fmodata.query.count",
        { "fmodata.table": getTableName(this.occurrence) },
      );

      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
      return (await runAsResult(pipeline)) as any;
    }

    const url = this.urlBuilder.build(queryString, {
      isCount: this.isCountMode,
      useEntityIds: mergedOptions.useEntityIds,
      navigation: this.navigation,
    });

    const pipeline = withSpan(
      makeRequestEffect(this.context, url, mergedOptions).pipe(
        Effect.flatMap((data) =>
          Effect.tryPromise({
            try: () =>
              processQueryResponse(data, {
                occurrence: this.occurrence,
                singleMode: this.singleMode,
                // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type parameter
                queryOptions: this.queryOptions as any,
                expandConfigs: this.expandConfigs,
                skipValidation: options?.skipValidation,
                useEntityIds: mergedOptions.useEntityIds,
                includeSpecialColumns: mergedOptions.includeSpecialColumns,
                fieldMapping: this.fieldMapping,
                logger: this.logger,
              }),
            catch: (e) => (e instanceof Error ? e : new Error(String(e))),
          }),
        ),
        // processQueryResponse returns a Result, so we need to unwrap it
        Effect.flatMap((result) => (result.error ? Effect.fail(result.error) : Effect.succeed(result.data))),
      ),
      this.singleMode ? "fmodata.query.single" : "fmodata.query.list",
      { "fmodata.table": getTableName(this.occurrence) },
    );

    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
    return (await runAsResult(pipeline)) as any;
  }

  getQueryString(options?: { useEntityIds?: boolean }): string {
    const useEntityIds = options?.useEntityIds ?? this.databaseUseEntityIds;
    const queryString = this.buildQueryString(undefined, useEntityIds);
    return this.urlBuilder.buildPath(queryString, {
      useEntityIds,
      navigation: this.navigation,
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: Request body can be any JSON-serializable value
  getRequestConfig(): { method: string; url: string; body?: any } {
    const queryString = this.buildQueryString();
    const url = this.urlBuilder.build(queryString, {
      isCount: this.isCountMode,
      useEntityIds: this.databaseUseEntityIds,
      navigation: this.navigation,
    });

    return {
      method: "GET",
      url,
    };
  }

  toRequest(baseUrl: string, options?: ExecuteOptions): Request {
    const config = this.getRequestConfig();
    return createODataRequest(baseUrl, config, options);
  }

  async processResponse(
    response: Response,
    options?: ExecuteOptions,
  ): Promise<
    Result<QueryReturnType<InferSchemaOutputFromFMTable<Occ>, Selected, SingleMode, IsCount, Expands, SystemCols>>
  > {
    // Check for error responses (important for batch operations)
    if (!response.ok) {
      const error = await parseErrorResponse(
        response,
        response.url || `/${this.databaseName}/${getTableName(this.occurrence)}`,
      );
      return { data: undefined, error };
    }

    // Handle 204 No Content (shouldn't happen for queries, but handle it gracefully)
    if (response.status === 204) {
      // Return empty list for list queries, null for single queries
      if (this.singleMode !== false) {
        if (this.singleMode === "maybe") {
          // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
          return { data: null as any, error: undefined };
        }
        return {
          data: undefined,
          error: new RecordCountMismatchError("one", 0),
        };
      }
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
      return { data: [] as any, error: undefined };
    }

    // Parse the response body (using safeJsonParse to handle FileMaker's invalid JSON with unquoted ? values)
    let rawData: unknown;
    try {
      rawData = await safeJsonParse(response);
    } catch (err) {
      // Check if it's an empty body error (common with 204 responses)
      if (err instanceof SyntaxError && response.status === 204) {
        // Handled above, but just in case
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
        return { data: [] as any, error: undefined };
      }
      return {
        data: undefined,
        error: {
          name: "ResponseParseError",
          message: `Failed to parse response JSON: ${err instanceof Error ? err.message : "Unknown error"}`,
          timestamp: new Date(),
          // biome-ignore lint/suspicious/noExplicitAny: Type assertion for error object
        } as any,
      };
    }

    if (!rawData) {
      return {
        data: undefined,
        error: {
          name: "ResponseError",
          message: "Response body was empty or null",
          timestamp: new Date(),
          // biome-ignore lint/suspicious/noExplicitAny: Type assertion for error object
        } as any,
      };
    }

    const mergedOptions = this.mergeExecuteOptions(options);
    // Check if select was applied (runtime check)
    const _hasSelect = this.queryOptions.select !== undefined;

    return processQueryResponse(rawData, {
      occurrence: this.occurrence,
      singleMode: this.singleMode,
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type parameter
      queryOptions: this.queryOptions as any,
      expandConfigs: this.expandConfigs,
      skipValidation: options?.skipValidation,
      useEntityIds: mergedOptions.useEntityIds,
      includeSpecialColumns: mergedOptions.includeSpecialColumns,
      fieldMapping: this.fieldMapping,
      logger: this.logger,
    });
  }
}
