import type { InternalLogger } from "../logger";
import type { FieldBuilder } from "../orm/field-builders";
import type {
  ColumnMap,
  FMTable,
  InferSchemaOutputFromFMTable,
  InsertDataFromFMTable,
  UpdateDataFromFMTable,
  ValidExpandTarget,
} from "../orm/table";
import {
  FMTable as FMTableClass,
  getDefaultSelect,
  getTableColumns,
  getTableName,
  getTableSchema,
  isUsingEntityIds,
} from "../orm/table";
import type { FMODataLayer, ODataConfig } from "../services";
import { resolveTableId } from "./builders/table-utils";
import type { Database } from "./database";
import { DeleteBuilder } from "./delete-builder";
import { InsertBuilder } from "./insert-builder";
import { QueryBuilder } from "./query/index";
import { RecordBuilder } from "./record-builder";
import { createClientRuntime } from "./runtime";
import { UpdateBuilder } from "./update-builder";

// Helper type to extract defaultSelect from an FMTable
// Since TypeScript can't extract Symbol-indexed properties at the type level,
// we simplify to return keyof InferSchemaFromFMTable<O> when O is an FMTable.
// The actual defaultSelect logic is handled at runtime.
// biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
type _ExtractDefaultSelect<O> = O extends FMTable<any, any> ? keyof InferSchemaOutputFromFMTable<O> : never;

/**
 * Helper type to extract properly-typed columns from an FMTable.
 * This preserves the specific column types instead of widening to `any`.
 */
type ExtractColumnsFromOcc<T> =
  // biome-ignore lint/suspicious/noExplicitAny: Required for type inference with infer
  T extends FMTable<infer TFields, infer TName, any>
    ? // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any FieldBuilder configuration
      TFields extends Record<string, FieldBuilder<any, any, any, any>>
      ? ColumnMap<TFields, TName>
      : never
    : never;

// biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
export class EntitySet<Occ extends FMTable<any, any>, DatabaseIncludeSpecialColumns extends boolean = false> {
  private readonly occurrence: Occ;
  private readonly layer: FMODataLayer;
  private readonly config: ODataConfig;
  private readonly logger: InternalLogger;
  private readonly database: Database<DatabaseIncludeSpecialColumns>; // Database instance for accessing occurrences
  private readonly isNavigateFromEntitySet?: boolean;
  private readonly navigateRelation?: string;
  private readonly navigateRelationEntityId?: string;
  private readonly navigateSourceTableName?: string;
  private readonly navigateSourceTableEntityId?: string;
  private readonly navigateBasePath?: string; // Full base path for chained navigations
  private readonly navigateBasePathEntityId?: string;

  constructor(config: {
    occurrence: Occ;
    layer: FMODataLayer;
    // biome-ignore lint/suspicious/noExplicitAny: Database type is optional and can be any Database instance
    database?: any;
  }) {
    this.occurrence = config.occurrence;
    this.database = config.database;
    // Extract config and logger from the layer for sync access
    const runtime = createClientRuntime(config.layer);
    this.layer = runtime.layer;
    this.config = runtime.config;
    this.logger = runtime.logger;
  }

  // Type-only method to help TypeScript infer the schema from table
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  static create<Occ extends FMTable<any, any>, DatabaseIncludeSpecialColumns extends boolean = false>(config: {
    occurrence: Occ;
    layer: FMODataLayer;
    database: Database<DatabaseIncludeSpecialColumns>;
  }): EntitySet<Occ, DatabaseIncludeSpecialColumns> {
    return new EntitySet<Occ, DatabaseIncludeSpecialColumns>({
      occurrence: config.occurrence,
      layer: config.layer,
      database: config.database,
    });
  }

  private applyNavigationContext<T>(builder: T): T {
    if (this.isNavigateFromEntitySet && this.navigateRelation && this.navigateSourceTableName) {
      // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
      (builder as any).navigation = {
        relation: this.navigateRelation,
        relationEntityId: this.navigateRelationEntityId,
        sourceTableName: this.navigateSourceTableName,
        sourceTableEntityId: this.navigateSourceTableEntityId,
        basePath: this.navigateBasePath,
        basePathEntityId: this.navigateBasePathEntityId,
      };
    }
    return builder;
  }

  // biome-ignore lint/complexity/noBannedTypes: Empty object type represents no expands by default
  list(): QueryBuilder<Occ, keyof InferSchemaOutputFromFMTable<Occ>, false, false, {}, DatabaseIncludeSpecialColumns> {
    const builder = new QueryBuilder<
      Occ,
      keyof InferSchemaOutputFromFMTable<Occ>,
      false,
      false,
      // biome-ignore lint/complexity/noBannedTypes: Empty object type represents no expands by default
      {},
      DatabaseIncludeSpecialColumns
    >({
      occurrence: this.occurrence as Occ,
      layer: this.layer,
    });

    // Apply defaultSelect if occurrence exists and select hasn't been called
    if (this.occurrence) {
      // FMTable - access via helper functions
      const defaultSelectValue = getDefaultSelect(this.occurrence);
      // Schema is stored directly as Partial<Record<keyof TFields, StandardSchemaV1>>
      const _schema = getTableSchema(this.occurrence);

      if (defaultSelectValue === "schema") {
        // Use getTableColumns to get all columns and select them
        // This is equivalent to select(getTableColumns(occurrence))
        // Cast to the declared return type - runtime behavior handles the actual selection
        const allColumns = getTableColumns(this.occurrence) as ExtractColumnsFromOcc<Occ>;

        const selectedBuilder = this.applyNavigationContext(builder.select(allColumns)).top(1000);
        return selectedBuilder as QueryBuilder<
          Occ,
          keyof InferSchemaOutputFromFMTable<Occ>,
          false,
          false,
          // biome-ignore lint/complexity/noBannedTypes: Empty object type represents no expands by default
          {},
          DatabaseIncludeSpecialColumns
        >;
      }
      if (typeof defaultSelectValue === "object") {
        // defaultSelectValue is a select object (Record<string, Column>)
        // Cast to the declared return type - runtime behavior handles the actual selection
        const selectedBuilder = this.applyNavigationContext(
          builder.select(defaultSelectValue as ExtractColumnsFromOcc<Occ>),
        ).top(1000);
        return selectedBuilder as QueryBuilder<
          Occ,
          keyof InferSchemaOutputFromFMTable<Occ>,
          false,
          false,
          // biome-ignore lint/complexity/noBannedTypes: Empty object type represents no expands by default
          {},
          DatabaseIncludeSpecialColumns
        >;
      }
      // If defaultSelect is "all", no changes needed (current behavior)
    }

    // Apply default pagination limit of 1000 records to prevent stack overflow
    // with large datasets. Users can override with .top() if needed.
    return this.applyNavigationContext(builder).top(1000);
  }

  get(
    id: string | number,
    // biome-ignore lint/complexity/noBannedTypes: Empty object type represents no expands by default
  ): RecordBuilder<Occ, false, undefined, keyof InferSchemaOutputFromFMTable<Occ>, {}, DatabaseIncludeSpecialColumns> {
    const builder = new RecordBuilder<
      Occ,
      false,
      undefined,
      keyof InferSchemaOutputFromFMTable<Occ>,
      // biome-ignore lint/complexity/noBannedTypes: Empty object type represents no expands by default
      {},
      DatabaseIncludeSpecialColumns
    >({
      occurrence: this.occurrence,
      layer: this.layer,
      recordId: id,
    });

    // Apply defaultSelect if occurrence exists
    if (this.occurrence) {
      // FMTable - access via helper functions
      const defaultSelectValue = getDefaultSelect(this.occurrence);
      // Schema is stored directly as Partial<Record<keyof TFields, StandardSchemaV1>>
      const _schema = getTableSchema(this.occurrence);

      if (defaultSelectValue === "schema") {
        // Use getTableColumns to get all columns and select them
        // This is equivalent to select(getTableColumns(occurrence))
        // Use ExtractColumnsFromOcc to preserve the properly-typed column types
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type parameter
        const allColumns = getTableColumns(this.occurrence as any) as ExtractColumnsFromOcc<Occ>;

        const selectedBuilder = this.applyNavigationContext(builder.select(allColumns));
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion for complex generic return type
        return selectedBuilder as any;
      }
      if (typeof defaultSelectValue === "object" && defaultSelectValue !== null && !Array.isArray(defaultSelectValue)) {
        // defaultSelectValue is a select object (Record<string, Column>)
        // Use it directly with select()
        // Use ExtractColumnsFromOcc to preserve the properly-typed column types
        const selectedBuilder = this.applyNavigationContext(
          builder.select(defaultSelectValue as ExtractColumnsFromOcc<Occ>),
        );
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion for complex generic return type
        return selectedBuilder as any;
      }
      // If defaultSelect is "all", no changes needed (current behavior)
    }

    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for complex generic return type
    return this.applyNavigationContext(builder) as any;
  }

  // Overload: when returnFullRecord is false
  insert(data: InsertDataFromFMTable<Occ>, options: { returnFullRecord: false }): InsertBuilder<Occ, "minimal">;

  // Overload: when returnFullRecord is true or omitted (default)
  insert(data: InsertDataFromFMTable<Occ>, options?: { returnFullRecord?: true }): InsertBuilder<Occ, "representation">;

  // Implementation
  insert(
    data: InsertDataFromFMTable<Occ>,
    options?: { returnFullRecord?: boolean },
  ): InsertBuilder<Occ, "minimal" | "representation"> {
    const returnPreference = options?.returnFullRecord === false ? "minimal" : "representation";

    return new InsertBuilder<Occ, typeof returnPreference>({
      occurrence: this.occurrence,
      layer: this.layer,
      // biome-ignore lint/suspicious/noExplicitAny: Input type is validated/transformed at runtime
      data: data as any,
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type parameter
      returnPreference: returnPreference as any,
    });
  }

  // Overload: when returnFullRecord is explicitly true
  update(data: UpdateDataFromFMTable<Occ>, options: { returnFullRecord: true }): UpdateBuilder<Occ, "representation">;

  // Overload: when returnFullRecord is false or omitted (default)
  update(data: UpdateDataFromFMTable<Occ>, options?: { returnFullRecord?: false }): UpdateBuilder<Occ, "minimal">;

  // Implementation
  update(
    data: UpdateDataFromFMTable<Occ>,
    options?: { returnFullRecord?: boolean },
  ): UpdateBuilder<Occ, "minimal" | "representation"> {
    const returnPreference = options?.returnFullRecord === true ? "representation" : "minimal";

    return new UpdateBuilder<Occ, typeof returnPreference>({
      occurrence: this.occurrence,
      layer: this.layer,
      // biome-ignore lint/suspicious/noExplicitAny: Input type is validated/transformed at runtime
      data: data as any,
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type parameter
      returnPreference: returnPreference as any,
    });
  }

  delete(): DeleteBuilder<Occ> {
    return new DeleteBuilder<Occ>({
      occurrence: this.occurrence,
      layer: this.layer,
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for complex generic return type
    }) as any;
  }

  // Implementation
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  navigate<TargetTable extends FMTable<any, any>>(
    targetTable: ValidExpandTarget<Occ, TargetTable>,
    // biome-ignore lint/suspicious/noExplicitAny: Required for conditional type inference
  ): EntitySet<TargetTable extends FMTable<any, any> ? TargetTable : never, DatabaseIncludeSpecialColumns> {
    // Check if it's an FMTable object or a string
    let relationName: string;

    // FMTable object - extract name and validate
    relationName = getTableName(targetTable);

    // Runtime validation: Check if relation name is in navigationPaths
    if (this.occurrence && FMTableClass.Symbol.NavigationPaths in this.occurrence) {
      // biome-ignore lint/suspicious/noExplicitAny: Symbol property access for internal property
      const navigationPaths = (this.occurrence as any)[FMTableClass.Symbol.NavigationPaths] as readonly string[];
      if (navigationPaths && !navigationPaths.includes(relationName)) {
        this.logger.warn(
          `Cannot navigate to "${relationName}". Valid navigation paths: ${navigationPaths.length > 0 ? navigationPaths.join(", ") : "none"}`,
        );
      }
    }

    // Create EntitySet with target table
    // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any FMTable configuration
    const entitySet = new EntitySet<any, DatabaseIncludeSpecialColumns>({
      occurrence: targetTable,
      layer: this.layer,
      database: this.database,
    });
    // Resolve entity IDs lazily at request time by storing both name and ID forms
    const relationEntityId = isUsingEntityIds(targetTable)
      ? resolveTableId(targetTable, relationName, true)
      : relationName;
    const sourceTableName = getTableName(this.occurrence);
    const sourceTableEntityId = isUsingEntityIds(this.occurrence)
      ? resolveTableId(this.occurrence, sourceTableName, true)
      : sourceTableName;

    // Store the navigation info in the EntitySet
    // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
    (entitySet as any).isNavigateFromEntitySet = true;
    // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
    (entitySet as any).navigateRelation = relationName;
    // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
    (entitySet as any).navigateRelationEntityId = relationEntityId;

    // Build the full base path for chained navigations
    if (this.isNavigateFromEntitySet && this.navigateBasePath) {
      // Already have a base path from previous navigation - extend it with current relation
      // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
      (entitySet as any).navigateBasePath = `${this.navigateBasePath}/${this.navigateRelation}`;
      // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
      (entitySet as any).navigateBasePathEntityId =
        `${this.navigateBasePathEntityId ?? this.navigateBasePath}/${this.navigateRelationEntityId ?? this.navigateRelation}`;
      // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
      (entitySet as any).navigateSourceTableName = this.navigateSourceTableName;
      // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
      (entitySet as any).navigateSourceTableEntityId = this.navigateSourceTableEntityId;
    } else if (this.isNavigateFromEntitySet && this.navigateRelation) {
      // First chained navigation - create base path from source/relation
      // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
      (entitySet as any).navigateBasePath = `${this.navigateSourceTableName}/${this.navigateRelation}`;
      // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
      (entitySet as any).navigateBasePathEntityId =
        `${this.navigateSourceTableEntityId ?? this.navigateSourceTableName}/${this.navigateRelationEntityId ?? this.navigateRelation}`;
      // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
      (entitySet as any).navigateSourceTableName = this.navigateSourceTableName;
      // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
      (entitySet as any).navigateSourceTableEntityId = this.navigateSourceTableEntityId;
    } else {
      // Initial navigation - source is just the table name (resolved to entity ID if needed)
      // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
      (entitySet as any).navigateSourceTableName = sourceTableName;
      // biome-ignore lint/suspicious/noExplicitAny: Mutation of readonly properties for builder pattern
      (entitySet as any).navigateSourceTableEntityId = sourceTableEntityId;
    }
    return entitySet;
  }
}
