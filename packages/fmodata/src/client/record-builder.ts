/** biome-ignore-all lint/complexity/noBannedTypes: Empty object type represents no expands by default */
import type { FFetchOptions } from "@fetchkit/ffetch";
import { Effect } from "effect";
import { requestFromService, runLayerResult } from "../effect";
import { BuilderInvariantError } from "../errors";
import type { InternalLogger } from "../logger";
import type { Column } from "../orm/column";
import type { ExtractTableName, FMTable, InferSchemaOutputFromFMTable, ValidExpandTarget } from "../orm/table";
import { getNavigationPaths, getTableName, isUsingEntityIds } from "../orm/table";
import type { FMODataLayer, ODataConfig } from "../services";
import type {
  ConditionallyWithODataAnnotations,
  ConditionallyWithSpecialColumns,
  ExecutableBuilder,
  ExecuteMethodOptions,
  ExecuteOptions,
  NormalizeIncludeSpecialColumns,
  ODataFieldResponse,
  Result,
} from "../types";
import {
  buildSelectExpandQueryString,
  cloneRecordReadBuilderState,
  createInitialRecordReadBuilderState,
  createODataRequest,
  ExpandBuilder,
  type ExpandConfig,
  type ExpandedRelations,
  mergeExecuteOptions,
  processRecordResponse,
  processSelectWithRenames,
  resolveTableId,
} from "./builders/index";
import { parseErrorResponse } from "./error-parser";
import type { ResolveExpandedRelations, SystemColumnsFromOption, SystemColumnsOption } from "./query/types";
import { QueryBuilder } from "./query-builder";
import { createClientRuntime } from "./runtime";
import { safeJsonParse } from "./sanitize-json";

/**
 * Extract the value type from a Column.
 * This uses the phantom type stored in Column to get the actual value type.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for type inference with infer
type ExtractColumnType<C> = C extends Column<infer T, any> ? T : never;

/**
 * Map a select object to its return type.
 * For each key in the select object, extract the type from the corresponding Column.
 */
type MapSelectToReturnType<
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
  TSelect extends Record<string, Column<any, any, any, any>>,
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any schema shape
  _TSchema extends Record<string, any>,
> = {
  [K in keyof TSelect]: ExtractColumnType<TSelect[K]>;
};

// Return type for RecordBuilder execute
export type RecordReturnType<
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any schema shape
  Schema extends Record<string, any>,
  IsSingleField extends boolean,
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
  FieldColumn extends Column<any, any, any, any> | undefined,
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration, accepts any FMTable
  Selected extends keyof Schema | Record<string, Column<any, any, ExtractTableName<FMTable<any, any>>>>,
  Expands extends ExpandedRelations,
  SystemCols extends SystemColumnsOption | undefined = undefined,
> = IsSingleField extends true
  ? // biome-ignore lint/suspicious/noExplicitAny: Required for type inference with infer
    FieldColumn extends Column<infer TOutput, any, any, any>
    ? TOutput
    : never
  : // Use tuple wrapping [Selected] extends [...] to prevent distribution over unions
    // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
    [Selected] extends [Record<string, Column<any, any, any, any>>]
    ? MapSelectToReturnType<Selected, Schema> & ResolveExpandedRelations<Expands> & SystemColumnsFromOption<SystemCols>
    : // Use tuple wrapping to prevent distribution over union of keys
      [Selected] extends [keyof Schema]
      ? Pick<Schema, Selected> & ResolveExpandedRelations<Expands> & SystemColumnsFromOption<SystemCols>
      : never;

type RecordBuilderHasSelect<
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  Occ extends FMTable<any, any>,
  IsSingleField extends boolean,
  Selected,
> = IsSingleField extends true
  ? false
  : // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
    Selected extends Record<string, Column<any, any, any>>
    ? true
    : Selected extends keyof InferSchemaOutputFromFMTable<NonNullable<Occ>>
      ? false
      : true;

type ExecutableRecordBuilderReturn<
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  Occ extends FMTable<any, any>,
  IsSingleField extends boolean,
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
  FieldColumn extends Column<any, any, any, any> | undefined,
  Selected extends
    | keyof InferSchemaOutputFromFMTable<NonNullable<Occ>>
    // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
    | Record<string, Column<any, any, ExtractTableName<NonNullable<Occ>>>>,
  Expands extends ExpandedRelations,
  SystemCols extends SystemColumnsOption | undefined,
> =
  | ConditionallyWithODataAnnotations<
      ConditionallyWithSpecialColumns<
        RecordReturnType<
          InferSchemaOutputFromFMTable<NonNullable<Occ>>,
          IsSingleField,
          FieldColumn,
          Selected,
          Expands,
          SystemCols
        >,
        true,
        RecordBuilderHasSelect<Occ, IsSingleField, Selected>
      >,
      true
    >
  | ConditionallyWithODataAnnotations<
      ConditionallyWithSpecialColumns<
        RecordReturnType<
          InferSchemaOutputFromFMTable<NonNullable<Occ>>,
          IsSingleField,
          FieldColumn,
          Selected,
          Expands,
          SystemCols
        >,
        true,
        RecordBuilderHasSelect<Occ, IsSingleField, Selected>
      >,
      false
    >
  | ConditionallyWithODataAnnotations<
      ConditionallyWithSpecialColumns<
        RecordReturnType<
          InferSchemaOutputFromFMTable<NonNullable<Occ>>,
          IsSingleField,
          FieldColumn,
          Selected,
          Expands,
          SystemCols
        >,
        false,
        RecordBuilderHasSelect<Occ, IsSingleField, Selected>
      >,
      true
    >
  | ConditionallyWithODataAnnotations<
      ConditionallyWithSpecialColumns<
        RecordReturnType<
          InferSchemaOutputFromFMTable<NonNullable<Occ>>,
          IsSingleField,
          FieldColumn,
          Selected,
          Expands,
          SystemCols
        >,
        false,
        RecordBuilderHasSelect<Occ, IsSingleField, Selected>
      >,
      false
    >;

export class RecordBuilder<
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration, default allows untyped tables
  Occ extends FMTable<any, any> = FMTable<any, any>,
  IsSingleField extends boolean = false,
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
  FieldColumn extends Column<any, any, any, any> | undefined = undefined,
  Selected extends
    | keyof InferSchemaOutputFromFMTable<NonNullable<Occ>>
    // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
    | Record<string, Column<any, any, ExtractTableName<NonNullable<Occ>>>> = keyof InferSchemaOutputFromFMTable<
    NonNullable<Occ>
  >,
  Expands extends ExpandedRelations = {},
  DatabaseIncludeSpecialColumns extends boolean = false,
  SystemCols extends SystemColumnsOption | undefined = undefined,
> implements
    ExecutableBuilder<ExecutableRecordBuilderReturn<Occ, IsSingleField, FieldColumn, Selected, Expands, SystemCols>>
{
  private readonly table: Occ;
  private readonly recordId: string | number;
  private readonly operation?: "getSingleField" | "navigate";
  private readonly operationParam?: string;
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
  private readonly operationColumn?: Column<any, any, any, any>;
  private readonly isNavigateFromEntitySet?: boolean;
  private readonly navigateRelation?: string;
  private readonly navigateRelationEntityId?: string;
  private readonly navigateSourceTableName?: string;
  private readonly navigateSourceTableEntityId?: string;

  private readState = createInitialRecordReadBuilderState();

  private readonly layer: FMODataLayer;
  private readonly config: ODataConfig;
  private readonly logger: InternalLogger;

  // Compatibility accessors for internal modules that inspect builder internals via `as any`.
  private get selectedFields(): string[] | undefined {
    return this.readState.selectedFields;
  }

  private set selectedFields(selectedFields: string[] | undefined) {
    this.readState = cloneRecordReadBuilderState(this.readState, {
      selectedFields,
    });
  }

  private get expandConfigs(): ExpandConfig[] {
    return this.readState.expandConfigs;
  }

  private set expandConfigs(expandConfigs: ExpandConfig[]) {
    this.readState = cloneRecordReadBuilderState(this.readState, {
      expandConfigs,
    });
  }

  private get fieldMapping(): Record<string, string> | undefined {
    return this.readState.fieldMapping;
  }

  private set fieldMapping(fieldMapping: Record<string, string> | undefined) {
    this.readState = cloneRecordReadBuilderState(this.readState, {
      fieldMapping,
    });
  }

  private get systemColumns(): SystemColumnsOption | undefined {
    return this.readState.systemColumns;
  }

  private set systemColumns(systemColumns: SystemColumnsOption | undefined) {
    this.readState = cloneRecordReadBuilderState(this.readState, {
      systemColumns,
    });
  }

  constructor(config: {
    occurrence: Occ;
    layer: FMODataLayer;
    recordId: string | number;
  }) {
    this.table = config.occurrence;
    this.recordId = config.recordId;
    const runtime = createClientRuntime(config.layer);
    this.layer = runtime.layer;
    this.config = runtime.config;
    this.logger = runtime.logger;
  }

  /**
   * Helper to merge database-level useEntityIds and includeSpecialColumns with per-request options
   */
  private mergeExecuteOptions(options?: RequestInit & FFetchOptions & ExecuteOptions): RequestInit &
    FFetchOptions & {
      useEntityIds?: boolean;
      includeSpecialColumns?: boolean;
    } {
    const merged = mergeExecuteOptions(options, this.config.useEntityIds);
    return {
      ...merged,
      includeSpecialColumns: options?.includeSpecialColumns ?? this.config.includeSpecialColumns,
    };
  }

  /**
   * Gets the table ID (FMTID) if using entity IDs, otherwise returns the table name
   * @param useEntityIds - Optional override for entity ID usage
   */
  private getTableId(useEntityIds?: boolean): string {
    if (!this.table) {
      throw new BuilderInvariantError("RecordBuilder", "table occurrence is required");
    }
    return resolveTableId(this.table, getTableName(this.table), useEntityIds ?? this.config.useEntityIds);
  }

  /**
   * Creates a new RecordBuilder with modified configuration.
   * Used by select() to create new instances.
   */
  private cloneWithChanges<
    NewSelected extends
      | keyof InferSchemaOutputFromFMTable<NonNullable<Occ>>
      // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
      | Record<string, Column<any, any, ExtractTableName<NonNullable<Occ>>>> = Selected,
    NewSystemCols extends SystemColumnsOption | undefined = SystemCols,
  >(changes: {
    selectedFields?: string[];
    fieldMapping?: Record<string, string>;
    systemColumns?: NewSystemCols;
  }): RecordBuilder<Occ, false, FieldColumn, NewSelected, Expands, DatabaseIncludeSpecialColumns, NewSystemCols> {
    const newBuilder = new RecordBuilder<
      Occ,
      false,
      FieldColumn,
      NewSelected,
      Expands,
      DatabaseIncludeSpecialColumns,
      NewSystemCols
    >({
      occurrence: this.table,
      layer: this.layer,
      recordId: this.recordId,
    });
    // Use type assertion to allow assignment to readonly properties on new instance

    // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
    const mutableBuilder = newBuilder as any;
    mutableBuilder.readState = cloneRecordReadBuilderState(this.readState, {
      selectedFields: "selectedFields" in changes ? changes.selectedFields : this.selectedFields,
      fieldMapping: "fieldMapping" in changes ? changes.fieldMapping : this.fieldMapping,
      systemColumns: changes.systemColumns !== undefined ? changes.systemColumns : this.systemColumns,
      expandConfigs: this.expandConfigs,
    });
    // Preserve navigation context
    mutableBuilder.isNavigateFromEntitySet = this.isNavigateFromEntitySet;
    mutableBuilder.navigateRelation = this.navigateRelation;
    mutableBuilder.navigateRelationEntityId = this.navigateRelationEntityId;
    mutableBuilder.navigateSourceTableName = this.navigateSourceTableName;
    mutableBuilder.navigateSourceTableEntityId = this.navigateSourceTableEntityId;
    mutableBuilder.operationColumn = this.operationColumn;
    return newBuilder;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
  getSingleField<TColumn extends Column<any, any, ExtractTableName<NonNullable<Occ>>, any>>(
    column: TColumn,
  ): RecordBuilder<
    Occ,
    true,
    TColumn,
    keyof InferSchemaOutputFromFMTable<NonNullable<Occ>>,
    {},
    DatabaseIncludeSpecialColumns
  > {
    // Runtime validation: ensure column is from the correct table
    const tableName = getTableName(this.table);
    if (!column.isFromTable(tableName)) {
      throw new BuilderInvariantError(
        "RecordBuilder.getSingleField",
        `column ${column.toString()} is not from table ${tableName}`,
      );
    }

    const newBuilder = new RecordBuilder<
      Occ,
      true,
      TColumn,
      keyof InferSchemaOutputFromFMTable<NonNullable<Occ>>,
      {},
      DatabaseIncludeSpecialColumns
    >({
      occurrence: this.table,
      layer: this.layer,
      recordId: this.recordId,
    });
    // Use type assertion to allow assignment to readonly properties on new instance

    // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
    const mutableBuilder = newBuilder as any;
    mutableBuilder.operation = "getSingleField";
    mutableBuilder.operationColumn = column;
    // Preserve navigation context
    mutableBuilder.isNavigateFromEntitySet = this.isNavigateFromEntitySet;
    mutableBuilder.navigateRelation = this.navigateRelation;
    mutableBuilder.navigateSourceTableName = this.navigateSourceTableName;
    return newBuilder;
  }

  /**
   * Select fields using column references, or pass "all" to clear any defaultSelect and fetch all fields.
   * Allows renaming fields by using different keys in the object.
   * Container fields cannot be selected and will cause a type error.
   *
   * @example
   * db.from(contacts).get("uuid").select({
   *   name: contacts.name,
   *   userEmail: contacts.email  // renamed!
   * })
   *
   * @example
   * // Include system columns (ROWID, ROWMODID) when using select()
   * db.from(contacts).get("uuid").select(
   *   { name: contacts.name },
   *   { ROWID: true, ROWMODID: true }
   * )
   *
   * @example
   * // Override defaultSelect to fetch all fields
   * db.from(contacts).get("uuid").select("all")
   *
   * @param fields - Object mapping output keys to column references (container fields excluded), or "all" to select all fields
   * @param systemColumns - Optional object to request system columns (ROWID, ROWMODID)
   * @returns RecordBuilder with updated selected fields
   */
  select(
    fields: "all",
  ): RecordBuilder<
    Occ,
    false,
    FieldColumn,
    keyof InferSchemaOutputFromFMTable<NonNullable<Occ>>,
    Expands,
    DatabaseIncludeSpecialColumns,
    undefined
  >;
  select<
    // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
    TSelect extends Record<string, Column<any, any, ExtractTableName<Occ>, false>>,
    TSystemCols extends SystemColumnsOption = {},
  >(
    fields: TSelect,
    systemColumns?: TSystemCols,
  ): RecordBuilder<Occ, false, FieldColumn, TSelect, Expands, DatabaseIncludeSpecialColumns, TSystemCols>;
  // biome-ignore lint/suspicious/noExplicitAny: Implementation signature hidden from callers
  select(fields: any, systemColumns?: any): any {
    if (fields === "all") {
      return this.cloneWithChanges({
        selectedFields: undefined,
        fieldMapping: undefined,
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type parameter
        systemColumns: undefined as any,
      });
    }

    const tableName = getTableName(this.table);
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
      selectedFields: finalSelectedFields,
      fieldMapping: Object.keys(fieldMapping).length > 0 ? fieldMapping : undefined,
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type parameter
      systemColumns: systemColumns as any,
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for complex generic return type
    }) as any;
  }

  /**
   * Expand a navigation property to include related records.
   * Supports nested select, filter, orderBy, and expand operations.
   *
   * @example
   * ```typescript
   * // Simple expand with FMTable object
   * const contact = await db.from(contacts).get("uuid").expand(users).execute();
   *
   * // Expand with select
   * const contact = await db.from(contacts).get("uuid")
   *   .expand(users, b => b.select({ username: users.username, email: users.email }))
   *   .execute();
   * ```
   */
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
    TNestedExpands extends ExpandedRelations = {},
  >(
    targetTable: ValidExpandTarget<Occ, TargetTable>,
    callback?: (
      builder: QueryBuilder<TargetTable, keyof InferSchemaOutputFromFMTable<TargetTable>, false, false, {}, false>,
      // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any QueryBuilder configuration
    ) => QueryBuilder<TargetTable, TSelected, any, any, TNestedExpands, any, any>,
  ): RecordBuilder<
    Occ,
    false,
    FieldColumn,
    Selected,
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
    // Create new builder with updated types
    // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any ExpandedRelations
    const newBuilder = new RecordBuilder<Occ, false, FieldColumn, Selected, any, DatabaseIncludeSpecialColumns>({
      occurrence: this.table,
      layer: this.layer,
      recordId: this.recordId,
    });

    // Use type assertion to allow assignment to readonly properties on new instance
    // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
    const mutableBuilder = newBuilder as any;
    // Copy existing state
    mutableBuilder.readState = cloneRecordReadBuilderState(this.readState, {
      selectedFields: this.selectedFields,
      fieldMapping: this.fieldMapping,
      systemColumns: this.systemColumns,
      expandConfigs: this.expandConfigs,
    });
    mutableBuilder.isNavigateFromEntitySet = this.isNavigateFromEntitySet;
    mutableBuilder.navigateRelation = this.navigateRelation;
    mutableBuilder.navigateRelationEntityId = this.navigateRelationEntityId;
    mutableBuilder.navigateSourceTableName = this.navigateSourceTableName;
    mutableBuilder.navigateSourceTableEntityId = this.navigateSourceTableEntityId;
    mutableBuilder.operationColumn = this.operationColumn;

    // Use ExpandBuilder.processExpand to handle the expand logic
    const expandBuilder = new ExpandBuilder(this.config.useEntityIds, this.logger);
    type TargetBuilder = QueryBuilder<
      TargetTable,
      keyof InferSchemaOutputFromFMTable<TargetTable>,
      false,
      false,
      {},
      false
    >;
    const expandConfig = expandBuilder.processExpand<TargetTable, TargetBuilder>(
      targetTable,
      this.table ?? undefined,
      callback as ((builder: TargetBuilder) => TargetBuilder) | undefined,
      () =>
        // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any QueryBuilder configuration
        new QueryBuilder<TargetTable, any, any, any, any, any, DatabaseIncludeSpecialColumns, undefined>({
          occurrence: targetTable,
          layer: this.layer,
        }),
    );

    mutableBuilder.readState = cloneRecordReadBuilderState(mutableBuilder.readState, {
      expandConfigs: [...this.expandConfigs, expandConfig],
    });
    // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed as expand changes generic parameters in complex way that TypeScript cannot infer
    return newBuilder as any;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  navigate<TargetTable extends FMTable<any, any>>(
    targetTable: ValidExpandTarget<Occ, TargetTable>,
  ): QueryBuilder<
    TargetTable,
    keyof InferSchemaOutputFromFMTable<TargetTable>,
    false,
    false,
    {},
    false,
    DatabaseIncludeSpecialColumns,
    undefined
  > {
    // Extract name and validate
    const relationName = getTableName(targetTable);

    // Runtime validation: Check if relation name is in navigationPaths
    if (this.table) {
      const navigationPaths = getNavigationPaths(this.table);
      if (navigationPaths && !navigationPaths.includes(relationName)) {
        this.logger.warn(
          `Cannot navigate to "${relationName}". Valid navigation paths: ${navigationPaths.length > 0 ? navigationPaths.join(", ") : "none"}`,
        );
      }
    }

    // Create QueryBuilder with target table
    // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any QueryBuilder configuration
    const builder = new QueryBuilder<TargetTable, any, any, any, any, any, DatabaseIncludeSpecialColumns, undefined>({
      occurrence: targetTable,
      layer: this.layer,
    });

    // Store the navigation info - resolve entity ID for relation if needed
    const relationEntityId = isUsingEntityIds(targetTable)
      ? resolveTableId(targetTable, relationName, true)
      : relationName;

    // If this RecordBuilder came from a navigated EntitySet, we need to preserve that base path
    let sourceTableName: string;
    let sourceTableEntityId: string;
    let baseRelation: string | undefined;
    let baseRelationEntityId: string | undefined;
    if (this.isNavigateFromEntitySet && this.navigateSourceTableName && this.navigateRelation) {
      // Build the base path: /sourceTable/relation('recordId')/newRelation
      sourceTableName = this.navigateSourceTableName;
      sourceTableEntityId = this.navigateSourceTableEntityId ?? sourceTableName;
      baseRelation = this.navigateRelation;
      baseRelationEntityId = this.navigateRelationEntityId ?? baseRelation;
    } else {
      // Normal record navigation: /tableName('recordId')/relation
      // Use table ID if available, otherwise table name
      if (!this.table) {
        throw new BuilderInvariantError("RecordBuilder.navigate", "table occurrence is required for navigation");
      }
      sourceTableName = getTableName(this.table);
      sourceTableEntityId = isUsingEntityIds(this.table)
        ? resolveTableId(this.table, sourceTableName, true)
        : sourceTableName;
    }

    // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
    (builder as any).navigation = {
      recordId: this.recordId,
      relation: relationName,
      relationEntityId,
      sourceTableName,
      sourceTableEntityId,
      baseRelation,
      baseRelationEntityId,
    };

    return builder;
  }

  /**
   * Builds the complete query string including $select and $expand parameters.
   */
  private buildQueryString(includeSpecialColumns?: boolean, useEntityIds?: boolean): string {
    // Use merged includeSpecialColumns if provided, otherwise use database-level default
    const finalIncludeSpecialColumns = includeSpecialColumns ?? this.config.includeSpecialColumns;
    // Use merged useEntityIds if provided, otherwise use database-level default
    const finalUseEntityIds = useEntityIds ?? this.config.useEntityIds;

    return buildSelectExpandQueryString({
      selectedFields: this.selectedFields,
      expandConfigs: this.expandConfigs,
      table: this.table,
      useEntityIds: finalUseEntityIds,
      logger: this.logger,
      includeSpecialColumns: finalIncludeSpecialColumns,
    });
  }

  execute<EO extends ExecuteOptions>(
    options?: ExecuteMethodOptions<EO>,
  ): Promise<
    Result<
      ConditionallyWithODataAnnotations<
        ConditionallyWithSpecialColumns<
          RecordReturnType<
            InferSchemaOutputFromFMTable<NonNullable<Occ>>,
            IsSingleField,
            FieldColumn,
            Selected,
            Expands,
            SystemCols
          >,
          // Use the merged value: if explicitly provided in options, use that; otherwise use database default
          NormalizeIncludeSpecialColumns<EO["includeSpecialColumns"], DatabaseIncludeSpecialColumns>,
          // Check if select was applied: if Selected is Record (object select) or a subset of keys, select was applied
          IsSingleField extends true
            ? false // Single field operations don't include special columns
            : // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
              Selected extends Record<string, Column<any, any, any>>
              ? true
              : Selected extends keyof InferSchemaOutputFromFMTable<NonNullable<Occ>>
                ? false
                : true
        >,
        EO["includeODataAnnotations"] extends true ? true : false
      >
    >
  > {
    const mergedOptions = this.mergeExecuteOptions(options);
    let url: string;

    // Build the base URL depending on whether this came from a navigated EntitySet
    if (this.isNavigateFromEntitySet && this.navigateSourceTableName && this.navigateRelation) {
      const sourceSegment = mergedOptions.useEntityIds
        ? (this.navigateSourceTableEntityId ?? this.navigateSourceTableName)
        : this.navigateSourceTableName;
      const relationSegment = mergedOptions.useEntityIds
        ? (this.navigateRelationEntityId ?? this.navigateRelation)
        : this.navigateRelation;
      // From navigated EntitySet: /sourceTable/relation('recordId')
      url = `/${this.config.databaseName}/${sourceSegment}/${relationSegment}('${this.recordId}')`;
    } else {
      // Normal record: /tableName('recordId') - use FMTID if configured
      const tableId = this.getTableId(mergedOptions.useEntityIds);
      url = `/${this.config.databaseName}/${tableId}('${this.recordId}')`;
    }

    if (this.operation === "getSingleField" && this.operationColumn) {
      url += `/${this.operationColumn.getFieldIdentifier(mergedOptions.useEntityIds)}`;
    } else if (this.operation === "getSingleField" && this.operationParam) {
      url += `/${this.operationParam}`;
    } else {
      // Add query string for select/expand (only when not getting a single field)
      const queryString = this.buildQueryString(mergedOptions.includeSpecialColumns, mergedOptions.useEntityIds);
      url += queryString;
    }
    const pipeline = Effect.gen(this, function* () {
      // Make GET request via DI
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
      const response = yield* requestFromService<any>(url, {
        method: "GET",
        ...mergedOptions,
      });

      // Handle single field operation
      if (this.operation === "getSingleField") {
        // Single field returns a JSON object with @context and value
        // The type is extracted from the Column stored in FieldColumn generic
        // biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
        const fieldResponse = response as ODataFieldResponse<any>;
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type extraction
        return fieldResponse.value as any;
      }

      const result = yield* Effect.tryPromise({
        try: () =>
          processRecordResponse(response, {
            table: this.table,
            selectedFields: this.selectedFields,
            expandConfigs: this.expandConfigs,
            skipValidation: options?.skipValidation,
            useEntityIds: mergedOptions.useEntityIds,
            includeSpecialColumns: mergedOptions.includeSpecialColumns,
            fieldMapping: this.fieldMapping,
            logger: this.logger,
          }),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      if (result.error) {
        return yield* Effect.fail(result.error);
      }

      return result.data;
    });

    const result = runLayerResult(this.layer, pipeline, "fmodata.record.get", {
      "fmodata.table": getTableName(this.table),
    });
    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for complex generic return type
    return result as Promise<Result<any>>;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Request body can be any JSON-serializable value
  getRequestConfig(): { method: string; url: string; body?: any } {
    let url: string;

    // Build the base URL depending on whether this came from a navigated EntitySet
    if (this.isNavigateFromEntitySet && this.navigateSourceTableName && this.navigateRelation) {
      const sourceSegment = this.config.useEntityIds
        ? (this.navigateSourceTableEntityId ?? this.navigateSourceTableName)
        : this.navigateSourceTableName;
      const relationSegment = this.config.useEntityIds
        ? (this.navigateRelationEntityId ?? this.navigateRelation)
        : this.navigateRelation;
      // From navigated EntitySet: /sourceTable/relation('recordId')
      url = `/${this.config.databaseName}/${sourceSegment}/${relationSegment}('${this.recordId}')`;
    } else {
      // For batch operations, use database-level setting (no per-request override available here)
      const tableId = this.getTableId(this.config.useEntityIds);
      url = `/${this.config.databaseName}/${tableId}('${this.recordId}')`;
    }

    if (this.operation === "getSingleField" && this.operationColumn) {
      // Use the column's getFieldIdentifier to support entity IDs
      url += `/${this.operationColumn.getFieldIdentifier(this.config.useEntityIds)}`;
    } else if (this.operation === "getSingleField" && this.operationParam) {
      // Fallback for backwards compatibility (shouldn't happen in normal flow)
      url += `/${this.operationParam}`;
    } else {
      // Add query string for select/expand (only when not getting a single field)
      const queryString = this.buildQueryString();
      url += queryString;
    }

    return {
      method: "GET",
      url,
    };
  }

  /**
   * Returns the query string for this record builder (for testing purposes).
   */
  getQueryString(options?: { useEntityIds?: boolean }): string {
    const useEntityIds = options?.useEntityIds ?? this.config.useEntityIds;
    let path: string;

    // Build the path depending on navigation context
    if (this.isNavigateFromEntitySet && this.navigateSourceTableName && this.navigateRelation) {
      const sourceSegment = useEntityIds
        ? (this.navigateSourceTableEntityId ?? this.navigateSourceTableName)
        : this.navigateSourceTableName;
      const relationSegment = useEntityIds
        ? (this.navigateRelationEntityId ?? this.navigateRelation)
        : this.navigateRelation;
      path = `/${sourceSegment}/${relationSegment}('${this.recordId}')`;
    } else {
      // Use getTableId to respect entity ID settings (same as getRequestConfig)
      const tableId = this.getTableId(useEntityIds);
      path = `/${tableId}('${this.recordId}')`;
    }

    if (this.operation === "getSingleField" && this.operationColumn) {
      return `${path}/${this.operationColumn.getFieldIdentifier(useEntityIds)}`;
    }
    if (this.operation === "getSingleField" && this.operationParam) {
      // Fallback for backwards compatibility (shouldn't happen in normal flow)
      return `${path}/${this.operationParam}`;
    }

    const queryString = this.buildQueryString(undefined, useEntityIds);
    return `${path}${queryString}`;
  }

  toRequest(baseUrl: string, options?: ExecuteOptions): Request {
    const config = this.getRequestConfig();
    return createODataRequest(baseUrl, config, options);
  }

  async processResponse(
    response: Response,
    options?: ExecuteOptions,
  ): Promise<
    Result<
      RecordReturnType<
        InferSchemaOutputFromFMTable<NonNullable<Occ>>,
        IsSingleField,
        FieldColumn,
        Selected,
        Expands,
        SystemCols
      >
    >
  > {
    // Check for error responses (important for batch operations)
    if (!response.ok) {
      const tableName = this.table ? getTableName(this.table) : "unknown";
      const error = await parseErrorResponse(response, response.url || `/${this.config.databaseName}/${tableName}`);
      return { data: undefined, error };
    }

    // Use safeJsonParse to handle FileMaker's invalid JSON with unquoted ? values
    const rawResponse = await safeJsonParse(response);

    // Handle single field operation
    if (this.operation === "getSingleField") {
      // Single field returns a JSON object with @context and value
      // The type is extracted from the Column stored in FieldColumn generic
      // biome-ignore lint/suspicious/noExplicitAny: Type parameter inferred from FieldColumn generic
      const fieldResponse = rawResponse as ODataFieldResponse<any>;
      // biome-ignore lint/suspicious/noExplicitAny: Type parameter inferred from FieldColumn generic
      return { data: fieldResponse.value as any, error: undefined };
    }

    // Use shared response processor
    const mergedOptions = this.mergeExecuteOptions(options);
    return processRecordResponse(rawResponse, {
      table: this.table,
      selectedFields: this.selectedFields,
      expandConfigs: this.expandConfigs,
      skipValidation: options?.skipValidation,
      useEntityIds: mergedOptions.useEntityIds,
      includeSpecialColumns: mergedOptions.includeSpecialColumns,
      fieldMapping: this.fieldMapping,
      logger: this.logger,
    });
  }
}
