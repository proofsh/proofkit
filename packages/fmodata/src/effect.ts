/**
 * Effect.ts integration for fmodata.
 *
 * Provides Effect-based wrappers around the core fmodata operations,
 * enabling composable error handling, retry policies, and typed error channels.
 *
 * This module is used internally by builders to reduce error-threading boilerplate.
 * The public API surface (Result<T>) remains unchanged.
 */

import type { FFetchOptions } from "@fetchkit/ffetch";
import { Effect, Schedule } from "effect";
import type { FMODataErrorType } from "./errors";
import { isTransientError } from "./errors";
import { HttpClient } from "./services";
import type { Result, RetryPolicy } from "./types";

/**
 * Converts a Promise<Result<T>> into an Effect with typed error channel.
 * This is the bridge between the existing Result pattern and Effect pipelines.
 */
export function fromResult<T>(promise: Promise<Result<T>>): Effect.Effect<T, FMODataErrorType> {
  return Effect.tryPromise({
    try: () => promise,
    catch: (e) => e as FMODataErrorType,
  }).pipe(Effect.flatMap((result) => (result.error ? Effect.fail(result.error) : Effect.succeed(result.data))));
}

/**
 * Creates an Effect that yields the HttpClient service and makes a request.
 * This is the primary way builders should make HTTP requests.
 */
export function requestFromService<T>(
  url: string,
  options?: RequestInit &
    FFetchOptions & {
      useEntityIds?: boolean;
      includeSpecialColumns?: boolean;
      includeODataAnnotations?: boolean;
      retryPolicy?: RetryPolicy;
    },
): Effect.Effect<T, FMODataErrorType, HttpClient> {
  return Effect.flatMap(HttpClient, (client) => client.request<T>(url, options));
}

/**
 * Runs an Effect pipeline and converts the result back to the fmodata Result type.
 * This is the exit point from Effect back to the public API.
 */
export function runAsResult<T>(effect: Effect.Effect<T, FMODataErrorType>): Promise<Result<T>> {
  return Effect.runPromise(
    effect.pipe(
      Effect.map((data): Result<T> => ({ data, error: undefined })),
      Effect.catchAll((error) => Effect.succeed<Result<T>>({ data: undefined, error })),
    ),
  );
}

/**
 * Wraps a sync/async function that may throw into an Effect that captures
 * the error as a typed FMODataErrorType.
 */
export function tryEffect<T>(
  fn: () => T | Promise<T>,
  mapError: (e: unknown) => FMODataErrorType,
): Effect.Effect<T, FMODataErrorType> {
  return Effect.tryPromise({
    try: () => Promise.resolve(fn()),
    catch: mapError,
  });
}

/**
 * Wraps a function that returns a validation-style result
 * ({ valid: true, data } | { valid: false, error }) into an Effect.
 */
export function fromValidation<T>(
  fn: () => Promise<{ valid: true; data: T } | { valid: false; error: FMODataErrorType }>,
): Effect.Effect<T, FMODataErrorType> {
  return Effect.tryPromise({
    try: fn,
    catch: (e) => e as FMODataErrorType,
  }).pipe(Effect.flatMap((result) => (result.valid ? Effect.succeed(result.data) : Effect.fail(result.error))));
}

/**
 * Builds an Effect Schedule from a RetryPolicy configuration.
 * Uses exponential backoff with optional jitter, only retrying transient errors.
 */
export function buildRetrySchedule(policy: RetryPolicy) {
  const maxRetries = policy.maxRetries ?? 3;
  const baseDelay = `${policy.baseDelay ?? 500} millis` as const;
  const useJitter = policy.jitter !== false;

  const base = Schedule.exponential(baseDelay);
  const withJitter = useJitter ? Schedule.jittered(base) : base;

  return withJitter.pipe(
    Schedule.intersect(Schedule.recurs(maxRetries)),
    Schedule.whileInput((error: FMODataErrorType) => isTransientError(error)),
  );
}

/**
 * Applies a retry policy to an Effect if the policy is defined.
 * Only retries transient errors (SchemaLockedError, NetworkError, TimeoutError, HTTP 5xx).
 */
export function withRetryPolicy<T>(
  effect: Effect.Effect<T, FMODataErrorType>,
  retryPolicy?: RetryPolicy,
): Effect.Effect<T, FMODataErrorType> {
  if (!retryPolicy) {
    return effect;
  }
  return effect.pipe(Effect.retry(buildRetrySchedule(retryPolicy)));
}

/**
 * Wraps an Effect with a tracing span for observability.
 * Zero overhead when no OpenTelemetry tracer is configured.
 */
export function withSpan<T, E, R>(
  effect: Effect.Effect<T, E, R>,
  name: string,
  attributes?: Record<string, string>,
): Effect.Effect<T, E, R> {
  return effect.pipe(
    Effect.withSpan(name, {
      attributes: attributes ? attributes : undefined,
    }),
  );
}
