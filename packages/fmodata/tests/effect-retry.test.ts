import { HTTPError, SchemaLockedError } from "@proofkit/fmodata";
import { runAsResult, withRetryPolicy } from "@proofkit/fmodata/effect";
import { BuilderInvariantError } from "@proofkit/fmodata/errors";
import { Clock, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";

describe("Effect retry policies", () => {
  it.each([0, 2, undefined])("limits retries to %s, defaulting to three", async (maxRetries) => {
    const error = new HTTPError("/retry", 503, "Unavailable");
    let attempts = 0;
    const request = Effect.suspend(() => {
      attempts += 1;
      return Effect.fail(error);
    });

    const result = await runAsResult(withRetryPolicy(request, { maxRetries, baseDelay: 0 }));

    expect(attempts).toBe((maxRetries ?? 3) + 1);
    expect(result.error).toBe(error);
  });

  it("does not retry permanent errors", async () => {
    const error = new HTTPError("/retry", 400, "Bad Request");
    let attempts = 0;
    const request = Effect.suspend(() => {
      attempts += 1;
      return Effect.fail(error);
    });

    const result = await runAsResult(withRetryPolicy(request, { baseDelay: 0 }));

    expect(attempts).toBe(1);
    expect(result.error).toBe(error);
  });

  it("retries schema locks with exponential backoff until success", async () => {
    const attemptTimes: number[] = [];
    const request = Effect.gen(function* () {
      attemptTimes.push(yield* Clock.currentTimeMillis);
      if (attemptTimes.length < 4) {
        return yield* Effect.fail(new SchemaLockedError("/retry", "Locked"));
      }
      return "ok";
    });
    const program = Effect.gen(function* () {
      const fiber = yield* withRetryPolicy(request, { baseDelay: 100, jitter: false }).pipe(Effect.forkChild);
      yield* TestClock.adjust("700 millis");
      return yield* Fiber.join(fiber);
    });

    const result = await Effect.runPromise(Effect.provide(program, TestClock.layer()));

    expect(result).toBe("ok");
    expect(attemptTimes).toEqual([0, 100, 300, 700]);
  });

  it("does not retry when no policy is configured", async () => {
    const error = new HTTPError("/retry", 503, "Unavailable");
    let attempts = 0;
    const request = Effect.suspend(() => {
      attempts += 1;
      return Effect.fail(error);
    });

    const result = await runAsResult(withRetryPolicy(request));

    expect(attempts).toBe(1);
    expect(result.error).toBe(error);
  });

  it("converts unexpected defects to builder errors", async () => {
    const result = await runAsResult(Effect.die(new Error("unexpected")));

    expect(result.data).toBeUndefined();
    expect(result.error).toBeInstanceOf(BuilderInvariantError);
    expect(result.error?.message).toContain("unexpected");
  });
});
