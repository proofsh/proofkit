import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Base class for all fmodata errors
 */
export abstract class FMODataError extends Error {
  abstract readonly kind: string;
  readonly timestamp: Date;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
    this.timestamp = new Date();
  }
}

// ============================================
// HTTP Errors (with status codes)
// ============================================

export class HTTPError extends FMODataError {
  readonly kind = "HTTPError" as const;
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
  readonly response?: any;

  // biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
  constructor(url: string, status: number, statusText: string, response?: any) {
    super(`HTTP ${status} ${statusText} for ${url}`);
    this.url = url;
    this.status = status;
    this.statusText = statusText;
    this.response = response;
  }

  // Helper methods for common status checks
  is4xx(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  is5xx(): boolean {
    return this.status >= 500 && this.status < 600;
  }

  isNotFound(): boolean {
    return this.status === 404;
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }

  isForbidden(): boolean {
    return this.status === 403;
  }
}

// ============================================
// OData Specific Errors
// ============================================

export class ODataError extends FMODataError {
  readonly kind = "ODataError" as const;
  readonly url: string;
  readonly code?: string;
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic error details from OData API
  readonly details?: any;

  // biome-ignore lint/suspicious/noExplicitAny: Dynamic error details from OData API
  constructor(url: string, message: string, code?: string, details?: any) {
    super(`OData error: ${message}`);
    this.url = url;
    this.code = code;
    this.details = details;
  }
}

export class SchemaLockedError extends FMODataError {
  readonly kind = "SchemaLockedError" as const;
  readonly url: string;
  readonly code: string;
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic error details from OData API
  readonly details?: any;

  // biome-ignore lint/suspicious/noExplicitAny: Dynamic error details from OData API
  constructor(url: string, message: string, details?: any) {
    super(`OData error: ${message}`);
    this.url = url;
    this.code = "303";
    this.details = details;
  }
}

// ============================================
// Validation Errors
// ============================================

export class ValidationError extends FMODataError {
  readonly kind = "ValidationError" as const;
  readonly field?: string;
  readonly issues: readonly StandardSchemaV1.Issue[];
  readonly value?: unknown;

  constructor(
    message: string,
    issues: readonly StandardSchemaV1.Issue[],
    options?: {
      field?: string;
      value?: unknown;
      cause?: Error["cause"];
    },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.field = options?.field;
    this.issues = issues;
    this.value = options?.value;
  }
}

export class ResponseStructureError extends FMODataError {
  readonly kind = "ResponseStructureError" as const;
  readonly expected: string;
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
  readonly received: any;

  // biome-ignore lint/suspicious/noExplicitAny: Dynamic response type from OData API
  constructor(expected: string, received: any) {
    super(`Invalid response structure: expected ${expected}`);
    this.expected = expected;
    this.received = received;
  }
}

export class RecordCountMismatchError extends FMODataError {
  readonly kind = "RecordCountMismatchError" as const;
  readonly expected: number | "one" | "at-most-one";
  readonly received: number;

  constructor(expected: number | "one" | "at-most-one", received: number) {
    const expectedStr = typeof expected === "number" ? expected : expected;
    super(`Expected ${expectedStr} record(s), but received ${received}`);
    this.expected = expected;
    this.received = received;
  }
}

export class InvalidLocationHeaderError extends FMODataError {
  readonly kind = "InvalidLocationHeaderError" as const;
  readonly locationHeader?: string;

  constructor(message: string, locationHeader?: string) {
    super(message);
    this.locationHeader = locationHeader;
  }
}

export class ResponseParseError extends FMODataError {
  readonly kind = "ResponseParseError" as const;
  readonly url: string;
  readonly rawText?: string;

  constructor(url: string, message: string, options?: { rawText?: string; cause?: Error }) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.url = url;
    this.rawText = options?.rawText;
  }
}

export class BatchTruncatedError extends FMODataError {
  readonly kind = "BatchTruncatedError" as const;
  readonly operationIndex: number;
  readonly failedAtIndex: number;

  constructor(operationIndex: number, failedAtIndex: number) {
    super(`Operation ${operationIndex} was not executed because operation ${failedAtIndex} failed`);
    this.operationIndex = operationIndex;
    this.failedAtIndex = failedAtIndex;
  }
}

// ============================================
// Type Guards
// ============================================

export function isHTTPError(error: unknown): error is HTTPError {
  return error instanceof HTTPError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isODataError(error: unknown): error is ODataError {
  return error instanceof ODataError;
}

export function isSchemaLockedError(error: unknown): error is SchemaLockedError {
  return error instanceof SchemaLockedError;
}

export function isResponseStructureError(error: unknown): error is ResponseStructureError {
  return error instanceof ResponseStructureError;
}

export function isRecordCountMismatchError(error: unknown): error is RecordCountMismatchError {
  return error instanceof RecordCountMismatchError;
}

export function isResponseParseError(error: unknown): error is ResponseParseError {
  return error instanceof ResponseParseError;
}

export function isBatchTruncatedError(error: unknown): error is BatchTruncatedError {
  return error instanceof BatchTruncatedError;
}

export function isFMODataError(error: unknown): error is FMODataError {
  return error instanceof FMODataError;
}

/**
 * Determines whether an error is transient and safe to retry.
 * Transient errors include:
 * - SchemaLockedError (FM code 303 — file locked temporarily)
 * - NetworkError (connection issues)
 * - TimeoutError (request timed out)
 * - HTTP 5xx errors (server-side failures)
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof SchemaLockedError) return true;
  // Check ffetch error types by name since they aren't subclasses of FMODataError
  if (error && typeof error === "object" && "name" in error) {
    const name = (error as { name: string }).name;
    if (name === "NetworkError" || name === "TimeoutError") return true;
  }
  if (error instanceof HTTPError && error.is5xx()) return true;
  return false;
}

// ============================================
// Union type for all possible errors
// ============================================

// Re-export ffetch errors (they'll be imported from @fetchkit/ffetch)
export type {
  AbortError,
  CircuitOpenError,
  NetworkError,
  RetryLimitError,
  TimeoutError,
} from "@fetchkit/ffetch";

export type FMODataErrorType =
  | import("@fetchkit/ffetch").TimeoutError
  | import("@fetchkit/ffetch").AbortError
  | import("@fetchkit/ffetch").NetworkError
  | import("@fetchkit/ffetch").RetryLimitError
  | import("@fetchkit/ffetch").CircuitOpenError
  | HTTPError
  | ODataError
  | SchemaLockedError
  | ValidationError
  | ResponseStructureError
  | RecordCountMismatchError
  | InvalidLocationHeaderError
  | ResponseParseError
  | BatchTruncatedError;
