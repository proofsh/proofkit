import type { HtmlTagDescriptor } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildMockScriptTag,
  defaultWsUrl,
  discoverConnectedFileName,
  fmBridge,
  resolveWsUrl,
} from "../src/fm-bridge.ts";

describe("resolveWsUrl", () => {
  it("prefers an explicit websocket URL", () => {
    expect(
      resolveWsUrl({
        fmHttpBaseUrl: "http://localhost:1365",
        wsUrl: "ws://example.test/custom",
      }),
    ).toBe("ws://example.test/custom");
  });

  it("derives the websocket URL from the HTTP base URL", () => {
    expect(
      resolveWsUrl({
        fmHttpBaseUrl: "https://example.test:9999/",
      }),
    ).toBe("wss://example.test:9999/ws");
  });

  it("falls back to the default websocket URL for invalid base URLs", () => {
    expect(
      resolveWsUrl({
        fmHttpBaseUrl: "not a url",
      }),
    ).toBe(defaultWsUrl);
  });
});

describe("buildMockScriptTag", () => {
  it("builds the fm-mock script tag with required query params", () => {
    const tag = buildMockScriptTag({
      baseUrl: "http://localhost:1365/",
      fileName: "Contacts",
      wsUrl: "ws://localhost:1365/ws",
      debug: true,
    });

    expect(tag).toEqual({
      tag: "script",
      attrs: {
        src: "http://localhost:1365/fm-mock.js?fileName=Contacts&wsUrl=ws%3A%2F%2Flocalhost%3A1365%2Fws&debug=true",
      },
      injectTo: "head-prepend",
    } satisfies HtmlTagDescriptor);
  });
});

describe("discoverConnectedFileName", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the first non-empty connected file name", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(["", "Contacts", "Invoices"]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(discoverConnectedFileName("http://localhost:1365")).resolves.toBe("Contacts");
    expect(globalThis.fetch).toHaveBeenCalledWith("http://localhost:1365/connectedFiles");
  });

  it("rejects non-ok HTTP responses", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("nope", { status: 503 }));

    await expect(discoverConnectedFileName("http://localhost:1365")).rejects.toThrow(
      "fmBridge received HTTP 503 from http://localhost:1365/connectedFiles. Ensure fm-http is healthy and reachable.",
    );
  });

  it("rejects invalid payloads", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ fileName: "Contacts" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(discoverConnectedFileName("http://localhost:1365")).rejects.toThrow(
      "fmBridge expected an array response from http://localhost:1365/connectedFiles.",
    );
  });

  it("rejects when no connected files are available", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(["", "   "]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(discoverConnectedFileName("http://localhost:1365")).rejects.toThrow(
      "fmBridge found no connected FileMaker files at http://localhost:1365/connectedFiles. Open FileMaker and load /webviewer?fileName=YourFile.",
    );
  });
});

describe("fmBridge", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("injects the bridge script in serve mode", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(["Contacts"]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const plugin = fmBridge({
      fmHttpBaseUrl: "http://localhost:1365",
      debug: true,
    });

    if (typeof plugin.apply === "function") {
      expect(plugin.apply({} as never, { command: "serve", mode: "development" } as never)).toBe(true);
    }

    const tags = await plugin.transformIndexHtml?.("");

    expect(tags).toEqual([
      {
        tag: "script",
        attrs: {
          src: "http://localhost:1365/fm-mock.js?fileName=Contacts&wsUrl=ws%3A%2F%2Flocalhost%3A1365%2Fws&debug=true",
        },
        injectTo: "head-prepend",
      },
    ]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("opts out of build mode", async () => {
    const plugin = fmBridge({
      fmHttpBaseUrl: "http://localhost:1365",
    });

    expect(typeof plugin.apply).toBe("function");
    if (typeof plugin.apply !== "function") {
      return;
    }

    expect(plugin.apply({} as never, { command: "build", mode: "production" } as never)).toBe(false);
    await expect(plugin.transformIndexHtml?.("")).resolves.toBeUndefined();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
