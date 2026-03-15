import type { FFetchOptions } from "@fetchkit/ffetch";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export type Auth = { username: string; password: string } | { apiKey: string };

export interface ExecutableBuilder<T> {
  execute(): Promise<Result<T>>;
  // biome-ignore lint/suspicious/noExplicitAny: Request body can be any JSON-serializable value
  getRequestConfig(): { method: string; url: string; body?: any };

  /**
   * Convert this builder to a native Request object for batch processing.
   * @param baseUrl - The base URL for the OData service
   * @param options - Optional execution options (e.g., includeODataAnnotations)
   * @returns A native Request object
   */
  toRequest(baseUrl: string, options?: ExecuteOptions): Request;

  /**
   * Process a raw Response object into a typed Result.
   * This allows builders to apply their own validation and transformation logic.
   * @param response - The native Response object from the batch operation
   * @param options - Optional execution options (e.g., skipValidation, includeODataAnnotations)
   * @returns A typed Result with the builder's expected return type
   */
  processResponse(response: Response, options?: ExecuteOptions): Promise<Result<T>>;
}

export interface ExecutionContext {
  /**
   * @internal
   * Returns the Effect Layer for this context, enabling service-based Effect pipelines.
   * All HTTP requests are made through the Layer's HttpClient service.
   */
  _getLayer?(): import("./services").FMODataLayer;
}

export type InferSchemaType<Schema extends Record<string, StandardSchemaV1>> = {
  // biome-ignore lint/suspicious/noExplicitAny: Required for type inference with infer
  [K in keyof Schema]: Schema[K] extends StandardSchemaV1<any, infer Output> ? Output : never;
};

export type WithSpecialColumns<T> =
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any record shape
  T extends Record<string, any>
    ? T & {
        ROWID: number;
        ROWMODID: number;
      }
    : never;

// Helper type to exclude special columns from a union of keys
// biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any key type
export type ExcludeSystemFields<T extends keyof any> = Exclude<T, "ROWID" | "ROWMODID">;

// OData record metadata fields (present on each record)
export interface ODataRecordMetadata {
  "@id": string;
  "@editLink": string;
}

// OData response wrapper (top-level, internal use only)
export interface ODataListResponse<T> {
  "@context": string;
  value: (T & ODataRecordMetadata)[];
}

export type ODataSingleResponse<T> = T &
  ODataRecordMetadata & {
    "@context": string;
  };

// OData response for single field values
export interface ODataFieldResponse<T> {
  "@context": string;
  value: T;
}

// Result pattern for execute responses
export type Result<T, E = import("./errors").FMODataErrorType> =
  | { data: T; error: undefined }
  | { data: undefined; error: E };

// Batch operation result types
export interface BatchItemResult<T> {
  data: T | undefined;
  error: import("./errors").FMODataErrorType | undefined;
  status: number; // HTTP status code (0 for truncated)
}

// biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any tuple type
export interface BatchResult<T extends readonly any[]> {
  results: { [K in keyof T]: BatchItemResult<T[K]> };
  successCount: number;
  errorCount: number;
  truncated: boolean;
  firstErrorIndex: number | null;
}

// Make specific keys required, rest optional
export type MakeFieldsRequired<T, Keys extends keyof T> = Partial<T> & Required<Pick<T, Keys>>;

// Extract keys from schema where validator doesn't allow null/undefined (auto-required fields)
export type AutoRequiredKeys<Schema extends Record<string, StandardSchemaV1>> = {
  [K in keyof Schema]: Extract<StandardSchemaV1.InferOutput<Schema[K]>, null | undefined> extends never ? K : never;
}[keyof Schema];

// Helper type to compute excluded fields (readOnly fields + idField)
export type ExcludedFields<
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any key type
  IdField extends keyof any | undefined,
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any array type
  ReadOnly extends readonly any[],
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any key type
> = IdField extends keyof any ? IdField | ReadOnly[number] : ReadOnly[number];

// Helper type for InsertData computation
type _ComputeInsertData<
  Schema extends Record<string, StandardSchemaV1>,
  IdField extends keyof Schema | undefined,
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any array type
  Required extends readonly any[],
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any array type
  ReadOnly extends readonly any[],
> = [Required[number]] extends [keyof InferSchemaType<Schema>]
  ? Required extends readonly (keyof InferSchemaType<Schema>)[]
    ? MakeFieldsRequired<
        Omit<InferSchemaType<Schema>, ExcludedFields<IdField, ReadOnly>>,
        Exclude<AutoRequiredKeys<Schema> | Required[number], ExcludedFields<IdField, ReadOnly>>
      >
    : MakeFieldsRequired<
        Omit<InferSchemaType<Schema>, ExcludedFields<IdField, ReadOnly>>,
        Exclude<AutoRequiredKeys<Schema>, ExcludedFields<IdField, ReadOnly>>
      >
  : MakeFieldsRequired<
      Omit<InferSchemaType<Schema>, ExcludedFields<IdField, ReadOnly>>,
      Exclude<AutoRequiredKeys<Schema>, ExcludedFields<IdField, ReadOnly>>
    >;

/**
 * Configuration for automatic retry of transient errors.
 * Uses exponential backoff with optional jitter.
 */
export interface RetryPolicy {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxRetries?: number;
  /**
   * Base delay in milliseconds for exponential backoff (default: 500)
   */
  baseDelay?: number;
  /**
   * Whether to add random jitter to delay to prevent thundering herd (default: true)
   */
  jitter?: boolean;
}

export interface ExecuteOptions {
  includeODataAnnotations?: boolean;
  skipValidation?: boolean;
  /**
   * Overrides the default behavior of the database to use entity IDs (rather than field names) in THIS REQUEST ONLY
   */
  useEntityIds?: boolean;
  /**
   * Overrides the default behavior of the database to include special columns (ROWID and ROWMODID) in THIS REQUEST ONLY.
   * Note: Special columns are only included when there is no $select query.
   */
  includeSpecialColumns?: boolean;
  /**
   * Optional retry policy for transient errors (SchemaLockedError, NetworkError, TimeoutError, HTTP 5xx).
   * When set, failed requests matching transient error conditions will be retried
   * with exponential backoff.
   */
  retryPolicy?: RetryPolicy;
}

/**
 * Type for the fetchHandler callback function.
 * This is a convenience type export that matches the fetchHandler signature in FFetchOptions.
 *
 * @example
 * ```typescript
 * import type { FetchHandler } from '@proofkit/fmodata';
 *
 * const myFetchHandler: FetchHandler = (input, init) => {
 *   console.log('Custom fetch:', input);
 *   return fetch(input, init);
 * };
 *
 * await query.execute({
 *   fetchHandler: myFetchHandler
 * });
 * ```
 */
export type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Combined type for execute() method options.
 *
 * Uses FFetchOptions from @fetchkit/ffetch to ensure proper type inference.
 * FFetchOptions is re-exported in the package to ensure type availability in consuming packages.
 */
export type ExecuteMethodOptions<EO extends ExecuteOptions = ExecuteOptions> = RequestInit &
  FFetchOptions &
  ExecuteOptions &
  EO;

/**
 * Get the Accept header value based on includeODataAnnotations option
 * @param includeODataAnnotations - Whether to include OData annotations
 * @returns Accept header value
 */
export function getAcceptHeader(includeODataAnnotations?: boolean): string {
  return includeODataAnnotations === true ? "application/json" : "application/json;odata.metadata=none";
}

export type ConditionallyWithODataAnnotations<
  T,
  IncludeODataAnnotations extends boolean,
> = IncludeODataAnnotations extends true
  ? T & {
      "@id": string;
      "@editLink": string;
    }
  : T;

/**
 * Normalizes includeSpecialColumns with a database-level default.
 * Uses distributive conditional types to handle unions correctly.
 * @template IncludeSpecialColumns - The includeSpecialColumns value from execute options
 * @template DatabaseDefault - The database-level includeSpecialColumns setting (defaults to false)
 */
export type NormalizeIncludeSpecialColumns<
  IncludeSpecialColumns extends boolean | undefined,
  DatabaseDefault extends boolean = false,
> = [IncludeSpecialColumns] extends [true] ? true : [IncludeSpecialColumns] extends [false] ? false : DatabaseDefault; // When undefined, use database-level default

/**
 * Conditionally adds ROWID and ROWMODID special columns to a type.
 * Special columns are only included when:
 * - includeSpecialColumns is true AND
 * - hasSelect is false (no $select query was applied) AND
 * - T is an object type (not a primitive like string or number)
 *
 * Handles both single objects and arrays of objects.
 */
export type ConditionallyWithSpecialColumns<
  T,
  IncludeSpecialColumns extends boolean,
  HasSelect extends boolean,
> = IncludeSpecialColumns extends true
  ? HasSelect extends false
    ? // Handle array types
      T extends readonly (infer U)[]
      ? // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any record shape
        U extends Record<string, any>
        ? (U & {
            ROWID: number;
            ROWMODID: number;
          })[]
        : T
      : // Handle single object types
        // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any record shape
        T extends Record<string, any>
        ? T & {
            ROWID: number;
            ROWMODID: number;
          }
        : T // Don't add special columns to primitives (e.g., single field queries)
    : T
  : T;

// Helper type to extract schema from a FMTable
export type ExtractSchemaFromOccurrence<Occ> = Occ extends {
  baseTable: { schema: infer S };
}
  ? S extends Record<string, StandardSchemaV1>
    ? S
    : Record<string, StandardSchemaV1>
  : Record<string, StandardSchemaV1>;

export interface GenericFieldMetadata {
  $Nullable?: boolean;
  "@Index"?: boolean;
  "@Calculation"?: boolean;
  "@Summary"?: boolean;
  "@Global"?: boolean;
  "@Org.OData.Core.V1.Permissions"?: "Org.OData.Core.V1.Permission@Read";
}

export type StringFieldMetadata = GenericFieldMetadata & {
  $Type: "Edm.String";
  $DefaultValue?: "USER" | "USERNAME" | "CURRENT_USER";
  $MaxLength?: number;
};

export type DecimalFieldMetadata = GenericFieldMetadata & {
  $Type: "Edm.Decimal";
  "@AutoGenerated"?: boolean;
};

export type DateFieldMetadata = GenericFieldMetadata & {
  $Type: "Edm.Date";
  $DefaultValue?: "CURDATE" | "CURRENT_DATE";
};

export type TimeOfDayFieldMetadata = GenericFieldMetadata & {
  $Type: "Edm.TimeOfDay";
  $DefaultValue?: "CURTIME" | "CURRENT_TIME";
};

export type DateTimeOffsetFieldMetadata = GenericFieldMetadata & {
  $Type: "Edm.Date";
  $DefaultValue?: "CURTIMESTAMP" | "CURRENT_TIMESTAMP";
  "@VersionId"?: boolean;
};

export interface StreamFieldMetadata {
  $Type: "Edm.Stream";
  $Nullable?: boolean;
  "@EnclosedPath": string;
  "@ExternalOpenPath": string;
  "@ExternalSecurePath"?: string;
}

export type FieldMetadata =
  | StringFieldMetadata
  | DecimalFieldMetadata
  | DateFieldMetadata
  | TimeOfDayFieldMetadata
  | DateTimeOffsetFieldMetadata
  | StreamFieldMetadata;

export type EntityType = {
  $Kind: "EntityType";
  $Key: string[];
} & Record<string, FieldMetadata>;

export interface EntitySet {
  $Kind: "EntitySet";
  $Type: string;
}

export type Metadata = Record<string, EntityType | EntitySet>;
