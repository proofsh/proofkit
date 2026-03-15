/**
 * Effect.ts integration for fmodata.
 *
 * Provides Effect-based wrappers around the core fmodata operations,
 * enabling composable error handling, retry policies, and typed error channels.
 *
 * This module is used internally by builders to reduce error-threading boilerplate.
 * The public API surface (Result<T>) remains unchanged.
 */
import { Effect } from "effect";
import type { FMODataErrorType } from "./errors";
import type { ExecutionContext, Result } from "./types";

/**
 * Converts a Promise<Result<T>> into an Effect with typed error channel.
 * This is the bridge between the existing Result pattern and Effect pipelines.
 */
export function fromResult<T>(promise: Promise<Result<T>>): Effect.Effect<T, FMODataErrorType> {
	return Effect.tryPromise({
		try: () => promise,
		catch: (e) => e as FMODataErrorType,
	}).pipe(
		Effect.flatMap((result) => (result.error ? Effect.fail(result.error) : Effect.succeed(result.data))),
	);
}

/**
 * Wraps _makeRequest as an Effect with typed error channel.
 */
export function makeRequestEffect<T>(
	context: ExecutionContext,
	url: string,
	options?: Parameters<ExecutionContext["_makeRequest"]>[1],
): Effect.Effect<T, FMODataErrorType> {
	return fromResult(context._makeRequest<T>(url, options));
}

/**
 * Runs an Effect pipeline and converts the result back to the fmodata Result type.
 * This is the exit point from Effect back to the public API.
 */
export async function runAsResult<T>(effect: Effect.Effect<T, FMODataErrorType>): Promise<Result<T>> {
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
export function tryEffect<T>(fn: () => T | Promise<T>, mapError: (e: unknown) => FMODataErrorType): Effect.Effect<T, FMODataErrorType> {
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
