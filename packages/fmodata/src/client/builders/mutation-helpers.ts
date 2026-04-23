import type { FFetchOptions } from "@fetchkit/ffetch";
import { BuilderInvariantError, InvalidLocationHeaderError } from "../../errors";
import type { FMTable } from "../../orm/table";
import { getTableName } from "../../orm/table";
import type { ExecuteOptions } from "../../types";
import { resolveTableId } from "./table-utils";

const ROWID_MATCH_REGEX = /ROWID=(\d+)/;
const PAREN_VALUE_REGEX = /\(['"]?([^'"]+)['"]?\)/;

type MutationMode = "byId" | "byFilter";

export interface FilterQueryBuilder {
  getQueryString(options?: { useEntityIds?: boolean }): string;
}

export function mergeMutationExecuteOptions(
  options: (RequestInit & FFetchOptions & ExecuteOptions) | undefined,
  databaseUseEntityIds: boolean,
  databaseIncludeSpecialColumns: boolean,
): RequestInit & FFetchOptions & { useEntityIds?: boolean; includeSpecialColumns?: boolean } {
  return {
    ...options,
    useEntityIds: options?.useEntityIds ?? databaseUseEntityIds,
    includeSpecialColumns: options?.includeSpecialColumns ?? databaseIncludeSpecialColumns,
  };
}

export function mergePreferHeaderValues(...values: Array<string | undefined>): string | undefined {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    for (const part of value.split(",")) {
      const normalized = part.trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      merged.push(normalized);
    }
  }

  return merged.length > 0 ? merged.join(", ") : undefined;
}

export function resolveMutationTableId(
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  table: FMTable<any, any> | undefined,
  useEntityIds: boolean,
  builderName: string,
): string {
  if (!table) {
    throw new BuilderInvariantError(builderName, "table occurrence is required");
  }
  return resolveTableId(table, getTableName(table), useEntityIds);
}

export function buildMutationUrl(config: {
  databaseName: string;
  tableId: string;
  tableName: string;
  mode: MutationMode;
  recordId?: string | number;
  queryBuilder?: FilterQueryBuilder;
  useEntityIds?: boolean;
  builderName: string;
}): string {
  const { databaseName, tableId, tableName, mode, recordId, queryBuilder, useEntityIds, builderName } = config;

  if (mode === "byId") {
    if (recordId === undefined || recordId === null || recordId === "") {
      throw new BuilderInvariantError(builderName, "recordId is required for byId mode");
    }
    return `/${databaseName}/${tableId}('${recordId}')`;
  }

  if (!queryBuilder) {
    throw new BuilderInvariantError(builderName, "query builder is required for filter mode");
  }

  const queryString = queryBuilder.getQueryString({ useEntityIds });
  const queryParams = stripTablePathPrefix(queryString, tableId, tableName);
  return `/${databaseName}/${tableId}${queryParams}`;
}

export function stripTablePathPrefix(queryString: string, tableId: string, tableName: string): string {
  if (queryString.startsWith(`/${tableId}`)) {
    return queryString.slice(`/${tableId}`.length);
  }
  if (queryString.startsWith(`/${tableName}`)) {
    return queryString.slice(`/${tableName}`.length);
  }
  return queryString;
}

export function extractAffectedRows(
  response: unknown,
  headers?: Pick<Headers, "get">,
  fallback = 0,
  countKey?: "updatedCount" | "deletedCount",
): number {
  const headerValue = headers?.get("fmodata.affected_rows");
  if (headerValue) {
    const parsed = Number.parseInt(headerValue, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  if (typeof response === "number") {
    return response;
  }

  if (response && typeof response === "object") {
    if (countKey && countKey in response) {
      const count = Number((response as Record<string, unknown>)[countKey]);
      if (!Number.isNaN(count)) {
        return count;
      }
    }

    const affected = Number((response as Record<string, unknown>)["fmodata.affected_rows"]);
    if (!Number.isNaN(affected)) {
      return affected;
    }
  }

  return fallback;
}

/**
 * Parse ROWID from Location header.
 * Expected formats:
 * - contacts(ROWID=4583)
 * - contacts('4583')
 */
export function parseRowIdFromLocationHeader(locationHeader: string | undefined): number {
  if (!locationHeader) {
    throw new InvalidLocationHeaderError("Location header is required but was not provided");
  }

  const rowidMatch = locationHeader.match(ROWID_MATCH_REGEX);
  if (rowidMatch?.[1]) {
    return Number.parseInt(rowidMatch[1], 10);
  }

  const parenMatch = locationHeader.match(PAREN_VALUE_REGEX);
  if (parenMatch?.[1]) {
    const value = Number.parseInt(parenMatch[1], 10);
    if (!Number.isNaN(value)) {
      return value;
    }
  }

  throw new InvalidLocationHeaderError(
    `Could not extract ROWID from Location header: ${locationHeader}`,
    locationHeader,
  );
}

export function getLocationHeader(headers: Pick<Headers, "get">): string | undefined {
  return headers.get("Location") || headers.get("location") || undefined;
}
