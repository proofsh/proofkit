import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("fmFetch", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    globalThis.window = {} as Window & typeof globalThis;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (typeof originalWindow === "undefined") {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      globalThis.window = originalWindow;
    }
  });

  it("retries when FileMaker is not yet available", async () => {
    const { fmFetch } = await import("../src/main.ts");
    const performScript = vi.fn();

    const result = fmFetch("LoadData", { id: "123" });
    globalThis.window.FileMaker = {
      PerformScript: performScript,
      PerformScriptWithOption: vi.fn(),
    };

    await vi.advanceTimersByTimeAsync(250);

    expect(performScript).toHaveBeenCalledTimes(1);
    const params = JSON.parse(String(performScript.mock.calls[0]?.[1])) as {
      callback: { fetchId: string };
    };
    globalThis.window.handleFmWVFetchCallback(JSON.stringify({ ok: true }), params.callback.fetchId);
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toEqual({ ok: true });
  });

  it("rejects after three FileMaker availability retries", async () => {
    const { fmFetch } = await import("../src/main.ts");

    const result = fmFetch("LoadData", { id: "123" });
    const rejection = expect(result).rejects.toThrow("'window.FileMaker' was not available");
    await vi.advanceTimersByTimeAsync(1750);

    await rejection;
  });

  it("returns a catchable rejection in callback mode after retries", async () => {
    const { fmFetch } = await import("../src/main.ts");

    const result = fmFetch("LoadData", { id: "123" }, vi.fn());
    const rejection = expect(result).rejects.toThrow("'window.FileMaker' was not available");
    await vi.advanceTimersByTimeAsync(1750);

    await rejection;
  });
});
