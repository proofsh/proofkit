import type { FFetchOptions } from "@fetchkit/ffetch";
import type { FMTable } from "../../orm/table";
import { getTableId as getTableIdHelper, getTableName, isUsingEntityIds } from "../../orm/table";
import type { ExecuteOptions } from "../../types";
import { getAcceptHeader } from "../../types";

/**
 * Resolves table identifier based on entity ID settings.
 * Used by both QueryBuilder and RecordBuilder.
 */
export function resolveTableId(
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  table: FMTable<any, any> | undefined,
  fallbackTableName: string,
  useEntityIds: boolean,
): string {
  if (!table) {
    return fallbackTableName;
  }

  if (useEntityIds) {
    if (!isUsingEntityIds(table)) {
      throw new Error(`useEntityIds is true but table "${getTableName(table)}" does not have entity IDs configured`);
    }
    return getTableIdHelper(table);
  }

  return getTableName(table);
}

/**
 * Merges database-level useEntityIds with per-request options.
 */
// biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any record shape
export function mergeEntityIdOptions<T extends Record<string, any>>(
  options: T | undefined,
  databaseDefault: boolean,
): T & { useEntityIds?: boolean } {
  return {
    ...options,
    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for optional property access
    useEntityIds: (options as any)?.useEntityIds ?? databaseDefault,
  } as T & { useEntityIds?: boolean };
}

/**
 * Type-safe helper for merging execute options with entity ID settings
 */
export function mergeExecuteOptions(
  options: (RequestInit & FFetchOptions & ExecuteOptions) | undefined,
  databaseUseEntityIds: boolean,
): RequestInit & FFetchOptions & { useEntityIds?: boolean } {
  return mergeEntityIdOptions(options, databaseUseEntityIds);
}

/**
 * Creates an OData Request object with proper headers.
 * Used by both QueryBuilder and RecordBuilder to eliminate duplication.
 *
 * @param baseUrl - Base URL for the request
 * @param config - Request configuration with method and url
 * @param options - Optional execution options
 * @returns Request object ready to use
 */
export function createODataRequest(
  baseUrl: string,
  config: { method: string; url: string },
  options?: { includeODataAnnotations?: boolean },
): Request {
  const fullUrl = `${baseUrl}${config.url}`;

  return new Request(fullUrl, {
    method: config.method,
    headers: {
      "Content-Type": "application/json",
      Accept: getAcceptHeader(options?.includeODataAnnotations),
    },
  });
}
