import { RecordCountMismatchError, ResponseStructureError } from "../../errors";
import type { InternalLogger } from "../../logger";
import type { FMTable } from "../../orm/table";
import { getBaseTableConfig } from "../../orm/table";
import { transformResponseFields } from "../../transform";
import type { CountedListResult, Result } from "../../types";
import type { ExpandValidationConfig } from "../../validation";
import { validateListResponse, validateSingleResponse } from "../../validation";
import { ExpandBuilder } from "./expand-builder";
import type { ExpandConfig } from "./shared-types";

export interface ProcessResponseConfig {
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  table?: FMTable<any, any>;
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic schema shape from table configuration
  schema?: Record<string, any>;
  singleMode: "exact" | "maybe" | false;
  selectedFields?: string[];
  expandValidationConfigs?: ExpandValidationConfig[];
  skipValidation?: boolean;
  useEntityIds?: boolean;
  includeSpecialColumns?: boolean;
  // Mapping from field names to output keys (for renamed fields in select)
  fieldMapping?: Record<string, string>;
}

/**
 * Processes OData response with transformation and validation.
 * Shared by QueryBuilder and RecordBuilder.
 */
// biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
export async function processODataResponse<T>(rawResponse: any, config: ProcessResponseConfig): Promise<Result<T>> {
  const {
    table,
    schema,
    singleMode,
    selectedFields,
    expandValidationConfigs,
    skipValidation,
    useEntityIds,
    includeSpecialColumns,
    fieldMapping,
  } = config;

  // Transform field IDs back to names if using entity IDs
  let response = rawResponse;
  if (table && useEntityIds) {
    response = transformResponseFields(response, table, expandValidationConfigs);
  }

  // Fast path: skip validation
  if (skipValidation) {
    const result = extractRecords(response, singleMode);
    // Rename fields AFTER extraction (but before returning)
    if (result.data && fieldMapping && Object.keys(fieldMapping).length > 0) {
      if (result.error) {
        return { data: undefined, error: result.error } as Result<T>;
      }
      return {
        data: renameFieldsInResponse(result.data, fieldMapping) as T,
        error: undefined,
      };
    }
    return result as Result<T>;
  }

  // Validation path
  // Note: Special columns are excluded when using QueryBuilder.single() method,
  // but included for RecordBuilder.get() method (both use singleMode: "exact")
  // The exclusion is handled in QueryBuilder's processQueryResponse, not here
  if (singleMode !== false) {
    // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any record shape
    const validation = await validateSingleResponse<any>(
      response,
      schema,
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type parameter
      selectedFields as any,
      expandValidationConfigs,
      singleMode,
      includeSpecialColumns,
    );

    if (!validation.valid) {
      return { data: undefined, error: validation.error };
    }

    // Rename fields AFTER validation completes
    if (fieldMapping && Object.keys(fieldMapping).length > 0) {
      return {
        data: renameFieldsInResponse(validation.data, fieldMapping) as T,
        error: undefined,
      };
    }

    return { data: validation.data as T, error: undefined };
  }

  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any record shape
  const validation = await validateListResponse<any>(
    response,
    schema,
    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for generic type parameter
    selectedFields as any,
    expandValidationConfigs,
    includeSpecialColumns,
  );

  if (!validation.valid) {
    return { data: undefined, error: validation.error };
  }

  // Rename fields AFTER validation completes
  if (fieldMapping && Object.keys(fieldMapping).length > 0) {
    return {
      data: renameFieldsInResponse(validation.data, fieldMapping) as T,
      error: undefined,
    };
  }

  return { data: validation.data as T, error: undefined };
}

/**
 * Extracts records from response without validation.
 */
// biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
function extractRecords<T>(response: any, singleMode: "exact" | "maybe" | false): Result<T> {
  if (singleMode === false) {
    const records = response.value ?? [];
    return { data: records as T, error: undefined };
  }

  const records = response.value ?? [response];
  const count = Array.isArray(records) ? records.length : 1;

  if (count > 1) {
    return {
      data: undefined,
      error: new RecordCountMismatchError(singleMode === "exact" ? "one" : "at-most-one", count),
    };
  }

  if (count === 0) {
    if (singleMode === "exact") {
      return { data: undefined, error: new RecordCountMismatchError("one", 0) };
    }
    return { data: null as T, error: undefined };
  }

  const record = Array.isArray(records) ? records[0] : records;
  return { data: record as T, error: undefined };
}

/**
 * Gets schema from a table occurrence, excluding container fields.
 * Container fields are never returned in regular responses (only via getSingleField).
 */
// biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration, dynamic schema shape
export function getSchemaFromTable(table: FMTable<any, any> | undefined): Record<string, any> | undefined {
  if (!table) {
    return undefined;
  }
  const baseTableConfig = getBaseTableConfig(table);
  const containerFields = baseTableConfig.containerFields || [];

  // Filter out container fields from schema
  const schema = { ...baseTableConfig.schema };
  for (const containerField of containerFields) {
    delete schema[containerField as string];
  }

  return schema;
}

/**
 * Renames fields in response data according to the field mapping.
 * Used when select() is called with renamed fields (e.g., { userEmail: users.email }).
 */
// biome-ignore lint/suspicious/noExplicitAny: Dynamic response data transformation
function renameFieldsInResponse(data: any, fieldMapping: Record<string, string>): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  // Handle array responses
  if (Array.isArray(data)) {
    return data.map((item) => renameFieldsInResponse(item, fieldMapping));
  }

  // Handle OData list response structure
  if ("value" in data && Array.isArray(data.value)) {
    return {
      ...data,
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic record transformation
      value: data.value.map((item: any) => renameFieldsInResponse(item, fieldMapping)),
    };
  }

  // Handle single record
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic field transformation
  const renamed: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    // Check if this field should be renamed
    const outputKey = fieldMapping[key];
    if (outputKey) {
      renamed[outputKey] = value;
    } else {
      renamed[key] = value;
    }
  }
  return renamed;
}

/**
 * Processes query response with expand configs.
 * This is a convenience wrapper that builds validation configs from expand configs.
 */
export async function processQueryResponse<T>(
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
  response: any,
  config: {
    // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
    occurrence?: FMTable<any, any>;
    singleMode: "exact" | "maybe" | false;
    queryOptions: { select?: (keyof T)[] | string[] };
    expandConfigs: ExpandConfig[];
    skipValidation?: boolean;
    useEntityIds?: boolean;
    includeSpecialColumns?: boolean;
    includeCount?: boolean;
    // Mapping from field names to output keys (for renamed fields in select)
    fieldMapping?: Record<string, string>;
    logger: InternalLogger;
  },
  // biome-ignore lint/suspicious/noExplicitAny: Generic return type for interface compliance
): Promise<Result<any>> {
  const {
    occurrence,
    singleMode,
    queryOptions,
    expandConfigs,
    skipValidation,
    useEntityIds,
    includeSpecialColumns,
    includeCount,
    fieldMapping,
    logger,
  } = config;

  const expandBuilder = new ExpandBuilder(useEntityIds ?? false, logger);
  const expandValidationConfigs = expandBuilder.buildValidationConfigs(expandConfigs);

  let selectedFields: string[] | undefined;
  if (queryOptions.select) {
    selectedFields = Array.isArray(queryOptions.select)
      ? queryOptions.select.map(String)
      : [String(queryOptions.select)];
  }

  // Process the response first
  let processedResponse = await processODataResponse(response, {
    table: occurrence,
    schema: getSchemaFromTable(occurrence),
    singleMode,
    selectedFields,
    expandValidationConfigs,
    skipValidation,
    useEntityIds,
    includeSpecialColumns,
  });

  // Rename fields if field mapping is provided (for renamed fields in select)
  if (processedResponse.data && fieldMapping && Object.keys(fieldMapping).length > 0) {
    processedResponse = {
      ...processedResponse,
      data: renameFieldsInResponse(processedResponse.data, fieldMapping),
    };
  }

  if (includeCount) {
    if (processedResponse.error) {
      return {
        data: undefined,
        error: processedResponse.error,
      };
    }

    if (singleMode !== false) {
      return {
        data: undefined,
        error: new ResponseStructureError("list response for count-enabled query", response),
      };
    }

    const rawCount = response?.["@odata.count"];
    let parsedCount = Number.NaN;
    if (typeof rawCount === "number") {
      parsedCount = rawCount;
    } else if (typeof rawCount === "string" && rawCount.trim() !== "") {
      parsedCount = Number(rawCount);
    }

    if (!Number.isFinite(parsedCount)) {
      return {
        data: undefined,
        error: new ResponseStructureError("response with valid @odata.count", response),
      };
    }

    return {
      data: {
        records: processedResponse.data as T[],
        count: parsedCount,
      } as CountedListResult<T>,
      error: undefined,
    };
  }

  return processedResponse;
}

/**
 * Processes record response by delegating to the canonical query processor.
 * Record reads are query reads with singleMode fixed to "exact".
 */
export async function processRecordResponse<T>(
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
  response: any,
  config: {
    // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
    table?: FMTable<any, any>;
    selectedFields?: string[];
    expandConfigs: ExpandConfig[];
    skipValidation?: boolean;
    useEntityIds?: boolean;
    includeSpecialColumns?: boolean;
    fieldMapping?: Record<string, string>;
    logger: InternalLogger;
  },
): Promise<Result<T>> {
  const result = await processQueryResponse<T>(response, {
    occurrence: config.table,
    singleMode: "exact",
    queryOptions: { select: config.selectedFields },
    expandConfigs: config.expandConfigs,
    skipValidation: config.skipValidation,
    useEntityIds: config.useEntityIds,
    includeSpecialColumns: config.includeSpecialColumns,
    fieldMapping: config.fieldMapping,
    logger: config.logger,
  });

  return result as Result<T>;
}
