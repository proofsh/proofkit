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
import { Context, type Effect, type Layer } from "effect";
import type { FFetchOptions } from "@fetchkit/ffetch";
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
