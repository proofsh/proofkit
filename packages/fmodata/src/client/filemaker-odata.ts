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
import { Database } from "./database";
import { safeJsonParse } from "./sanitize-json";

const TRAILING_SLASH_REGEX = /\/+$/;

export class FMServerConnection implements ExecutionContext {
  private readonly fetchClient: ReturnType<typeof createClient>;
  private readonly serverUrl: string;
  private readonly auth: Auth;
  private useEntityIds = false;
  private includeSpecialColumns = false;
  private readonly logger: InternalLogger;
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
        options?: RequestInit & FFetchOptions & { useEntityIds?: boolean; includeSpecialColumns?: boolean },
      ) => this._makeRequestEffect<T>(url, options),
    });

    const configLayer = Layer.succeed(ODataConfig, {
      baseUrl: this._getBaseUrl(),
      databaseName: "",
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
        useEntityIds?: boolean;
        includeSpecialColumns?: boolean;
      },
  ): Effect.Effect<T, FMODataErrorType> {
    const logger = this._getLogger();
    const baseUrl = `${this.serverUrl}${"apiKey" in this.auth ? "/otto" : ""}/fmi/odata/v4`;
    const fullUrl = baseUrl + url;

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

    const headers = {
      Authorization:
        "apiKey" in this.auth
          ? `Bearer ${this.auth.apiKey}`
          : `Basic ${btoa(`${this.auth.username}:${this.auth.password}`)}`,
      "Content-Type": "application/json",
      Accept: getAcceptHeader(includeODataAnnotations),
      ...(preferValues.length > 0 ? { Prefer: preferValues.join(", ") } : {}),
      ...(options?.headers || {}),
    };

    // Prepare loggableHeaders by omitting the Authorization key
    const { Authorization, ...loggableHeaders } = headers;
    logger.debug("Request headers:", loggableHeaders);

    // TEMPORARY WORKAROUND: Hopefully this feature will be fixed in the ffetch library
    // Extract fetchHandler and headers separately, only for tests where we're overriding the fetch handler per-request
    const fetchHandler = options?.fetchHandler;
    const { headers: _headers, fetchHandler: _fetchHandler, ...restOptions } = options || {};

    // If fetchHandler is provided, create a temporary client with it
    // Otherwise use the existing client
    const clientToUse = fetchHandler ? createClient({ retries: 0, fetchHandler }) : this.fetchClient;

    const finalOptions = {
      ...restOptions,
      headers,
    };

    // Step 1: Execute the HTTP request
    const fetchEffect = Effect.tryPromise({
      try: () => clientToUse(fullUrl, finalOptions),
      catch: (err) => this._classifyError(err, fullUrl),
    });

    // Step 2: Process the response
    const pipeline = fetchEffect.pipe(
      Effect.tap((resp) =>
        Effect.sync(() => logger.debug(`${finalOptions.method ?? "GET"} ${resp.status} ${fullUrl}`)),
      ),
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

    // Apply retry policy and tracing span
    return withSpan(withRetryPolicy(pipeline, retryPolicy), "fmodata.request", {
      "fmodata.url": url,
      "fmodata.method": finalOptions.method ?? "GET",
    });
  }

  /**
   * @internal
   */
  async _makeRequest<T>(
    url: string,
    options?: RequestInit &
      FFetchOptions & {
        useEntityIds?: boolean;
        includeSpecialColumns?: boolean;
      },
  ): Promise<Result<T>> {
    return runAsResult(this._makeRequestEffect<T>(url, options));
  }

  database<IncludeSpecialColumns extends boolean = false>(
    name: string,
    config?: {
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
