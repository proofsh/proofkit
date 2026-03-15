import { Effect } from "effect";
import { requestFromService, runLayerResult, tryEffect } from "../effect";
import type { FMODataErrorType } from "../errors";
import { BuilderInvariantError } from "../errors";
import type { FMTable, InferSchemaOutputFromFMTable } from "../orm/table";
import { getBaseTableConfig, getTableName } from "../orm/table";
import type { FMODataLayer, ODataConfig } from "../services";
import { transformFieldNamesToIds } from "../transform";
import type { ExecutableBuilder, ExecuteMethodOptions, ExecuteOptions, Result } from "../types";
import { getAcceptHeader } from "../types";
import { validateAndTransformInput } from "../validation";
import {
  buildMutationUrl,
  extractAffectedRows,
  mergeMutationExecuteOptions,
  resolveMutationTableId,
} from "./builders/mutation-helpers";
import { parseErrorResponse } from "./error-parser";
import { QueryBuilder } from "./query-builder";
import { createClientRuntime } from "./runtime";

/**
 * Initial update builder returned from EntitySet.update(data)
 * Requires calling .byId() or .where() before .execute() is available
 */
export class UpdateBuilder<
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  Occ extends FMTable<any, any>,
  ReturnPreference extends "minimal" | "representation" = "minimal",
> {
  private readonly table: Occ;
  private readonly data: Partial<InferSchemaOutputFromFMTable<Occ>>;
  private readonly returnPreference: ReturnPreference;
  private readonly layer: FMODataLayer;
  private readonly config: ODataConfig;

  constructor(config: {
    occurrence: Occ;
    layer: FMODataLayer;
    data: Partial<InferSchemaOutputFromFMTable<Occ>>;
    returnPreference: ReturnPreference;
  }) {
    this.table = config.occurrence;
    const runtime = createClientRuntime(config.layer);
    this.layer = runtime.layer;
    this.data = config.data;
    this.returnPreference = config.returnPreference;
    this.config = runtime.config;
  }

  /**
   * Update a single record by ID
   * Returns updated count by default, or full record if returnFullRecord was set to true
   */
  byId(id: string | number): ExecutableUpdateBuilder<Occ, true, ReturnPreference> {
    return new ExecutableUpdateBuilder<Occ, true, ReturnPreference>({
      occurrence: this.table,
      layer: this.layer,
      data: this.data,
      mode: "byId",
      recordId: id,
      returnPreference: this.returnPreference,
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
      layer: this.layer,
    });

    // Let the user configure it
    const configuredBuilder = fn(queryBuilder);

    return new ExecutableUpdateBuilder<Occ, true, ReturnPreference>({
      occurrence: this.table,
      layer: this.layer,
      data: this.data,
      mode: "byFilter",
      queryBuilder: configuredBuilder,
      returnPreference: this.returnPreference,
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
  private readonly table: Occ;
  private readonly data: Partial<InferSchemaOutputFromFMTable<Occ>>;
  private readonly mode: "byId" | "byFilter";
  private readonly recordId?: string | number;
  private readonly queryBuilder?: QueryBuilder<Occ>;
  private readonly returnPreference: ReturnPreference;
  private readonly layer: FMODataLayer;
  private readonly config: ODataConfig;

  constructor(config: {
    occurrence: Occ;
    layer: FMODataLayer;
    data: Partial<InferSchemaOutputFromFMTable<Occ>>;
    mode: "byId" | "byFilter";
    recordId?: string | number;
    queryBuilder?: QueryBuilder<Occ>;
    returnPreference: ReturnPreference;
  }) {
    this.table = config.occurrence;
    this.layer = config.layer;
    this.data = config.data;
    this.mode = config.mode;
    this.recordId = config.recordId;
    this.queryBuilder = config.queryBuilder;
    this.returnPreference = config.returnPreference;
    const runtime = createClientRuntime(this.layer);
    this.config = runtime.config;
  }

  execute(
    options?: ExecuteMethodOptions<ExecuteOptions>,
  ): Promise<
    Result<ReturnPreference extends "minimal" ? { updatedCount: number } : InferSchemaOutputFromFMTable<Occ>>
  > {
    const mergedOptions = mergeMutationExecuteOptions(options, this.config.useEntityIds);
    // biome-ignore lint/suspicious/noExplicitAny: Execute options include dynamic fetch fields
    const { method: _method, body: _body, headers: callerHeaders, ...requestOptions } = mergedOptions as any;
    const shouldUseIds = mergedOptions.useEntityIds ?? this.config.useEntityIds;
    const tableId = resolveMutationTableId(this.table, shouldUseIds, "ExecutableUpdateBuilder");
    const url = buildMutationUrl({
      databaseName: this.config.databaseName,
      tableId,
      tableName: getTableName(this.table),
      mode: this.mode,
      recordId: this.recordId,
      queryBuilder: this.queryBuilder,
      useEntityIds: shouldUseIds,
      builderName: "ExecutableUpdateBuilder",
    });

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
          (e) =>
            (e instanceof Error
              ? e
              : new BuilderInvariantError("ExecutableUpdateBuilder.execute", String(e))) as FMODataErrorType,
        );
      }

      // Step 2: Transform field names
      const transformedData =
        this.table && shouldUseIds ? transformFieldNamesToIds(validatedData, this.table) : validatedData;

      // Step 3: Make PATCH request via DI
      const requestHeaders = new Headers(callerHeaders);
      for (const [key, value] of Object.entries(headers)) {
        requestHeaders.set(key, value);
      }

      const response = yield* requestFromService(url, {
        ...requestOptions,
        method: "PATCH",
        headers: requestHeaders,
        body: JSON.stringify(transformedData),
      });

      // Step 4: Handle response based on return preference
      if (this.returnPreference === "representation") {
        return response;
      }

      const updatedCount = extractAffectedRows(response, undefined, 0, "updatedCount");
      return { updatedCount };
    });

    return runLayerResult(this.layer, pipeline, "fmodata.update", {
      "fmodata.table": getTableName(this.table),
    }) as Promise<
      Result<ReturnPreference extends "minimal" ? { updatedCount: number } : InferSchemaOutputFromFMTable<Occ>>
    >;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Request body can be any JSON-serializable value
  getRequestConfig(): { method: string; url: string; body?: any } {
    const tableId = resolveMutationTableId(this.table, this.config.useEntityIds, "ExecutableUpdateBuilder");

    // Transform field names to FMFIDs if using entity IDs
    const transformedData =
      this.table && this.config.useEntityIds ? transformFieldNamesToIds(this.data, this.table) : this.data;

    const url = buildMutationUrl({
      databaseName: this.config.databaseName,
      tableId,
      tableName: getTableName(this.table),
      mode: this.mode,
      recordId: this.recordId,
      queryBuilder: this.queryBuilder,
      useEntityIds: this.config.useEntityIds,
      builderName: "ExecutableUpdateBuilder",
    });

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
      const error = await parseErrorResponse(response, response.url || `/${this.config.databaseName}/${tableName}`);
      return { data: undefined, error };
    }

    // Check for empty response (204 No Content)
    const text = await response.text();
    if (!text || text.trim() === "") {
      const updatedCount = extractAffectedRows(undefined, response.headers, 1, "updatedCount");
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
          error:
            error instanceof Error
              ? error
              : new BuilderInvariantError("ExecutableUpdateBuilder.processResponse", String(error)),
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
    const updatedCount = extractAffectedRows(rawResponse, response.headers, 0, "updatedCount");

    return {
      data: { updatedCount } as ReturnPreference extends "minimal"
        ? { updatedCount: number }
        : InferSchemaOutputFromFMTable<Occ>,
      error: undefined,
    };
  }
}
