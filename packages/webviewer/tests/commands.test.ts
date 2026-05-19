import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getWebViewerCommandRegistry,
  initWebViewerCommands,
  registerWebViewerCommand,
  unregisterWebViewerCommand,
} from "../src/commands.ts";

declare module "../src/commands.ts" {
  interface WebViewerCommandRegistry {
    ping: (value: string) => void;
    fail: (value: string) => void;
    noop: () => void;
  }
}

describe("web viewer commands", () => {
  const originalWindow = globalThis.window;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  beforeEach(() => {
    globalThis.window = {} as Window & typeof globalThis;
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    if (typeof originalWindow === "undefined") {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      globalThis.window = originalWindow;
    }

    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  it("returns undefined without window", () => {
    Reflect.deleteProperty(globalThis, "window");

    expect(initWebViewerCommands({ namespace: "noWindow" })).toBeUndefined();
  });

  it("creates window.proofkit by default", () => {
    const registry = initWebViewerCommands({ namespace: "proofkit" });

    expect(registry?.namespace).toBe("proofkit");
    expect(globalThis.window.proofkit).toBe(registry?.target);
  });

  it("buffers missing calls and replays on registration", () => {
    initWebViewerCommands({ namespace: "buffered" });
    const handler = vi.fn();

    globalThis.window.buffered.ping("first");
    globalThis.window.buffered.ping("second");
    const cleanup = registerWebViewerCommand("ping", handler);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, "first");
    expect(handler).toHaveBeenNthCalledWith(2, "second");
    expect(getWebViewerCommandRegistry()?.listPendingCommands()).toEqual([]);

    cleanup();
  });

  it("deletes queue before replay and continues after errors", () => {
    const errors: unknown[] = [];
    initWebViewerCommands({
      namespace: "replay",
      onError: (error) => errors.push(error),
    });
    globalThis.window.replay.fail("bad");
    globalThis.window.replay.ping("ok");

    registerWebViewerCommand("fail", () => {
      throw new Error("boom");
    });
    const handler = vi.fn();
    registerWebViewerCommand("ping", handler);

    expect(errors).toHaveLength(1);
    expect(handler).toHaveBeenCalledWith("ok");
    expect(getWebViewerCommandRegistry()?.listPendingCommands()).toEqual([]);
  });

  it("reports registered command call errors", () => {
    const errors: unknown[] = [];
    initWebViewerCommands({
      namespace: "callErrors",
      onError: (error, context) => errors.push({ error, context }),
    });
    registerWebViewerCommand("fail", () => {
      throw new Error("boom");
    });

    expect(() => globalThis.window.callErrors.fail("bad")).not.toThrow();
    expect(errors).toMatchObject([
      {
        context: {
          name: "fail",
          phase: "call",
        },
      },
    ]);
  });

  it("drops oldest buffered calls past max", () => {
    initWebViewerCommands({ namespace: "bounded", maxBufferedCallsPerCommand: 2 });
    const handler = vi.fn();

    globalThis.window.bounded.ping("one");
    globalThis.window.bounded.ping("two");
    globalThis.window.bounded.ping("three");
    registerWebViewerCommand("ping", handler);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, "two");
    expect(handler).toHaveBeenNthCalledWith(2, "three");
    expect(console.warn).toHaveBeenCalledWith('[webviewer commands] dropping oldest buffered call for "ping"');
  });

  it("supports drop, warn, and throw missing command modes", () => {
    initWebViewerCommands({ namespace: "dropper", missingCommand: "drop" });
    globalThis.window.dropper.ping("drop");

    initWebViewerCommands({ namespace: "warner", missingCommand: "warn" });
    globalThis.window.warner.ping("warn");

    initWebViewerCommands({ namespace: "thrower", missingCommand: "throw" });

    expect(() => globalThis.window.thrower.ping("throw")).toThrow('[webviewer commands] missing command "ping"');
    expect(console.warn).toHaveBeenCalledWith('[webviewer commands] missing command "ping"');
  });

  it("cleanup only removes the same handler", () => {
    initWebViewerCommands({ namespace: "cleanup" });
    const first = vi.fn();
    const second = vi.fn();

    const firstCleanup = registerWebViewerCommand("ping", first);
    const secondCleanup = registerWebViewerCommand("ping", second);
    firstCleanup();
    globalThis.window.cleanup.ping("value");

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("value");

    secondCleanup();
    expect("ping" in globalThis.window.cleanup).toBe(false);
  });

  it("lists registered commands through proxy traps", () => {
    initWebViewerCommands({ namespace: "listed" });
    const cleanup = registerWebViewerCommand("noop", () => undefined);

    expect(Object.keys(globalThis.window.listed)).toEqual(["noop"]);
    expect("noop" in globalThis.window.listed).toBe(true);
    expect(getWebViewerCommandRegistry()?.listRegisteredCommands()).toEqual(["noop"]);

    cleanup();
  });

  it("custom namespace init is idempotent", () => {
    const first = initWebViewerCommands({ namespace: "custom" });
    const second = initWebViewerCommands({ namespace: "custom" });

    expect(second).toBe(first);
    expect(globalThis.window.custom).toBe(first?.target);
  });

  it("preserves existing namespaces", () => {
    globalThis.window.occupied = { existing: true };

    expect(initWebViewerCommands({ namespace: "occupied" })).toBeUndefined();
    expect(globalThis.window.occupied).toEqual({ existing: true });
    expect(console.warn).toHaveBeenCalledWith(
      "[webviewer commands] window.occupied already exists; preserving existing value",
    );
  });

  it("unregisters active handlers", () => {
    initWebViewerCommands({ namespace: "unregister" });
    registerWebViewerCommand("noop", () => undefined);

    unregisterWebViewerCommand("noop");

    expect("noop" in globalThis.window.unregister).toBe(false);
  });
});
