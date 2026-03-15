import { Effect } from "effect";
import { requestFromService, runLayerResult } from "../effect";
import type { FMTable } from "../orm/table";
import { getTableName } from "../orm/table";
import type { FMODataLayer, ODataConfig } from "../services";
import type { ExecutableBuilder, ExecuteMethodOptions, ExecuteOptions, Result } from "../types";
import { getAcceptHeader } from "../types";
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
 * Initial delete builder returned from EntitySet.delete()
 * Requires calling .byId() or .where() before .execute() is available
 */
// biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
export class DeleteBuilder<Occ extends FMTable<any, any>> {
  private readonly table: Occ;
  private readonly layer: FMODataLayer;
  private readonly config: ODataConfig;

  constructor(config: {
    occurrence: Occ;
    layer: FMODataLayer;
  }) {
    this.table = config.occurrence;
    const runtime = createClientRuntime(config.layer);
    this.layer = runtime.layer;
    this.config = runtime.config;
  }

  /**
   * Delete a single record by ID
   */
  byId(id: string | number): ExecutableDeleteBuilder<Occ> {
    return new ExecutableDeleteBuilder<Occ>({
      occurrence: this.table,
      layer: this.layer,
      mode: "byId",
      recordId: id,
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
      layer: this.layer,
    });

    // Let the user configure it
    const configuredBuilder = fn(queryBuilder);

    return new ExecutableDeleteBuilder<Occ>({
      occurrence: this.table,
      layer: this.layer,
      mode: "byFilter",
      queryBuilder: configuredBuilder,
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
  private readonly table: Occ;
  private readonly mode: "byId" | "byFilter";
  private readonly recordId?: string | number;
  private readonly queryBuilder?: QueryBuilder<Occ>;
  private readonly layer: FMODataLayer;
  private readonly config: ODataConfig;

  constructor(config: {
    occurrence: Occ;
    layer: FMODataLayer;
    mode: "byId" | "byFilter";
    recordId?: string | number;
    queryBuilder?: QueryBuilder<Occ>;
  }) {
    this.table = config.occurrence;
    this.layer = config.layer;
    this.mode = config.mode;
    this.recordId = config.recordId;
    this.queryBuilder = config.queryBuilder;
    this.config = createClientRuntime(this.layer).config;
  }

  execute(options?: ExecuteMethodOptions<ExecuteOptions>): Promise<Result<{ deletedCount: number }>> {
    const mergedOptions = mergeMutationExecuteOptions(options, this.config.useEntityIds);
    // biome-ignore lint/suspicious/noExplicitAny: Execute options include dynamic fetch fields
    const { method: _method, body: _body, ...requestOptions } = mergedOptions as any;
    const useEntityIds = mergedOptions.useEntityIds ?? this.config.useEntityIds;
    const tableId = resolveMutationTableId(this.table, useEntityIds, "ExecutableDeleteBuilder");
    const url = buildMutationUrl({
      databaseName: this.config.databaseName,
      tableId,
      tableName: getTableName(this.table),
      mode: this.mode,
      recordId: this.recordId,
      queryBuilder: this.queryBuilder,
      useEntityIds,
      builderName: "ExecutableDeleteBuilder",
    });

    const pipeline = Effect.gen(this, function* () {
      // Make DELETE request via DI
      const response = yield* requestFromService(url, {
        ...requestOptions,
        method: "DELETE",
      });

      const deletedCount = extractAffectedRows(response, undefined, 0, "deletedCount");
      return { deletedCount };
    });

    return runLayerResult(this.layer, pipeline, "fmodata.delete", {
      "fmodata.table": getTableName(this.table),
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: Request body can be any JSON-serializable value
  getRequestConfig(): { method: string; url: string; body?: any } {
    const tableId = resolveMutationTableId(this.table, this.config.useEntityIds, "ExecutableDeleteBuilder");
    const url = buildMutationUrl({
      databaseName: this.config.databaseName,
      tableId,
      tableName: getTableName(this.table),
      mode: this.mode,
      recordId: this.recordId,
      queryBuilder: this.queryBuilder,
      useEntityIds: this.config.useEntityIds,
      builderName: "ExecutableDeleteBuilder",
    });

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
      const error = await parseErrorResponse(response, response.url || `/${this.config.databaseName}/${tableName}`);
      return { data: undefined, error };
    }

    // Check for empty response (204 No Content)
    const text = await response.text();
    if (!text || text.trim() === "") {
      const deletedCount = extractAffectedRows(undefined, response.headers, 1, "deletedCount");
      return { data: { deletedCount }, error: undefined };
    }

    const rawResponse = JSON.parse(text);

    const deletedCount = extractAffectedRows(rawResponse, response.headers, 0, "deletedCount");

    return { data: { deletedCount }, error: undefined };
  }
}
