import type { FFetchOptions } from "@fetchkit/ffetch";
import { Effect } from "effect";
import { fromValidation, requestFromService, runAsResult, tryEffect, withSpan } from "../effect";
import type { FMODataErrorType } from "../errors";
import { InvalidLocationHeaderError } from "../errors";
import type { InternalLogger } from "../logger";
import type { FMTable } from "../orm/table";
import { getBaseTableConfig, getTableId as getTableIdHelper, getTableName, isUsingEntityIds } from "../orm/table";
import { extractConfigFromLayer, type FMODataLayer, type ODataConfig } from "../services";
import { transformFieldNamesToIds, transformResponseFields } from "../transform";
import type {
  ConditionallyWithODataAnnotations,
  ExecutableBuilder,
  ExecuteMethodOptions,
  ExecuteOptions,
  Result,
} from "../types";
import { getAcceptHeader } from "../types";
import { validateAndTransformInput, validateSingleResponse } from "../validation";
import { parseErrorResponse } from "./error-parser";
import { safeJsonParse } from "./sanitize-json";

const ROWID_MATCH_REGEX = /ROWID=(\d+)/;
const PAREN_VALUE_REGEX = /\(['"]?([^'"]+)['"]?\)/;

export interface InsertOptions {
  return?: "minimal" | "representation";
}

import type { InferSchemaOutputFromFMTable } from "../orm/table";

export class InsertBuilder<
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  Occ extends FMTable<any, any> | undefined = undefined,
  ReturnPreference extends "minimal" | "representation" = "representation",
> implements
    ExecutableBuilder<
      ReturnPreference extends "minimal" ? { ROWID: number } : InferSchemaOutputFromFMTable<NonNullable<Occ>>
    >
{
  private readonly table?: Occ;
  private readonly data: Partial<InferSchemaOutputFromFMTable<NonNullable<Occ>>>;
  private readonly returnPreference: ReturnPreference;
  private readonly layer: FMODataLayer;
  private readonly config: ODataConfig;
  private readonly logger: InternalLogger;

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
    const extracted = extractConfigFromLayer(this.layer);
    this.config = extracted.config;
    this.logger = extracted.logger;
  }

  /**
   * Helper to merge database-level useEntityIds with per-request options
   */
  private mergeExecuteOptions(
    options?: RequestInit & FFetchOptions & ExecuteOptions,
  ): RequestInit & FFetchOptions & { useEntityIds?: boolean } {
    return {
      ...options,
      useEntityIds: options?.useEntityIds ?? this.config.useEntityIds,
    };
  }

  /**
   * Parse ROWID from Location header
   * Expected formats:
   * - contacts(ROWID=4583)
   * - contacts('some-uuid')
   */
  private parseLocationHeader(locationHeader: string | undefined): number {
    if (!locationHeader) {
      throw new InvalidLocationHeaderError("Location header is required but was not provided");
    }

    // Try to match ROWID=number pattern
    const rowidMatch = locationHeader.match(ROWID_MATCH_REGEX);
    if (rowidMatch?.[1]) {
      return Number.parseInt(rowidMatch[1], 10);
    }

    // Try to extract value from parentheses and parse as number
    const parenMatch = locationHeader.match(PAREN_VALUE_REGEX);
    if (parenMatch?.[1]) {
      const value = parenMatch[1];
      const numValue = Number.parseInt(value, 10);
      if (!Number.isNaN(numValue)) {
        return numValue;
      }
    }

    throw new InvalidLocationHeaderError(
      `Could not extract ROWID from Location header: ${locationHeader}`,
      locationHeader,
    );
  }

  /**
   * Gets the table ID (FMTID) if using entity IDs, otherwise returns the table name
   * @param useEntityIds - Optional override for entity ID usage
   */
  private getTableId(useEntityIds?: boolean): string {
    if (!this.table) {
      throw new Error("Table occurrence is required");
    }

    const shouldUseIds = useEntityIds ?? this.config.useEntityIds;

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
            InferSchemaOutputFromFMTable<NonNullable<Occ>>,
            EO["includeODataAnnotations"] extends true ? true : false
          >
    >
  > {
    const mergedOptions = this.mergeExecuteOptions(options);
    const tableId = this.getTableId(mergedOptions.useEntityIds);
    const url = `/${this.config.databaseName}/${tableId}`;
    const shouldUseIds = mergedOptions.useEntityIds ?? false;
    const preferHeader = this.returnPreference === "minimal" ? "return=minimal" : "return=representation";

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

      // Step 2: Transform field names to entity IDs if needed
      const transformedData =
        this.table && shouldUseIds ? transformFieldNamesToIds(validatedData, this.table) : validatedData;

      // Step 3: Make HTTP request via DI
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
      const responseData = yield* requestFromService<any>(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: preferHeader,
          // biome-ignore lint/suspicious/noExplicitAny: Type assertion for headers object
          ...((mergedOptions as any)?.headers || {}),
        },
        body: JSON.stringify(transformedData),
        ...mergedOptions,
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
        ),
      );

      if (validated === null) {
        return yield* Effect.fail(new Error("Insert operation returned null response") as FMODataErrorType);
      }

      return validated;
    });

    return runAsResult(
      Effect.provide(
        withSpan(pipeline, "fmodata.insert", this.table ? { "fmodata.table": getTableName(this.table) } : undefined),
        this.layer,
      ),
    ) as Promise<
      Result<
        ReturnPreference extends "minimal"
          ? { ROWID: number }
          : ConditionallyWithODataAnnotations<
              InferSchemaOutputFromFMTable<NonNullable<Occ>>,
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

    // Set Prefer header based on return preference
    const preferHeader = this.returnPreference === "minimal" ? "return=minimal" : "return=representation";

    return new Request(fullUrl, {
      method: config.method,
      headers: {
        "Content-Type": "application/json",
        Accept: getAcceptHeader(options?.includeODataAnnotations),
        Prefer: preferHeader,
      },
      body: config.body,
    });
  }

  async processResponse(
    response: Response,
    options?: ExecuteOptions,
  ): Promise<
    Result<ReturnPreference extends "minimal" ? { ROWID: number } : InferSchemaOutputFromFMTable<NonNullable<Occ>>>
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
        const locationHeader = response.headers.get("Location") || response.headers.get("location");
        if (locationHeader) {
          const rowid = this.parseLocationHeader(locationHeader);
          // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
          return { data: { ROWID: rowid } as any, error: undefined };
        }
        throw new InvalidLocationHeaderError(
          "Location header is required when using return=minimal but was not found in response",
        );
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

    // If we expected return=minimal but got a body, that's unexpected
    if (this.returnPreference === "minimal") {
      throw new InvalidLocationHeaderError(
        "Expected 204 No Content for return=minimal, but received response with body",
      );
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
          error: error instanceof Error ? error : new Error(String(error)),
          // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
        } as any;
      }
    }

    // Transform response field IDs back to names if using entity IDs
    const shouldUseIds = options?.useEntityIds ?? this.config.useEntityIds;

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
    );

    if (!validation.valid) {
      return { data: undefined, error: validation.error };
    }

    // Handle null response (shouldn't happen for insert, but handle it)
    if (validation.data === null) {
      return {
        data: undefined,
        error: new Error("Insert operation returned null response"),
      };
    }

    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic return type
    return { data: validation.data as any, error: undefined };
  }
}
