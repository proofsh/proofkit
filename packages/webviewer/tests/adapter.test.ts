import type { FindOptions, ListOptions, UpdateOptions } from "@proofkit/fmdapi/dist/esm/adapters/core.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebViewerAdapter } from "../src/adapter.ts";
import { fmFetch } from "../src/main.js";

vi.mock("../src/main.js", () => ({
  fmFetch: vi.fn(),
}));

describe("WebViewerAdapter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(fmFetch).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a single FileMaker script call by default", async () => {
    vi.mocked(fmFetch).mockResolvedValue({
      messages: [{ code: "0" }],
      response: { data: [] },
    });

    const adapter = new WebViewerAdapter({ scriptName: "execute_data_api" });
    await expect(
      adapter.list({
        data: { _limit: 10 } as unknown as ListOptions["data"],
        layout: "Customers",
      }),
    ).resolves.toEqual({ data: [] });

    expect(fmFetch).toHaveBeenCalledTimes(1);
    expect(fmFetch).toHaveBeenCalledWith("execute_data_api", {
      action: "read",
      layouts: "Customers",
      limit: 10,
      version: "vLatest",
    });
  });

  it("sends listAll and findAll as single script-side pagination requests", async () => {
    vi.mocked(fmFetch).mockResolvedValue({
      messages: [{ code: "0" }],
      response: { data: [] },
    });

    const adapter = new WebViewerAdapter({ scriptName: "execute_data_api" });
    await adapter.listAll({
      data: { _limit: 100 } as unknown as ListOptions["data"],
      layout: "Customers",
    });
    await adapter.findAll({
      data: {
        limit: 100,
        query: [{ status: "Active" }],
      } as unknown as FindOptions["data"],
      layout: "Customers",
    });

    expect(fmFetch).toHaveBeenCalledTimes(2);
    expect(fmFetch).toHaveBeenNthCalledWith(1, "execute_data_api", {
      action: "readAll",
      layouts: "Customers",
      limit: 100,
      version: "vLatest",
    });
    expect(fmFetch).toHaveBeenNthCalledWith(2, "execute_data_api", {
      action: "findAll",
      layouts: "Customers",
      limit: 100,
      query: [{ status: "Active" }],
      version: "vLatest",
    });
  });

  it("coalesces adapter requests into one batch envelope when enabled", async () => {
    vi.mocked(fmFetch).mockImplementation((_scriptName, data) => {
      const batch = data as {
        requests: Array<{ action: string; id: string; layouts: string }>;
      };
      return Promise.resolve({
        responses: batch.requests.map((request) => ({
          id: request.id,
          messages: [{ code: "0" }],
          response: {
            action: request.action,
            layout: request.layouts,
          },
        })),
      });
    });

    const adapter = new WebViewerAdapter({
      batch: { windowMs: 8 },
      scriptName: "execute_data_api",
    });
    const listResult = adapter.list({
      data: { _limit: 10 } as unknown as ListOptions["data"],
      layout: "Customers",
    });
    const updateResult = adapter.update({
      data: {
        fieldData: { name: "Ada" },
        recordId: 12,
      } as unknown as UpdateOptions["data"],
      layout: "Customers",
    });

    expect(fmFetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(8);

    await expect(Promise.all([listResult, updateResult])).resolves.toEqual([
      { action: "read", layout: "Customers" },
      { action: "update", layout: "Customers" },
    ]);
    expect(fmFetch).toHaveBeenCalledTimes(1);
    expect(fmFetch).toHaveBeenCalledWith("execute_data_api", {
      proofkitBatch: 1,
      requests: [
        {
          action: "read",
          id: "batch-0",
          layouts: "Customers",
          limit: 10,
          version: "vLatest",
        },
        {
          action: "update",
          fieldData: { name: "Ada" },
          id: "batch-1",
          layouts: "Customers",
          recordId: 12,
          version: "vLatest",
        },
      ],
    });
  });

  it("rejects only the failed item in a batch response", async () => {
    vi.mocked(fmFetch).mockResolvedValue({
      responses: [
        {
          id: "batch-0",
          messages: [{ code: "0" }],
          response: { data: [] },
        },
        {
          id: "batch-1",
          messages: [{ code: "401" }],
          response: {},
        },
      ],
    });

    const adapter = new WebViewerAdapter({
      batch: true,
      scriptName: "execute_data_api",
    });
    const first = adapter.list({ data: {} as ListOptions["data"], layout: "Customers" });
    const second = adapter.list({ data: {} as ListOptions["data"], layout: "Invoices" });
    const secondExpectation = expect(second).rejects.toMatchObject({ code: "401" });

    await vi.advanceTimersByTimeAsync(8);

    await expect(first).resolves.toEqual({ data: [] });
    await secondExpectation;
  });

  it("flushes immediately at maxSize and keeps later requests ordered", async () => {
    vi.mocked(fmFetch).mockImplementation((_scriptName, data) => {
      const batch = data as {
        requests: Array<{ id: string; layouts: string }>;
      };
      return Promise.resolve({
        responses: batch.requests.map((request) => ({
          id: request.id,
          messages: [{ code: "0" }],
          response: { layout: request.layouts },
        })),
      });
    });

    const adapter = new WebViewerAdapter({
      batch: { maxSize: 2, windowMs: 100 },
      scriptName: "execute_data_api",
    });
    const first = adapter.list({ data: {} as ListOptions["data"], layout: "A" });
    const second = adapter.list({ data: {} as ListOptions["data"], layout: "B" });
    const third = adapter.list({ data: {} as ListOptions["data"], layout: "C" });

    await Promise.resolve();
    expect(fmFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);

    await expect(Promise.all([first, second, third])).resolves.toEqual([
      { layout: "A" },
      { layout: "B" },
      { layout: "C" },
    ]);
    expect(fmFetch).toHaveBeenCalledTimes(2);
  });
});
