import type { FFetchOptions } from "@fetchkit/ffetch";
import { Effect } from "effect";
import { makeRequestEffect, runAsResult, withSpan } from "../effect";
import type { FMTable } from "../orm/table";
import { getTableId as getTableIdHelper, getTableName, isUsingEntityIds } from "../orm/table";
import type { ExecutableBuilder, ExecuteMethodOptions, ExecuteOptions, ExecutionContext, Result } from "../types";
import { getAcceptHeader } from "../types";
import { parseErrorResponse } from "./error-parser";
import { QueryBuilder } from "./query-builder";

/**
 * Initial delete builder returned from EntitySet.delete()
 * Requires calling .byId() or .where() before .execute() is available
 */
// biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
export class DeleteBuilder<Occ extends FMTable<any, any>> {
  private readonly databaseName: string;
  private readonly context: ExecutionContext;
  private readonly table: Occ;
  private readonly databaseUseEntityIds: boolean;
  private readonly databaseIncludeSpecialColumns: boolean;

  constructor(config: {
    occurrence: Occ;
    databaseName: string;
    context: ExecutionContext;
    databaseUseEntityIds?: boolean;
    databaseIncludeSpecialColumns?: boolean;
  }) {
    this.table = config.occurrence;
    this.databaseName = config.databaseName;
    this.context = config.context;
    this.databaseUseEntityIds = config.databaseUseEntityIds ?? false;
    this.databaseIncludeSpecialColumns = config.databaseIncludeSpecialColumns ?? false;
  }

  /**
   * Delete a single record by ID
   */
  byId(id: string | number): ExecutableDeleteBuilder<Occ> {
    return new ExecutableDeleteBuilder<Occ>({
      occurrence: this.table,
      databaseName: this.databaseName,
      context: this.context,
      mode: "byId",
      recordId: id,
      databaseUseEntityIds: this.databaseUseEntityIds,
    });
  }

  /**
   * Delete records matching a filter query
   * @param fn Callback that receives a QueryBuilder for building the filter
   */
  where(fn: (q: QueryBuilder<Occ>) => QueryBuilder<Occ>): ExecutableDeleteBuilder<Occ> {
    // Create a QueryBuilder for the user to configure
    const queryBuilder = new QueryBuilder<Occ>({
      occurrence: this.table,
      databaseName: this.databaseName,
      context: this.context,
    });

    // Let the user configure it
    const configuredBuilder = fn(queryBuilder);

    return new ExecutableDeleteBuilder<Occ>({
      occurrence: this.table,
      databaseName: this.databaseName,
      context: this.context,
      mode: "byFilter",
      queryBuilder: configuredBuilder,
      databaseUseEntityIds: this.databaseUseEntityIds,
    });
  }
}

/**
 * Executable delete builder - has execute() method
 * Returned after calling .byId() or .where()
 */
// biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
export class ExecutableDeleteBuilder<Occ extends FMTable<any, any>>
  implements ExecutableBuilder<{ deletedCount: number }>
{
  private readonly databaseName: string;
  private readonly context: ExecutionContext;
  private readonly table: Occ;
  private readonly mode: "byId" | "byFilter";
  private readonly recordId?: string | number;
  private readonly queryBuilder?: QueryBuilder<Occ>;
  private readonly databaseUseEntityIds: boolean;

  constructor(config: {
    occurrence: Occ;
    databaseName: string;
    context: ExecutionContext;
    mode: "byId" | "byFilter";
    recordId?: string | number;
    queryBuilder?: QueryBuilder<Occ>;
    databaseUseEntityIds?: boolean;
  }) {
    this.table = config.occurrence;
    this.databaseName = config.databaseName;
    this.context = config.context;
    this.mode = config.mode;
    this.recordId = config.recordId;
    this.queryBuilder = config.queryBuilder;
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
   * Builds the URL for the delete request based on mode (byId or byFilter).
   */
  private formatRecordIdForOData(recordId: string | number): string {
    if (typeof recordId === "number") {
      return String(recordId);
    }
    return `'${recordId}'`;
  }

  private buildUrl(tableId: string): string {
    if (this.mode === "byId") {
      return `/${this.databaseName}/${tableId}(${this.formatRecordIdForOData(this.recordId as string | number)})`;
    }

    if (!this.queryBuilder) {
      throw new Error("Query builder is required for filter-based delete");
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

  async execute(options?: ExecuteMethodOptions<ExecuteOptions>): Promise<Result<{ deletedCount: number }>> {
    const mergedOptions = this.mergeExecuteOptions(options);
    const tableId = this.getTableId(mergedOptions.useEntityIds);
    const url = this.buildUrl(tableId);

    const pipeline = Effect.gen(this, function* () {
      // Make DELETE request
      const response = yield* makeRequestEffect(this.context, url, {
        ...mergedOptions,
        method: "DELETE",
      });

      // Extract deleted count from response
      let deletedCount = 0;
      if (typeof response === "number") {
        deletedCount = response;
      } else if (response && typeof response === "object") {
        // biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
        deletedCount = (response as any).deletedCount || 0;
      }

      return { deletedCount };
    });

    return await runAsResult(withSpan(pipeline, "fmodata.delete", { "fmodata.table": getTableName(this.table) }));
  }

  // biome-ignore lint/suspicious/noExplicitAny: Request body can be any JSON-serializable value
  getRequestConfig(): { method: string; url: string; body?: any } {
    // For batch operations, use database-level setting (no per-request override available here)
    const tableId = this.getTableId(this.databaseUseEntityIds);
    const url = this.buildUrl(tableId);

    return {
      method: "DELETE",
      url,
    };
  }

  toRequest(baseUrl: string, options?: ExecuteOptions): Request {
    const config = this.getRequestConfig();
    const fullUrl = `${baseUrl}${config.url}`;

    return new Request(fullUrl, {
      method: config.method,
      headers: {
        Accept: getAcceptHeader(options?.includeODataAnnotations),
      },
    });
  }

  async processResponse(response: Response, _options?: ExecuteOptions): Promise<Result<{ deletedCount: number }>> {
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
      const deletedCount = affectedRows ? Number.parseInt(affectedRows, 10) : 0;
      return { data: { deletedCount }, error: undefined };
    }

    const rawResponse = JSON.parse(text);

    // OData returns 204 No Content with fmodata.affected_rows header
    // The _makeRequest should handle extracting the header value
    // For now, we'll check if response contains the count
    let deletedCount = 0;

    if (typeof rawResponse === "number") {
      deletedCount = rawResponse;
    } else if (rawResponse && typeof rawResponse === "object") {
      // Check if the response has a count property (fallback)
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
      deletedCount = (rawResponse as any).deletedCount || 0;
    }

    return { data: { deletedCount }, error: undefined };
  }
}
