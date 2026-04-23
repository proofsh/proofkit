import { Effect } from "effect";
import buildQuery, { type QueryOptions } from "odata-query";
import { requestFromService, runLayerResult } from "../effect";
import type { FMODataErrorType } from "../errors";
import { BuilderInvariantError, isFMODataError, ResponseStructureError } from "../errors";
import type { FilterExpression } from "../orm/operators";
import { type FMTable, getTableName, type InferSchemaOutputFromFMTable } from "../orm/table";
import type { FMODataLayer, ODataConfig } from "../services";
import type { ExecutableBuilder, ExecuteMethodOptions, ExecuteOptions, Result } from "../types";
import { createODataRequest, mergeExecuteOptions } from "./builders/index";
import { parseErrorResponse } from "./error-parser";
import { type NavigationConfig, QueryUrlBuilder } from "./query/url-builder";
import { createClientRuntime } from "./runtime";

function normalizeCountBuildError(error: unknown): FMODataErrorType {
  if (isFMODataError(error)) {
    return error;
  }
  if (error instanceof Error) {
    return new BuilderInvariantError("CountBuilder.execute", error.message, { cause: error });
  }
  return new BuilderInvariantError("CountBuilder.execute", String(error));
}

export class CountBuilder<
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  Occ extends FMTable<any, any>,
  DatabaseIncludeSpecialColumns extends boolean = false,
> implements ExecutableBuilder<number>
{
  private readonly occurrence: Occ;
  private readonly layer: FMODataLayer;
  private readonly config: ODataConfig;
  private readonly urlBuilder: QueryUrlBuilder;
  private filterExpression?: FilterExpression;
  private readonly queryOptions: Partial<QueryOptions<InferSchemaOutputFromFMTable<Occ>>> = {};
  private navigationConfig?: NavigationConfig;

  constructor(config: {
    occurrence: Occ;
    layer: FMODataLayer;
  }) {
    this.occurrence = config.occurrence;
    const runtime = createClientRuntime(config.layer);
    this.layer = runtime.layer;
    this.config = runtime.config;
    this.urlBuilder = new QueryUrlBuilder(this.config.databaseName, this.occurrence, this.config.useEntityIds);
  }

  set navigation(navigation: NavigationConfig | undefined) {
    this.navigationConfig = navigation;
  }

  where(expression: FilterExpression | string): CountBuilder<Occ, DatabaseIncludeSpecialColumns> {
    if (typeof expression === "string") {
      this.filterExpression = undefined;
      this.queryOptions.filter = expression;
      return this;
    }

    this.filterExpression = expression;
    this.queryOptions.filter = undefined;
    return this;
  }

  private buildQueryString(useEntityIds?: boolean): string {
    const finalUseEntityIds = useEntityIds ?? this.config.useEntityIds;
    const queryOptions = { ...this.queryOptions };

    if (this.filterExpression) {
      queryOptions.filter = this.filterExpression.toODataFilter(finalUseEntityIds);
    }

    queryOptions.count = undefined;
    queryOptions.select = undefined;
    queryOptions.expand = undefined;
    queryOptions.top = undefined;
    queryOptions.skip = undefined;
    queryOptions.orderBy = undefined;

    return buildQuery(queryOptions);
  }

  private parseCountValue(raw: unknown): number | ResponseStructureError {
    let count = Number.NaN;
    if (typeof raw === "number") {
      count = raw;
    } else if (typeof raw === "string" && raw.trim() !== "") {
      count = Number(raw);
    }
    return Number.isFinite(count) ? count : new ResponseStructureError("numeric count response", raw);
  }

  execute<EO extends ExecuteOptions>(options?: ExecuteMethodOptions<EO>): Promise<Result<number>> {
    const mergedOptions = mergeExecuteOptions(options, this.config.useEntityIds);
    let queryString: string;
    let url: string;

    try {
      queryString = this.buildQueryString(mergedOptions.useEntityIds);
      url = this.urlBuilder.build(queryString, {
        isCount: true,
        useEntityIds: mergedOptions.useEntityIds,
        navigation: this.navigationConfig,
      });
    } catch (error) {
      return Promise.resolve({
        data: undefined,
        error: normalizeCountBuildError(error),
      });
    }

    const pipeline = requestFromService(url, mergedOptions).pipe(
      Effect.flatMap((data) => {
        const parsed = this.parseCountValue(data);
        return parsed instanceof ResponseStructureError ? Effect.fail(parsed) : Effect.succeed(parsed);
      }),
    );

    return runLayerResult(this.layer, pipeline, "fmodata.query.count", {
      "fmodata.table": getTableName(this.occurrence),
    });
  }

  getQueryString(options?: { useEntityIds?: boolean }): string {
    const useEntityIds = options?.useEntityIds ?? this.config.useEntityIds;
    const queryString = this.buildQueryString(useEntityIds);
    return this.urlBuilder.buildPath(queryString, {
      isCount: true,
      useEntityIds,
      navigation: this.navigationConfig,
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: Request body can be any JSON-serializable value
  getRequestConfig(): { method: string; url: string; body?: any } {
    const queryString = this.buildQueryString(this.config.useEntityIds);
    const url = this.urlBuilder.build(queryString, {
      isCount: true,
      useEntityIds: this.config.useEntityIds,
      navigation: this.navigationConfig,
    });

    return {
      method: "GET",
      url,
    };
  }

  toRequest(baseUrl: string, options?: ExecuteOptions): Request {
    const config = this.getRequestConfig();
    return createODataRequest(baseUrl, config, options);
  }

  async processResponse(response: Response, _options?: ExecuteOptions): Promise<Result<number>> {
    if (!response.ok) {
      const error = await parseErrorResponse(
        response,
        response.url || `/${this.config.databaseName}/${getTableName(this.occurrence)}/$count`,
      );
      return { data: undefined, error };
    }

    const raw = await response.text();
    const parsed = this.parseCountValue(raw);
    if (parsed instanceof ResponseStructureError) {
      return { data: undefined, error: parsed };
    }

    return { data: parsed, error: undefined };
  }
}
