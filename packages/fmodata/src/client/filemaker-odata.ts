import createClient, {
  AbortError,
  CircuitOpenError,
  type FFetchOptions,
  NetworkError,
  RetryLimitError,
  TimeoutError,
} from "@fetchkit/ffetch";
import { Effect, Layer } from "effect";
import { get } from "es-toolkit/compat";
import { runAsResult, withRetryPolicy, withSpan } from "../effect";
import type { FMODataErrorType } from "../errors";
import { HTTPError, ODataError, ResponseParseError, SchemaLockedError } from "../errors";
import { createLogger, type InternalLogger, type Logger } from "../logger";
import { type FMODataLayer, HttpClient, ODataConfig, ODataLogger } from "../services";
import type { Auth, ExecutionContext, Result } from "../types";
import { getAcceptHeader } from "../types";
import { mergePreferHeaderValues } from "./builders/mutation-helpers";
import { ClarisIdAuthManager } from "./claris-id";
import { Database } from "./database";
import { type DatabaseNameNormalizationMode, normalizeDatabasePath } from "./database-name";
import { safeJsonParse } from "./sanitize-json";

const TRAILING_SLASH_REGEX = /\/+$/;

export class FMServerConnection implements ExecutionContext {
  private readonly fetchClient: ReturnType<typeof createClient>;
  private readonly serverUrl: string;
  private readonly auth: Auth;
  private readonly normalizeDatabaseName = true;
  private useEntityIds = false;
  private includeSpecialColumns = false;
  private readonly logger: InternalLogger;
  private readonly clarisIdAuthManager: ClarisIdAuthManager | null;
  private hasWarnedAboutOttoDatabaseNormalization = false;
  /** @internal Stored so credential-override flows can inherit non-auth config. */
  readonly _fetchClientOptions: FFetchOptions | undefined;
  constructor(config: {
    serverUrl: string;
    auth: Auth;
    fetchClientOptions?: FFetchOptions;
    logger?: Logger;
  }) {
    this.logger = createLogger(config.logger);
    this._fetchClientOptions = config.fetchClientOptions;
    this.fetchClient = createClient({
      retries: 0,
      ...config.fetchClientOptions,
    });
    // Ensure the URL uses https://, is valid, and has no trailing slash
    const url = new URL(config.serverUrl);
    if (url.protocol !== "https:") {
      url.protocol = "https:";
    }
    // Remove any trailing slash from pathname
    url.pathname = url.pathname.replace(TRAILING_SLASH_REGEX, "");
    this.serverUrl = url.toString().replace(TRAILING_SLASH_REGEX, "");
    this.auth = config.auth;
    this.clarisIdAuthManager =
      "clarisId" in config.auth
        ? new ClarisIdAuthManager({
            username: config.auth.clarisId.username,
            password: config.auth.clarisId.password,
          })
        : null;
  }

  /**
   * @internal
   * Sets whether to use FileMaker entity IDs (FMFID/FMTID) in requests
   */
  _setUseEntityIds(useEntityIds: boolean): void {
    this.useEntityIds = useEntityIds;
  }

  /**
   * @internal
   * Gets whether to use FileMaker entity IDs (FMFID/FMTID) in requests
   */
  _getUseEntityIds(): boolean {
    return this.useEntityIds;
  }

  /**
   * @internal
   * Sets whether to include special columns (ROWID and ROWMODID) in requests
   */
  _setIncludeSpecialColumns(includeSpecialColumns: boolean): void {
    this.includeSpecialColumns = includeSpecialColumns;
  }

  /**
   * @internal
   * Gets whether to include special columns (ROWID and ROWMODID) in requests
   */
  _getIncludeSpecialColumns(): boolean {
    return this.includeSpecialColumns;
  }

  /**
   * @internal
   * Gets the base URL for OData requests
   */
  _getBaseUrl(): string {
    return `${this.serverUrl}${"apiKey" in this.auth ? "/otto" : ""}/fmi/odata/v4`;
  }

  private _getAuthorizationHeader(fetchHandler?: typeof fetch): Promise<string> {
    if ("apiKey" in this.auth) {
      return Promise.resolve(`Bearer ${this.auth.apiKey}`);
    }

    if ("clarisId" in this.auth) {
      if (!this.clarisIdAuthManager) {
        throw new Error("Claris ID auth manager was not initialized");
      }
      return this.clarisIdAuthManager.getAuthorizationHeader(fetchHandler);
    }

    return Promise.resolve(`Basic ${btoa(`${this.auth.username}:${this.auth.password}`)}`);
  }

  /**
   * @internal
   * Gets the logger instance
   */
  _getLogger(): InternalLogger {
    return this.logger;
  }

  /**
   * @internal
   * Returns the Effect Layer for this connection, composing HttpClient, ODataConfig, and ODataLogger services.
   */
  _getLayer(): FMODataLayer {
    const httpLayer = Layer.succeed(HttpClient, {
      request: <T>(
        url: string,
        options?: RequestInit &
          FFetchOptions & {
            normalizeDatabaseName?: boolean;
            databaseNameNormalizationMode?: DatabaseNameNormalizationMode;
            useEntityIds?: boolean;
            includeSpecialColumns?: boolean;
          },
      ) => this._makeRequestEffect<T>(url, options),
    });

    const configLayer = Layer.succeed(ODataConfig, {
      baseUrl: this._getBaseUrl(),
      databaseName: "",
      normalizeDatabaseName: this.normalizeDatabaseName,
      useEntityIds: this.useEntityIds,
      includeSpecialColumns: this.includeSpecialColumns,
    });

    const loggerLayer = Layer.succeed(ODataLogger, {
      logger: this.logger,
    });

    return Layer.mergeAll(httpLayer, configLayer, loggerLayer);
  }

  /**
   * @internal
   * Classifies a caught error into a typed FMODataErrorType.
   */
  private _classifyError(err: unknown, fullUrl: string): FMODataErrorType {
    if (
      err instanceof TimeoutError ||
      err instanceof AbortError ||
      err instanceof NetworkError ||
      err instanceof RetryLimitError ||
      err instanceof CircuitOpenError
    ) {
      return err;
    }
    if (err instanceof ResponseParseError) {
      return err;
    }
    return new NetworkError(fullUrl, err);
  }

  /**
   * @internal
   * Parses an HTTP error response into a typed FMODataErrorType.
   */
  private _parseHttpError(
    resp: Response,
    fullUrl: string,
    errorBody: { error?: { code?: string | number; message?: string } } | undefined,
  ): FMODataErrorType {
    if (errorBody?.error) {
      const errorCode = errorBody.error.code;
      const errorMessage = errorBody.error.message || resp.statusText;
      if (errorCode === "303" || errorCode === 303) {
        return new SchemaLockedError(fullUrl, errorMessage, errorBody.error);
      }
      return new ODataError(fullUrl, errorMessage, String(errorCode), errorBody.error);
    }
    return new HTTPError(fullUrl, resp.status, resp.statusText, errorBody);
  }

  /**
   * @internal
   * Checks parsed JSON data for embedded OData errors.
   */
  private _checkEmbeddedODataError<T>(
    data: T & { error?: { code?: string | number; message?: string } },
    fullUrl: string,
  ): FMODataErrorType | undefined {
    if (get(data, "error", null)) {
      const errorCode = get(data, "error.code", null);
      const errorMessage = String(get(data, "error.message", "Unknown OData error"));
      if (errorCode === "303" || errorCode === 303) {
        return new SchemaLockedError(fullUrl, errorMessage, data.error);
      }
      return new ODataError(fullUrl, errorMessage, String(errorCode), data.error);
    }
    return undefined;
  }

  /**
   * @internal
   * Builds the Effect pipeline for an HTTP request.
   * Each step in the pipeline is a discrete Effect, enabling composable error handling.
   */
  private _makeRequestEffect<T>(
    url: string,
    options?: RequestInit &
      FFetchOptions & {
        normalizeDatabaseName?: boolean;
        databaseNameNormalizationMode?: DatabaseNameNormalizationMode;
        useEntityIds?: boolean;
        includeSpecialColumns?: boolean;
      },
  ): Effect.Effect<T, FMODataErrorType> {
    const logger = this._getLogger();
    const baseUrl = `${this.serverUrl}${"apiKey" in this.auth ? "/otto" : ""}/fmi/odata/v4`;
    const normalizeDatabaseName = options?.normalizeDatabaseName ?? this.normalizeDatabaseName;
    if ("apiKey" in this.auth && normalizeDatabaseName === false && !this.hasWarnedAboutOttoDatabaseNormalization) {
      logger.warn(
        "normalizeDatabaseName=false cannot disable filename normalization with Otto auth; FileMaker Server normalizes it automatically.",
      );
      this.hasWarnedAboutOttoDatabaseNormalization = true;
    }
    const normalizedUrl = normalizeDatabasePath(url, {
      normalizeDatabaseName,
      mode: options?.databaseNameNormalizationMode,
    });
    const fullUrl = baseUrl + normalizedUrl;

    // Use per-request override if provided, otherwise use the database-level setting
    const useEntityIds = options?.useEntityIds ?? this.useEntityIds;
    const includeSpecialColumns = options?.includeSpecialColumns ?? this.includeSpecialColumns;

    // Get includeODataAnnotations from options (it's passed through from execute options)
    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for optional property access
    const includeODataAnnotations = (options as any)?.includeODataAnnotations;

    // Build Prefer header as comma-separated list when multiple preferences are set
    const preferValues: string[] = [];
    if (useEntityIds) {
      preferValues.push("fmodata.entity-ids");
    }
    if (includeSpecialColumns) {
      preferValues.push("fmodata.include-specialcolumns");
    }

    // TEMPORARY WORKAROUND: Hopefully this feature will be fixed in the ffetch library
    // Extract fetchHandler and headers separately, only for tests where we're overriding the fetch handler per-request
    const fetchHandler = options?.fetchHandler ?? this._fetchClientOptions?.fetchHandler;
    const { headers: _headers, fetchHandler: _fetchHandler, ...restOptions } = options || {};
    const buildHeaders = async () => {
      const headers = new Headers(options?.headers);
      headers.set("Authorization", await this._getAuthorizationHeader(fetchHandler));
      headers.set("Content-Type", "application/json");
      headers.set("Accept", getAcceptHeader(includeODataAnnotations));

      const mergedPrefer = mergePreferHeaderValues(
        preferValues.length > 0 ? preferValues.join(", ") : undefined,
        headers.get("Prefer") ?? undefined,
      );
      if (mergedPrefer) {
        headers.set("Prefer", mergedPrefer);
      } else {
        headers.delete("Prefer");
      }

      return headers;
    };

    // If fetchHandler is provided, create a temporary client with it
    // Otherwise use the existing client
    const clientToUse = fetchHandler ? createClient({ retries: 0, fetchHandler }) : this.fetchClient;

    // Step 1: Execute the HTTP request
    const fetchEffect = Effect.tryPromise({
      try: async () => {
        const headers = await buildHeaders();
        const { authorization: _authorization, ...loggableHeaders } = Object.fromEntries(headers.entries());
        logger.debug("Request headers:", loggableHeaders);

        const finalOptions = {
          ...restOptions,
          headers,
        };

        return clientToUse(fullUrl, finalOptions);
      },
      catch: (err) => this._classifyError(err, fullUrl),
    });

    // Step 2: Process the response
    const pipeline = fetchEffect.pipe(
      Effect.tap((resp) => Effect.sync(() => logger.debug(`${restOptions.method ?? "GET"} ${resp.status} ${fullUrl}`))),
      Effect.flatMap((resp) => {
        // Handle HTTP errors
        if (!resp.ok) {
          return Effect.tryPromise({
            try: async () => {
              let errorBody: { error?: { code?: string | number; message?: string } } | undefined;
              try {
                if (resp.headers.get("content-type")?.includes("application/json")) {
                  errorBody = await safeJsonParse<typeof errorBody>(resp);
                }
              } catch {
                // Ignore JSON parse errors
              }
              return errorBody;
            },
            catch: () => new HTTPError(fullUrl, resp.status, resp.statusText) as FMODataErrorType,
          }).pipe(Effect.flatMap((errorBody) => Effect.fail(this._parseHttpError(resp, fullUrl, errorBody))));
        }

        // Check for affected rows header (for DELETE and bulk PATCH operations)
        const affectedRows = resp.headers.get("fmodata.affected_rows");
        if (affectedRows !== null) {
          return Effect.succeed(Number.parseInt(affectedRows, 10) as T);
        }

        // Handle 204 No Content with no body
        if (resp.status === 204) {
          const locationHeader = resp.headers?.get?.("Location") || resp.headers?.get?.("location");
          if (locationHeader) {
            return Effect.succeed({ _location: locationHeader } as T);
          }
          return Effect.succeed(0 as T);
        }

        // Parse JSON response
        if (resp.headers.get("content-type")?.includes("application/json")) {
          return Effect.tryPromise({
            try: () => safeJsonParse<T & { error?: { code?: string | number; message?: string } }>(resp),
            catch: (err) => this._classifyError(err, fullUrl),
          }).pipe(
            Effect.flatMap((data) => {
              const embeddedError = this._checkEmbeddedODataError(data, fullUrl);
              if (embeddedError) {
                return Effect.fail(embeddedError);
              }
              return Effect.succeed(data as T);
            }),
          );
        }

        // Plain text response
        return Effect.tryPromise({
          try: () => resp.text(),
          catch: (err) => this._classifyError(err, fullUrl),
        }).pipe(Effect.map((text) => text as T));
      }),
    );

    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for optional property access
    const retryPolicy = (options as any)?.retryPolicy;
    const method = (restOptions.method ?? "GET").toUpperCase();
    const isRetrySafeMethod = method === "GET" || method === "HEAD" || method === "OPTIONS" || method === "PUT";

    const requestEffect = retryPolicy && isRetrySafeMethod ? withRetryPolicy(pipeline, retryPolicy) : pipeline;

    // Apply retry policy and tracing span
    return withSpan(requestEffect, "fmodata.request", {
      "fmodata.url": normalizedUrl,
      "fmodata.method": method,
    });
  }

  /**
   * @internal
   */
  _makeRequest<T>(
    url: string,
    options?: RequestInit &
      FFetchOptions & {
        normalizeDatabaseName?: boolean;
        databaseNameNormalizationMode?: DatabaseNameNormalizationMode;
        useEntityIds?: boolean;
        includeSpecialColumns?: boolean;
      },
  ): Promise<Result<T>> {
    return runAsResult(this._makeRequestEffect<T>(url, options));
  }

  database<IncludeSpecialColumns extends boolean = false>(
    name: string,
    config?: {
      normalizeDatabaseName?: boolean;
      useEntityIds?: boolean;
      includeSpecialColumns?: IncludeSpecialColumns;
    },
  ): Database<IncludeSpecialColumns> {
    return new Database<IncludeSpecialColumns>(name, this, config);
  }

  /**
   * Lists all available databases from the FileMaker OData service.
   * @returns Promise resolving to an array of database names
   */
  async listDatabaseNames(): Promise<string[]> {
    const result = await this._makeRequest<{
      value?: Array<{ name: string }>;
    }>("/$metadata", { headers: { Accept: "application/json" } });
    if (result.error) {
      throw result.error;
    }
    if (result.data.value && Array.isArray(result.data.value)) {
      return result.data.value.map((item) => item.name);
    }
    return [];
  }
}
