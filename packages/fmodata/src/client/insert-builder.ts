import type { FFetchOptions } from "@fetchkit/ffetch";
import { Effect } from "effect";
import { fromValidation, requestFromService, runLayerResult, tryEffect } from "../effect";
import type { FMODataErrorType } from "../errors";
import { BuilderInvariantError, InvalidLocationHeaderError } from "../errors";
import type { FMTable } from "../orm/table";
import { getBaseTableConfig, getTableName } from "../orm/table";
import type { FMODataLayer, ODataConfig } from "../services";
import { transformFieldNamesToIds, transformResponseFields } from "../transform";
import type {
  ConditionallyWithODataAnnotations,
  ConditionallyWithSpecialColumns,
  ExecutableBuilder,
  ExecuteMethodOptions,
  ExecuteOptions,
  NormalizeIncludeSpecialColumns,
  Result,
} from "../types";
import { getAcceptHeader } from "../types";
import { validateAndTransformInput, validateSingleResponse } from "../validation";
import {
  getLocationHeader,
  mergeMutationExecuteOptions,
  mergePreferHeaderValues,
  parseRowIdFromLocationHeader,
  resolveMutationTableId,
} from "./builders/mutation-helpers";
import { parseErrorResponse } from "./error-parser";
import { createClientRuntime } from "./runtime";
import { safeJsonParse } from "./sanitize-json";

export interface InsertOptions {
  return?: "minimal" | "representation";
}

import type { InferSchemaOutputFromFMTable } from "../orm/table";

export class InsertBuilder<
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  Occ extends FMTable<any, any> | undefined = undefined,
  ReturnPreference extends "minimal" | "representation" = "representation",
  DatabaseIncludeSpecialColumns extends boolean = false,
> implements
    ExecutableBuilder<
      ReturnPreference extends "minimal"
        ? { ROWID: number }
        : ConditionallyWithSpecialColumns<
            InferSchemaOutputFromFMTable<NonNullable<Occ>>,
            DatabaseIncludeSpecialColumns,
            false
          >
    >
{
  private readonly table?: Occ;
  private readonly data: Partial<InferSchemaOutputFromFMTable<NonNullable<Occ>>>;
  private readonly returnPreference: ReturnPreference;
  private readonly layer: FMODataLayer;
  private readonly config: ODataConfig;

  constructor(config: {
    occurrence?: Occ;
    layer: FMODataLayer;
    data: Partial<InferSchemaOutputFromFMTable<NonNullable<Occ>>>;
    returnPreference?: ReturnPreference;
  }) {
    this.table = config.occurrence;
    this.layer = config.layer;
    this.data = config.data;
    this.returnPreference = (config.returnPreference || "representation") as ReturnPreference;
    // Extract config from layer for sync method access
    const runtime = createClientRuntime(this.layer);
    this.config = runtime.config;
  }

  /**
   * Helper to merge database-level useEntityIds with per-request options
   */
  private mergeExecuteOptions(
    options?: RequestInit & FFetchOptions & ExecuteOptions,
  ): RequestInit & FFetchOptions & { useEntityIds?: boolean; includeSpecialColumns?: boolean } {
    return mergeMutationExecuteOptions(options, this.config.useEntityIds, this.config.includeSpecialColumns);
  }

  /**
   * Parse ROWID from Location header
   * Expected formats:
   * - contacts(ROWID=4583)
   * - contacts('some-uuid')
   */
  private parseLocationHeader(locationHeader: string | undefined): number {
    return parseRowIdFromLocationHeader(locationHeader);
  }

  /**
   * Gets the table ID (FMTID) if using entity IDs, otherwise returns the table name
   * @param useEntityIds - Optional override for entity ID usage
   */
  private getTableId(useEntityIds?: boolean): string {
    if (!this.table) {
      throw new BuilderInvariantError("InsertBuilder", "table occurrence is required");
    }
    return resolveMutationTableId(this.table, useEntityIds ?? this.config.useEntityIds, "InsertBuilder");
  }

  /**
   * Builds the schema for validation, excluding container fields.
   */
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic schema shape from table configuration
  private getValidationSchema(): Record<string, any> | undefined {
    if (!this.table) {
      return undefined;
    }
    const baseTableConfig = getBaseTableConfig(this.table);
    const containerFields = baseTableConfig.containerFields || [];
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic schema shape from table configuration
    const schema: Record<string, any> = { ...baseTableConfig.schema };
    for (const containerField of containerFields) {
      delete schema[containerField as string];
    }
    return schema;
  }

  execute<EO extends ExecuteOptions>(
    options?: ExecuteMethodOptions<EO>,
  ): Promise<
    Result<
      ReturnPreference extends "minimal"
        ? { ROWID: number }
        : ConditionallyWithODataAnnotations<
            ConditionallyWithSpecialColumns<
              InferSchemaOutputFromFMTable<NonNullable<Occ>>,
              NormalizeIncludeSpecialColumns<EO["includeSpecialColumns"], DatabaseIncludeSpecialColumns>,
              false
            >,
            EO["includeODataAnnotations"] extends true ? true : false
          >
    >
  > {
    const mergedOptions = this.mergeExecuteOptions(options);
    // Prevent caller options from overriding required request shape
    // biome-ignore lint/suspicious/noExplicitAny: Execute options include dynamic fetch fields
    const { method: _method, headers: callerHeaders, body: _body, ...requestOptions } = mergedOptions as any;
    const tableId = this.getTableId(mergedOptions.useEntityIds);
    const url = `/${this.config.databaseName}/${tableId}`;
    const shouldUseIds = mergedOptions.useEntityIds ?? this.config.useEntityIds;
    const includeSpecialColumns = mergedOptions.includeSpecialColumns ?? this.config.includeSpecialColumns;
    const canonicalHeaders = new Headers(callerHeaders || {});
    const preferHeader = mergePreferHeaderValues(
      this.returnPreference === "minimal" ? "return=minimal" : "return=representation",
      shouldUseIds ? "fmodata.entity-ids" : undefined,
      includeSpecialColumns ? "fmodata.include-specialcolumns" : undefined,
      canonicalHeaders.get("Prefer") ?? undefined,
    );
    canonicalHeaders.set("Content-Type", "application/json");
    if (preferHeader) {
      canonicalHeaders.set("Prefer", preferHeader);
    } else {
      canonicalHeaders.delete("Prefer");
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
              : new BuilderInvariantError("InsertBuilder.execute", String(e))) as FMODataErrorType,
        );
      }

      // Step 2: Transform field names to entity IDs if needed
      const transformedData =
        this.table && shouldUseIds ? transformFieldNamesToIds(validatedData, this.table) : validatedData;

      // Step 3: Make HTTP request via DI
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
      const responseData = yield* requestFromService<any>(url, {
        ...requestOptions,
        method: "POST",
        headers: canonicalHeaders,
        body: JSON.stringify(transformedData),
      });

      // Step 4: Handle return=minimal case
      if (this.returnPreference === "minimal") {
        if (!responseData?._location) {
          return yield* Effect.fail(
            new InvalidLocationHeaderError(
              "Location header is required when using return=minimal but was not found in response",
            ) as FMODataErrorType,
          );
        }
        const rowid = this.parseLocationHeader(responseData._location);
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
        return { ROWID: rowid } as any;
      }

      // Step 5: Transform response field IDs back to names
      let response = responseData;
      if (this.table && shouldUseIds) {
        response = transformResponseFields(response, this.table, undefined);
      }

      // Step 6: Validate response
      const schema = this.getValidationSchema();
      const validated = yield* fromValidation(() =>
        validateSingleResponse<InferSchemaOutputFromFMTable<NonNullable<Occ>>>(
          response,
          schema,
          undefined,
          undefined,
          "exact",
          includeSpecialColumns,
        ),
      );

      if (validated === null) {
        return yield* Effect.fail(
          new BuilderInvariantError(
            "InsertBuilder.execute",
            "insert operation returned null response",
          ) as FMODataErrorType,
        );
      }

      return validated;
    });

    return runLayerResult(
      this.layer,
      pipeline,
      "fmodata.insert",
      this.table ? { "fmodata.table": getTableName(this.table) } : undefined,
    ) as Promise<
      Result<
        ReturnPreference extends "minimal"
          ? { ROWID: number }
          : ConditionallyWithODataAnnotations<
              ConditionallyWithSpecialColumns<
                InferSchemaOutputFromFMTable<NonNullable<Occ>>,
                NormalizeIncludeSpecialColumns<EO["includeSpecialColumns"], DatabaseIncludeSpecialColumns>,
                false
              >,
              EO["includeODataAnnotations"] extends true ? true : false
            >
      >
    >;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Request body can be any JSON-serializable value
  getRequestConfig(): { method: string; url: string; body?: any } {
    const tableId = this.getTableId(this.config.useEntityIds);

    // Transform field names to FMFIDs if using entity IDs
    const transformedData =
      this.table && this.config.useEntityIds ? transformFieldNamesToIds(this.data, this.table) : this.data;

    return {
      method: "POST",
      url: `/${this.config.databaseName}/${tableId}`,
      body: JSON.stringify(transformedData),
    };
  }

  toRequest(baseUrl: string, options?: ExecuteOptions): Request {
    const config = this.getRequestConfig();
    const fullUrl = `${baseUrl}${config.url}`;
    const preferHeader = mergePreferHeaderValues(
      this.returnPreference === "minimal" ? "return=minimal" : "return=representation",
      (options?.useEntityIds ?? this.config.useEntityIds) ? "fmodata.entity-ids" : undefined,
      (options?.includeSpecialColumns ?? this.config.includeSpecialColumns)
        ? "fmodata.include-specialcolumns"
        : undefined,
    );

    return new Request(fullUrl, {
      method: config.method,
      headers: {
        "Content-Type": "application/json",
        Accept: getAcceptHeader(options?.includeODataAnnotations),
        ...(preferHeader ? { Prefer: preferHeader } : {}),
      },
      body: config.body,
    });
  }

  async processResponse<EO extends ExecuteOptions | undefined = undefined>(
    response: Response,
    options?: EO,
  ): Promise<
    Result<
      ReturnPreference extends "minimal"
        ? { ROWID: number }
        : ConditionallyWithSpecialColumns<
            InferSchemaOutputFromFMTable<NonNullable<Occ>>,
            NormalizeIncludeSpecialColumns<
              EO extends ExecuteOptions ? EO["includeSpecialColumns"] : undefined,
              DatabaseIncludeSpecialColumns
            >,
            false
          >
    >
  > {
    // Check for error responses (important for batch operations)
    if (!response.ok) {
      const tableName = this.table ? getTableName(this.table) : "unknown";
      const error = await parseErrorResponse(response, response.url || `/${this.config.databaseName}/${tableName}`);
      return { data: undefined, error };
    }

    // Handle 204 No Content (common in batch/changeset operations)
    // FileMaker uses return=minimal for changeset operations regardless of Prefer header
    if (response.status === 204) {
      // Check for Location header (for return=minimal)
      if (this.returnPreference === "minimal") {
        const locationHeader = getLocationHeader(response.headers);
        const rowid = locationHeader ? this.parseLocationHeader(locationHeader) : -1;
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
        return { data: { ROWID: rowid } as any, error: undefined };
      }

      // For 204 responses without return=minimal, FileMaker doesn't return the created entity
      // This is valid OData behavior for changeset operations
      // We return a success indicator but no actual data
      return {
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
        data: {} as any,
        error: undefined,
      };
    }

    // If we expected return=minimal but got a body (e.g. batch sub-responses
    // where FM returns 204-with-body, converted to 200 by parsedToResponse),
    // try to extract ROWID from the Location header or return -1.
    if (this.returnPreference === "minimal") {
      const locationHeader = getLocationHeader(response.headers);
      const rowid = locationHeader ? this.parseLocationHeader(locationHeader) : -1;
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
      return { data: { ROWID: rowid } as any, error: undefined };
    }

    // Use safeJsonParse to handle FileMaker's invalid JSON with unquoted ? values
    let rawResponse: unknown;
    try {
      rawResponse = await safeJsonParse(response);
    } catch (err) {
      // If parsing fails with 204, handle it gracefully
      if (response.status === 204) {
        return {
          // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
          data: {} as any,
          error: undefined,
        };
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
            error instanceof Error ? error : new BuilderInvariantError("InsertBuilder.processResponse", String(error)),
          // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
        } as any;
      }
    }

    // Transform response field IDs back to names if using entity IDs
    const shouldUseIds = options?.useEntityIds ?? this.config.useEntityIds;
    const includeSpecialColumns = options?.includeSpecialColumns ?? this.config.includeSpecialColumns;

    let transformedResponse = rawResponse;
    if (this.table && shouldUseIds) {
      transformedResponse = transformResponseFields(
        rawResponse,
        this.table,
        undefined, // No expand configs for insert
      );
    }

    // Get schema from table if available, excluding container fields
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic schema shape from table configuration
    let schema: Record<string, any> | undefined;
    if (this.table) {
      const baseTableConfig = getBaseTableConfig(this.table);
      const containerFields = baseTableConfig.containerFields || [];

      // Filter out container fields from schema
      schema = { ...baseTableConfig.schema };
      for (const containerField of containerFields) {
        delete schema[containerField as string];
      }
    }

    // Validate the response (FileMaker returns the created record)
    const validation = await validateSingleResponse<InferSchemaOutputFromFMTable<NonNullable<Occ>>>(
      transformedResponse,
      schema,
      undefined, // No selected fields for insert
      undefined, // No expand configs
      "exact", // Expect exactly one record
      includeSpecialColumns,
    );

    if (!validation.valid) {
      return { data: undefined, error: validation.error };
    }

    // Handle null response (shouldn't happen for insert, but handle it)
    if (validation.data === null) {
      return {
        data: undefined,
        error: new BuilderInvariantError("InsertBuilder.processResponse", "insert operation returned null response"),
      };
    }

    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
    return { data: validation.data as any, error: undefined };
  }
}
