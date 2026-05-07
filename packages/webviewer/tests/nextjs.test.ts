import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildNoConnectedFilesRuntimeError } from "../src/fm-bridge.ts";

vi.mock("react", () => ({
  createElement: (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => ({
    type,
    props: {
      ...props,
      children,
    },
  }),
}));

vi.mock("next/script", () => ({
  default: "NextScript",
}));

const nextjsModulePromise = import("../src/nextjs.ts");

describe("getFmBridgeScriptProps", () => {
  const originalFetch = globalThis.fetch;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalConsoleError = console.error;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
    process.env.NODE_ENV = "development";
    console.error = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
    console.error = originalConsoleError;
    if (typeof originalWindow === "undefined") {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      globalThis.window = originalWindow;
    }
  });

  it("returns null in production by default", async () => {
    process.env.NODE_ENV = "production";
    const { getFmBridgeScriptProps } = await nextjsModulePromise;

    await expect(getFmBridgeScriptProps()).resolves.toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns a beforeInteractive script src when a file is connected", async () => {
    const { getFmBridgeScriptProps } = await nextjsModulePromise;
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(["Contacts"]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      getFmBridgeScriptProps({
        fmMcpBaseUrl: "http://localhost:1365",
        debug: true,
      }),
    ).resolves.toEqual({
      strategy: "beforeInteractive",
      src: "http://localhost:1365/fm-mock.js?fileName=Contacts&wsUrl=ws%3A%2F%2Flocalhost%3A1365%2Fws&debug=true",
    });
  });

  it("returns inline fallback script props when no file is connected", async () => {
    const { getFmBridgeScriptProps } = await nextjsModulePromise;
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const script = await getFmBridgeScriptProps({
      fmMcpBaseUrl: "http://localhost:1365",
    });

    expect(script).toMatchObject({
      strategy: "beforeInteractive",
      id: "proofkit-fm-bridge-fallback",
    });
    expect(script?.dangerouslySetInnerHTML?.__html).toContain(
      buildNoConnectedFilesRuntimeError("http://localhost:1365/connectedFiles"),
    );
  });

  it("returns inline fallback script props when connected file discovery throws", async () => {
    const { getFmBridgeScriptProps } = await nextjsModulePromise;
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("boom"));

    const script = await getFmBridgeScriptProps({
      fmMcpBaseUrl: "http://localhost:1365",
    });

    expect(script).toMatchObject({
      strategy: "beforeInteractive",
      id: "proofkit-fm-bridge-fallback",
    });
    expect(script?.dangerouslySetInnerHTML?.__html).toContain(
      buildNoConnectedFilesRuntimeError("http://localhost:1365/connectedFiles"),
    );
  });

  it("fallback script reports runtime errors through browser stubs", async () => {
    const { getFmBridgeScriptProps } = await nextjsModulePromise;
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const script = await getFmBridgeScriptProps({
      fmMcpBaseUrl: "http://localhost:1365",
    });

    globalThis.window = {} as Window & typeof globalThis;
    new Function(script?.dangerouslySetInnerHTML?.__html ?? "")();

    globalThis.window.filemaker?.("TestScript", "{}");
    globalThis.window.FileMaker?.PerformScript("TestScript", "{}");

    expect(console.error).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenNthCalledWith(
      1,
      buildNoConnectedFilesRuntimeError("http://localhost:1365/connectedFiles"),
    );
    expect(console.error).toHaveBeenNthCalledWith(
      2,
      buildNoConnectedFilesRuntimeError("http://localhost:1365/connectedFiles"),
    );
  });
});

describe("FmBridgeScript", () => {
  const originalFetch = globalThis.fetch;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("renders null in production", async () => {
    process.env.NODE_ENV = "production";
    const { FmBridgeScript } = await nextjsModulePromise;
    await expect(FmBridgeScript()).resolves.toBeNull();
  });

  it("renders next/script with resolved src props", async () => {
    const { FmBridgeScript } = await nextjsModulePromise;
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(["Contacts"]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const element = await FmBridgeScript({
      debug: true,
    });

    expect(element).toMatchObject({
      props: {
        script: {
          strategy: "beforeInteractive",
          src: "http://localhost:1365/fm-mock.js?fileName=Contacts&wsUrl=ws%3A%2F%2Flocalhost%3A1365%2Fws&debug=true",
        },
      },
    });
  });
});

describe("ResolvedFmBridgeScript", () => {
  it("renders null when script props are null", () => {
    return nextjsModulePromise.then(({ ResolvedFmBridgeScript }) => {
      expect(ResolvedFmBridgeScript({ script: null })).toBeNull();
    });
  });

  it("renders next/script with provided props", () => {
    return nextjsModulePromise.then(({ ResolvedFmBridgeScript }) => {
      expect(
        ResolvedFmBridgeScript({
          script: {
            strategy: "beforeInteractive",
            src: "http://localhost:1365/fm-mock.js?fileName=Contacts&wsUrl=ws%3A%2F%2Flocalhost%3A1365%2Fws",
          },
        }),
      ).toMatchObject({
        props: {
          strategy: "beforeInteractive",
          src: "http://localhost:1365/fm-mock.js?fileName=Contacts&wsUrl=ws%3A%2F%2Flocalhost%3A1365%2Fws",
        },
      });
    });
  });
});
