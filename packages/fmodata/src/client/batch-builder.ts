import { Effect } from "effect";
import { requestFromService, runAsResult, withSpan } from "../effect";
import type { FMODataErrorType } from "../errors";
import { BatchTruncatedError } from "../errors";
import { extractConfigFromLayer, type FMODataLayer, type ODataConfig } from "../services";
import type {
  BatchItemResult,
  BatchResult,
  ExecutableBuilder,
  ExecuteMethodOptions,
  ExecuteOptions,
  Result,
} from "../types";
import { formatBatchRequestFromNative, type ParsedBatchResponse, parseBatchResponse } from "./batch-request";

/**
 * Helper type to extract result types from a tuple of ExecutableBuilders.
 * Uses a mapped type which TypeScript 4.1+ can handle for tuples.
 */
// biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any ExecutableBuilder result type
type ExtractTupleTypes<T extends readonly ExecutableBuilder<any>[]> = {
  [K in keyof T]: T[K] extends ExecutableBuilder<infer U> ? U : never;
};

/**
 * Converts a ParsedBatchResponse to a native Response object
 * @param parsed - The parsed batch response
 * @returns A native Response object
 */
function parsedToResponse(parsed: ParsedBatchResponse): Response {
  const headers = new Headers(parsed.headers);

  // Handle null body
  if (parsed.body === null || parsed.body === undefined) {
    return new Response(null, {
      status: parsed.status,
      statusText: parsed.statusText,
      headers,
    });
  }

  // Convert body to string if it's not already
  const bodyString = typeof parsed.body === "string" ? parsed.body : JSON.stringify(parsed.body);

  // Handle 204 No Content status - it cannot have a body per HTTP spec
  // If FileMaker returns 204 with a body, treat it as 200
  let status = parsed.status;
  if (status === 204 && bodyString && bodyString.trim() !== "") {
    status = 200;
  }

  return new Response(status === 204 ? null : bodyString, {
    status,
    statusText: parsed.statusText,
    headers,
  });
}

/**
 * Builder for batch operations that allows multiple queries to be executed together
 * in a single transactional request.
 *
 * Note: BatchBuilder does not implement ExecutableBuilder because execute() returns
 * BatchResult instead of Result, which is a different return type structure.
 */
// biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any ExecutableBuilder result type
export class BatchBuilder<Builders extends readonly ExecutableBuilder<any>[]> {
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any ExecutableBuilder result type
  private readonly builders: ExecutableBuilder<any>[];
  private readonly layer: FMODataLayer;
  private readonly config: ODataConfig;

  constructor(builders: Builders, layer: FMODataLayer) {
    // Convert readonly tuple to mutable array for dynamic additions
    this.builders = [...builders];
    this.layer = layer;
    this.config = extractConfigFromLayer(this.layer).config;
  }

  /**
   * Add a request to the batch dynamically.
   * This allows building up batch operations programmatically.
   *
   * @param builder - An executable builder to add to the batch
   * @returns This BatchBuilder for method chaining
   * @example
   * ```ts
   * const batch = db.batch([]);
   * batch.addRequest(db.from('contacts').list());
   * batch.addRequest(db.from('users').list());
   * const result = await batch.execute();
   * ```
   */
  addRequest<T>(builder: ExecutableBuilder<T>): this {
    this.builders.push(builder);
    return this;
  }

  /**
   * Get the request configuration for this batch operation.
   * This is used internally by the execution system.
   */
  // biome-ignore lint/suspicious/noExplicitAny: Request body can be any JSON-serializable value
  getRequestConfig(): { method: string; url: string; body?: any } {
    return {
      method: "POST",
      url: `/${this.config.databaseName}/$batch`,
      body: undefined, // Body is constructed in execute()
    };
  }

  toRequest(baseUrl: string, _options?: ExecuteOptions): Request {
    const fullUrl = `${baseUrl}/${this.config.databaseName}/$batch`;
    return new Request(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "multipart/mixed",
        "OData-Version": "4.0",
      },
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: Generic return type for interface compliance
  processResponse(_response: Response, _options?: ExecuteOptions): Promise<Result<any>> {
    return Promise.resolve({
      data: undefined,
      error: {
        name: "NotImplementedError",
        message: "Batch operations handle response processing internally",
        timestamp: new Date(),
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion for error object
      } as any,
    });
  }

  /**
   * Creates a failed BatchResult where all operations are marked as failed with the given error.
   */
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any result type
  private failAllResults(error: any): BatchResult<ExtractTupleTypes<Builders>> {
    const errorCount = this.builders.length;
    // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any result type
    const results: BatchItemResult<any>[] = this.builders.map(() => ({
      data: undefined,
      error,
      status: 0,
    }));
    return {
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for complex generic return type
      results: results as any,
      successCount: 0,
      errorCount,
      truncated: false,
      firstErrorIndex: 0,
    };
  }

  /**
   * Execute the batch operation.
   *
   * @param options - Optional fetch options and batch-specific options (includes beforeRequest hook)
   * @returns A BatchResult containing individual results for each operation
   */
  async execute<EO extends ExecuteOptions>(
    options?: ExecuteMethodOptions<EO>,
  ): Promise<BatchResult<ExtractTupleTypes<Builders>>> {
    const baseUrl = this.config.baseUrl;
    if (!baseUrl) {
      return this.failAllResults({
        name: "ConfigurationError",
        message: "Base URL not available in ODataConfig",
        timestamp: new Date(),
      });
    }

    const pipeline = Effect.gen(this, function* () {
      // Step 1: Convert builders to Request objects and format batch
      const requests: Request[] = this.builders.map((builder) => builder.toRequest(baseUrl, options));
      const { body, boundary } = yield* Effect.tryPromise({
        try: () => formatBatchRequestFromNative(requests, baseUrl),
        catch: (e) => e as FMODataErrorType,
      });

      // Step 2: Execute the batch HTTP request via DI
      const responseData = yield* requestFromService<string>(`/${this.config.databaseName}/$batch`, {
        ...options,
        method: "POST",
        headers: {
          ...options?.headers,
          "Content-Type": `multipart/mixed; boundary=${boundary}`,
          "OData-Version": "4.0",
        },
        body,
      });

      // Step 3: Parse multipart response
      const firstLine = responseData.split("\r\n")[0] || responseData.split("\n")[0] || "";
      const actualBoundary = firstLine.startsWith("--") ? firstLine.substring(2) : boundary;
      const contentTypeHeader = `multipart/mixed; boundary=${actualBoundary}`;
      const parsedResponses = parseBatchResponse(responseData, contentTypeHeader);

      // Step 4: Process each response using the corresponding builder
      // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any result type
      const results: BatchItemResult<any>[] = [];
      let successCount = 0;
      let errorCount = 0;
      let firstErrorIndex: number | null = null;
      const truncated = parsedResponses.length < this.builders.length;

      for (let i = 0; i < this.builders.length; i++) {
        const builder = this.builders[i];
        const parsed = parsedResponses[i];

        if (!parsed) {
          const failedAtIndex = firstErrorIndex ?? i;
          results.push({
            data: undefined,
            error: new BatchTruncatedError(i, failedAtIndex),
            status: 0,
          });
          errorCount++;
          continue;
        }

        if (!builder) {
          results.push({
            data: undefined,
            error: {
              name: "BatchError",
              message: `Builder at index ${i} is undefined`,
              timestamp: new Date(),
              // biome-ignore lint/suspicious/noExplicitAny: Type assertion for error object
            } as any,
            status: parsed.status,
          });
          errorCount++;
          if (firstErrorIndex === null) {
            firstErrorIndex = i;
          }
          continue;
        }

        const nativeResponse = parsedToResponse(parsed);
        const result = yield* Effect.tryPromise({
          try: () => builder.processResponse(nativeResponse, options),
          catch: (e) => e as FMODataErrorType,
        });

        if (result.error) {
          results.push({ data: undefined, error: result.error, status: parsed.status });
          errorCount++;
          if (firstErrorIndex === null) {
            firstErrorIndex = i;
          }
        } else {
          results.push({ data: result.data, error: undefined, status: parsed.status });
          successCount++;
        }
      }

      return {
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion for complex generic return type
        results: results as any,
        successCount,
        errorCount,
        truncated,
        firstErrorIndex,
      } as BatchResult<ExtractTupleTypes<Builders>>;
    });

    // For batch, errors at the transport level fail all operations
    const result = await runAsResult(Effect.provide(withSpan(pipeline, "fmodata.batch"), this.layer));
    if (result.error) {
      return this.failAllResults(result.error);
    }
    return result.data;
  }
}
