/**
 * Effect Service definitions for fmodata.
 *
 * These services replace the monolithic ExecutionContext interface with
 * composable, mockable Effect services. Each service has a single responsibility:
 * - HttpClient: HTTP request execution
 * - ODataConfig: Connection and database configuration
 * - ODataLogger: Logging
 *
 * Services are combined into Layers provided by FMServerConnection (production)
 * or MockFMServerConnection (testing).
 */

import type { FFetchOptions } from "@fetchkit/ffetch";
import { Context, Effect, Layer } from "effect";
import type { FMODataErrorType } from "./errors";
import type { InternalLogger } from "./logger";

// --- HttpClient Service ---

export interface HttpClient {
  readonly request: <T>(
    url: string,
    options?: RequestInit &
      FFetchOptions & {
        useEntityIds?: boolean;
        includeSpecialColumns?: boolean;
        includeODataAnnotations?: boolean;
        retryPolicy?: import("./types").RetryPolicy;
      },
  ) => Effect.Effect<T, FMODataErrorType>;
}

export const HttpClient = Context.GenericTag<HttpClient>("@proofkit/fmodata/HttpClient");

// --- ODataConfig Service ---

export interface ODataConfig {
  readonly baseUrl: string;
  readonly databaseName: string;
  readonly useEntityIds: boolean;
  readonly includeSpecialColumns: boolean;
}

export const ODataConfig = Context.GenericTag<ODataConfig>("@proofkit/fmodata/ODataConfig");

// --- ODataLogger Service ---

export interface ODataLogger {
  readonly logger: InternalLogger;
}

export const ODataLogger = Context.GenericTag<ODataLogger>("@proofkit/fmodata/ODataLogger");

// --- Combined layer type ---

export type FMODataLayer = Layer.Layer<HttpClient | ODataConfig | ODataLogger>;

// --- Layer utilities ---

/**
 * Extracts ODataConfig and ODataLogger values from a Layer synchronously.
 * Used by builders to access config in non-Effect methods (getRequestConfig, toRequest, etc.)
 */
export function extractConfigFromLayer(layer: FMODataLayer): { config: ODataConfig; logger: InternalLogger } {
  const effect = Effect.gen(function* () {
    const config = yield* ODataConfig;
    const { logger } = yield* ODataLogger;
    return { config, logger };
  });
  return Effect.runSync(Effect.provide(effect, layer));
}

/**
 * Creates a database-scoped Layer by overriding ODataConfig with database-specific values.
 * The HttpClient and ODataLogger services are preserved from the base layer.
 */
export function createDatabaseLayer(
  baseLayer: FMODataLayer,
  overrides: {
    databaseName: string;
    useEntityIds: boolean;
    includeSpecialColumns: boolean;
  },
): FMODataLayer {
  // Extract base config to get baseUrl
  const { config: baseConfig } = extractConfigFromLayer(baseLayer);

  const dbConfigLayer = Layer.succeed(ODataConfig, {
    baseUrl: baseConfig.baseUrl,
    databaseName: overrides.databaseName,
    useEntityIds: overrides.useEntityIds,
    includeSpecialColumns: overrides.includeSpecialColumns,
  });

  // Merge: dbConfigLayer overrides ODataConfig, but HttpClient and ODataLogger come from baseLayer
  return Layer.merge(baseLayer, dbConfigLayer);
}
