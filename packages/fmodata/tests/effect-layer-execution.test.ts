import { HTTPError } from "@proofkit/fmodata";
import { requestFromService, runLayerOrThrow, runLayerResult } from "@proofkit/fmodata/effect";
import { HttpClient, ODataConfig, ODataLogger } from "@proofkit/fmodata/services";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

const logger = {
  debug: () => undefined,
  info: () => undefined,
  success: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  get level() {
    return "error" as const;
  },
};

const baseConfig = {
  baseUrl: "https://example.com",
  databaseName: "test_db",
  useEntityIds: false,
  includeSpecialColumns: false,
};

describe("effect layer execution helpers", () => {
  it("maps successful layered execution to Result", async () => {
    const layer = Layer.mergeAll(
      Layer.succeed(HttpClient, {
        request: <T>() => Effect.succeed({ ok: true } as T),
      }),
      Layer.succeed(ODataConfig, baseConfig),
      Layer.succeed(ODataLogger, { logger }),
    );

    const result = await runLayerResult(layer, requestFromService<{ ok: boolean }>("/health"), "fmodata.test.success");
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ ok: true });
  });

  it("throws when using runLayerOrThrow on failure", async () => {
    const layer = Layer.mergeAll(
      Layer.succeed(HttpClient, {
        request: () => Effect.fail(new HTTPError("/broken", 500, "Server Error")),
      }),
      Layer.succeed(ODataConfig, baseConfig),
      Layer.succeed(ODataLogger, { logger }),
    );

    await expect(runLayerOrThrow(layer, requestFromService("/broken"), "fmodata.test.failure")).rejects.toBeInstanceOf(
      HTTPError,
    );
  });
});
