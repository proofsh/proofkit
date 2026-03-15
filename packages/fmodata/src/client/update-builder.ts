import type { FFetchOptions } from "@fetchkit/ffetch";
import { Effect } from "effect";
import { makeRequestEffect, runAsResult, tryEffect, withSpan } from "../effect";
import type { FMODataErrorType } from "../errors";
import type { FMTable, InferSchemaOutputFromFMTable } from "../orm/table";
import { getBaseTableConfig, getTableId as getTableIdHelper, getTableName, isUsingEntityIds } from "../orm/table";
import { transformFieldNamesToIds } from "../transform";
import type { ExecutableBuilder, ExecuteMethodOptions, ExecuteOptions, ExecutionContext, Result } from "../types";
import { getAcceptHeader } from "../types";
import { validateAndTransformInput } from "../validation";
import { parseErrorResponse } from "./error-parser";
import { QueryBuilder } from "./query-builder";

/**
 * Initial update builder returned from EntitySet.update(data)
 * Requires calling .byId() or .where() before .execute() is available
 */
export class UpdateBuilder<
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  Occ extends FMTable<any, any>,
  ReturnPreference extends "minimal" | "representation" = "minimal",
> {
  private readonly databaseName: string;
  private readonly context: ExecutionContext;
  private readonly table: Occ;
  private readonly data: Partial<InferSchemaOutputFromFMTable<Occ>>;
  private readonly returnPreference: ReturnPreference;

  private readonly databaseUseEntityIds: boolean;
  private readonly databaseIncludeSpecialColumns: boolean;

  constructor(config: {
    occurrence: Occ;
    databaseName: string;
    context: ExecutionContext;
    data: Partial<InferSchemaOutputFromFMTable<Occ>>;
    returnPreference: ReturnPreference;
    databaseUseEntityIds?: boolean;
    databaseIncludeSpecialColumns?: boolean;
  }) {
    this.table = config.occurrence;
    this.databaseName = config.databaseName;
    this.context = config.context;
    this.data = config.data;
    this.returnPreference = config.returnPreference;
    this.databaseUseEntityIds = config.databaseUseEntityIds ?? false;
    this.databaseIncludeSpecialColumns = config.databaseIncludeSpecialColumns ?? false;
  }

  /**
   * Update a single record by ID
   * Returns updated count by default, or full record if returnFullRecord was set to true
   */
  byId(id: string | number): ExecutableUpdateBuilder<Occ, true, ReturnPreference> {
    return new ExecutableUpdateBuilder<Occ, true, ReturnPreference>({
      occurrence: this.table,
      databaseName: this.databaseName,
      context: this.context,
      data: this.data,
      mode: "byId",
      recordId: id,
      returnPreference: this.returnPreference,
      databaseUseEntityIds: this.databaseUseEntityIds,
    });
  }

  /**
   * Update records matching a filter query
   * Returns updated count by default, or full record if returnFullRecord was set to true
   * @param fn Callback that receives a QueryBuilder for building the filter
   */
  where(fn: (q: QueryBuilder<Occ>) => QueryBuilder<Occ>): ExecutableUpdateBuilder<Occ, true, ReturnPreference> {
    // Create a QueryBuilder for the user to configure
    const queryBuilder = new QueryBuilder<Occ>({
      occurrence: this.table,
      databaseName: this.databaseName,
      context: this.context,
    });

    // Let the user configure it
    const configuredBuilder = fn(queryBuilder);

    return new ExecutableUpdateBuilder<Occ, true, ReturnPreference>({
      occurrence: this.table,
      databaseName: this.databaseName,
      context: this.context,
      data: this.data,
      mode: "byFilter",
      queryBuilder: configuredBuilder,
      returnPreference: this.returnPreference,
      databaseUseEntityIds: this.databaseUseEntityIds,
    });
  }
}

/**
 * Executable update builder - has execute() method
 * Returned after calling .byId() or .where()
 * Can return either updated count or full record based on returnFullRecord option
 */
export class ExecutableUpdateBuilder<
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  Occ extends FMTable<any, any>,
  _IsByFilter extends boolean,
  ReturnPreference extends "minimal" | "representation" = "minimal",
> implements
    ExecutableBuilder<ReturnPreference extends "minimal" ? { updatedCount: number } : InferSchemaOutputFromFMTable<Occ>>
{
  private readonly databaseName: string;
  private readonly context: ExecutionContext;
  private readonly table: Occ;
  private readonly data: Partial<InferSchemaOutputFromFMTable<Occ>>;
  private readonly mode: "byId" | "byFilter";
  private readonly recordId?: string | number;
  private readonly queryBuilder?: QueryBuilder<Occ>;
  private readonly returnPreference: ReturnPreference;
  private readonly databaseUseEntityIds: boolean;

  constructor(config: {
    occurrence: Occ;
    databaseName: string;
    context: ExecutionContext;
    data: Partial<InferSchemaOutputFromFMTable<Occ>>;
    mode: "byId" | "byFilter";
    recordId?: string | number;
    queryBuilder?: QueryBuilder<Occ>;
    returnPreference: ReturnPreference;
    databaseUseEntityIds?: boolean;
  }) {
    this.table = config.occurrence;
    this.databaseName = config.databaseName;
    this.context = config.context;
    this.data = config.data;
    this.mode = config.mode;
    this.recordId = config.recordId;
    this.queryBuilder = config.queryBuilder;
    this.returnPreference = config.returnPreference;
    this.databaseUseEntityIds = config.databaseUseEntityIds ?? false;
  }

  /**
   * Helper to merge database-level useEntityIds with per-request options
   */
  private mergeExecuteOptions(
    options?: RequestInit & FFetchOptions & ExecuteOptions,
  ): RequestInit & FFetchOptions & { useEntityIds?: boolean } {
    // If useEntityIds is not set in options, use the database-level setting
    return {
      ...options,
      useEntityIds: options?.useEntityIds ?? this.databaseUseEntityIds,
    };
  }

  /**
   * Gets the table ID (FMTID) if using entity IDs, otherwise returns the table name
   * @param useEntityIds - Optional override for entity ID usage
   */
  private getTableId(useEntityIds?: boolean): string {
    const contextDefault = this.context._getUseEntityIds?.() ?? false;
    const shouldUseIds = useEntityIds ?? contextDefault;

    if (shouldUseIds) {
      if (!isUsingEntityIds(this.table)) {
        throw new Error(
          `useEntityIds is true but table "${getTableName(this.table)}" does not have entity IDs configured`,
        );
      }
      return getTableIdHelper(this.table);
    }

    return getTableName(this.table);
  }

  /**
   * Builds the URL for the update request based on mode (byId or byFilter).
   */
  private buildUrl(tableId: string): string {
    if (this.mode === "byId") {
      return `/${this.databaseName}/${tableId}('${this.recordId}')`;
    }

    if (!this.queryBuilder) {
      throw new Error("Query builder is required for filter-based update");
    }

    const queryString = this.queryBuilder.getQueryString();
    const tableName = getTableName(this.table);
    let queryParams: string;
    if (queryString.startsWith(`/${tableId}`)) {
      queryParams = queryString.slice(`/${tableId}`.length);
    } else if (queryString.startsWith(`/${tableName}`)) {
      queryParams = queryString.slice(`/${tableName}`.length);
    } else {
      queryParams = queryString;
    }

    return `/${this.databaseName}/${tableId}${queryParams}`;
  }

  async execute(
    options?: ExecuteMethodOptions<ExecuteOptions>,
  ): Promise<
    Result<ReturnPreference extends "minimal" ? { updatedCount: number } : InferSchemaOutputFromFMTable<Occ>>
  > {
    const mergedOptions = this.mergeExecuteOptions(options);
    const tableId = this.getTableId(mergedOptions.useEntityIds);
    const shouldUseIds = mergedOptions.useEntityIds ?? false;
    const url = this.buildUrl(tableId);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.returnPreference === "representation") {
      headers.Prefer = "return=representation";
    }

    const pipeline = Effect.gen(this, function* () {
      // Step 1: Validate input
      let validatedData = this.data;
      if (this.table) {
        const baseTableConfig = getBaseTableConfig(this.table);
        validatedData = yield* tryEffect(
          () => validateAndTransformInput(this.data, baseTableConfig.inputSchema),
          (e) => (e instanceof Error ? e : new Error(String(e))) as FMODataErrorType,
        );
      }

      // Step 2: Transform field names
      const transformedData =
        this.table && shouldUseIds ? transformFieldNamesToIds(validatedData, this.table) : validatedData;

      // Step 3: Make PATCH request
      const response = yield* makeRequestEffect(this.context, url, {
        method: "PATCH",
        headers,
        body: JSON.stringify(transformedData),
        ...mergedOptions,
      });

      // Step 4: Handle response based on return preference
      if (this.returnPreference === "representation") {
        return response;
      }

      let updatedCount = 0;
      if (typeof response === "number") {
        updatedCount = response;
      } else if (response && typeof response === "object") {
        // biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
        updatedCount = (response as any).updatedCount || 0;
      }
      return { updatedCount };
    });

    return (await runAsResult(
      withSpan(pipeline, "fmodata.update", { "fmodata.table": getTableName(this.table) }),
    )) as Result<ReturnPreference extends "minimal" ? { updatedCount: number } : InferSchemaOutputFromFMTable<Occ>>;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Request body can be any JSON-serializable value
  getRequestConfig(): { method: string; url: string; body?: any } {
    // For batch operations, use database-level setting (no per-request override available here)
    // Note: Input validation happens in execute() and processResponse() for batch operations
    const tableId = this.getTableId(this.databaseUseEntityIds);

    // Transform field names to FMFIDs if using entity IDs
    const transformedData =
      this.table && this.databaseUseEntityIds ? transformFieldNamesToIds(this.data, this.table) : this.data;

    let url: string;

    if (this.mode === "byId") {
      url = `/${this.databaseName}/${tableId}('${this.recordId}')`;
    } else {
      if (!this.queryBuilder) {
        throw new Error("Query builder is required for filter-based update");
      }

      const queryString = this.queryBuilder.getQueryString();
      const tableName = getTableName(this.table);
      let queryParams: string;
      if (queryString.startsWith(`/${tableId}`)) {
        queryParams = queryString.slice(`/${tableId}`.length);
      } else if (queryString.startsWith(`/${tableName}`)) {
        queryParams = queryString.slice(`/${tableName}`.length);
      } else {
        queryParams = queryString;
      }

      url = `/${this.databaseName}/${tableId}${queryParams}`;
    }

    return {
      method: "PATCH",
      url,
      body: JSON.stringify(transformedData),
    };
  }

  toRequest(baseUrl: string, options?: ExecuteOptions): Request {
    const config = this.getRequestConfig();
    const fullUrl = `${baseUrl}${config.url}`;

    return new Request(fullUrl, {
      method: config.method,
      headers: {
        "Content-Type": "application/json",
        Accept: getAcceptHeader(options?.includeODataAnnotations),
      },
      body: config.body,
    });
  }

  async processResponse(
    response: Response,
    _options?: ExecuteOptions,
  ): Promise<
    Result<ReturnPreference extends "minimal" ? { updatedCount: number } : InferSchemaOutputFromFMTable<Occ>>
  > {
    // Check for error responses (important for batch operations)
    if (!response.ok) {
      const tableName = getTableName(this.table);
      const error = await parseErrorResponse(response, response.url || `/${this.databaseName}/${tableName}`);
      return { data: undefined, error };
    }

    // Check for empty response (204 No Content)
    const text = await response.text();
    if (!text || text.trim() === "") {
      // For 204 No Content, check the fmodata.affected_rows header
      const affectedRows = response.headers.get("fmodata.affected_rows");
      const updatedCount = affectedRows ? Number.parseInt(affectedRows, 10) : 1;
      return {
        data: { updatedCount } as ReturnPreference extends "minimal"
          ? { updatedCount: number }
          : InferSchemaOutputFromFMTable<Occ>,
        error: undefined,
      };
    }

    const rawResponse = JSON.parse(text);

    // Validate and transform input data using input validators (writeValidators)
    // This is needed for processResponse because it's called from batch operations
    // where the data hasn't been validated yet
    let _validatedData = this.data;
    if (this.table) {
      const baseTableConfig = getBaseTableConfig(this.table);
      const inputSchema = baseTableConfig.inputSchema;
      try {
        _validatedData = await validateAndTransformInput(this.data, inputSchema);
      } catch (error) {
        return {
          data: undefined,
          error: error instanceof Error ? error : new Error(String(error)),
          // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
        } as any;
      }
    }

    // Handle based on return preference
    if (this.returnPreference === "representation") {
      // Return the full updated record
      return {
        data: rawResponse as ReturnPreference extends "minimal"
          ? { updatedCount: number }
          : InferSchemaOutputFromFMTable<Occ>,
        error: undefined,
      };
    }
    // Return updated count (minimal)
    let updatedCount = 0;

    if (typeof rawResponse === "number") {
      updatedCount = rawResponse;
    } else if (rawResponse && typeof rawResponse === "object") {
      // Check if the response has a count property (fallback)
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
      updatedCount = (rawResponse as any).updatedCount || 0;
    }

    return {
      data: { updatedCount } as ReturnPreference extends "minimal"
        ? { updatedCount: number }
        : InferSchemaOutputFromFMTable<Occ>,
      error: undefined,
    };
  }
}
