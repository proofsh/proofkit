import type { FindOptions, ListOptions, UpdateOptions } from "@proofkit/fmdapi/adapters/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebViewerAdapter } from "../src/adapter.ts";
import { fmFetch } from "../src/main.js";

vi.mock("../src/main.js", () => ({
  fmFetch: vi.fn(),
}));

const FILEMAKER_ERROR_101 = /101/;
const MISSING_FILE_NAME_ERROR = /file name with an extension/;
const UNSUPPORTED_REPETITION_ERROR = /repetitions are not yet supported/;
const FILE_TOO_LARGE_ERROR = /exceeds the Web Viewer limit/;
const UNKNOWN_OUTCOME_ERROR = /outcome of this upload is unknown/;

describe("WebViewerAdapter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(fmFetch).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("batches FileMaker script calls by default", async () => {
    vi.mocked(fmFetch).mockImplementation((_scriptName, data) => {
      const batch = data as {
        requests: Array<{ id: string }>;
      };
      return Promise.resolve({
        responses: batch.requests.map((request) => ({
          id: request.id,
          messages: [{ code: "0" }],
          response: { data: [] },
        })),
      });
    });

    const adapter = new WebViewerAdapter({ scriptName: "execute_data_api" });
    const result = adapter.list({
      data: { _limit: 10 } as unknown as ListOptions["data"],
      layout: "Customers",
    });

    expect(fmFetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(8);

    await expect(result).resolves.toEqual({ data: [] });
    expect(fmFetch).toHaveBeenCalledTimes(1);
    expect(fmFetch).toHaveBeenCalledWith("execute_data_api", {
      batch: true,
      requests: [
        {
          action: "read",
          id: "batch-0",
          layouts: "Customers",
          limit: 10,
          version: "vLatest",
        },
      ],
    });
  });

  it("paginates listAll with bounded reads and batches remaining pages", async () => {
    vi.useRealTimers();
    const totalRecordCount = 1000;
    const getPageResponse = (payload: { limit?: number; offset?: number }) => {
      const limit = payload.limit ?? 100;
      const offset = payload.offset ?? 1;
      const pageEnd = Math.min(offset + limit - 1, totalRecordCount);
      const data =
        offset > totalRecordCount
          ? []
          : Array.from({ length: pageEnd - offset + 1 }, (_, index) => ({
              fieldData: { id: offset + index },
              modId: "0",
              portalData: {},
              recordId: String(offset + index),
            }));
      return {
        data,
        dataInfo: {
          database: "Test",
          foundCount: totalRecordCount,
          layout: "Customers",
          returnedCount: data.length,
          table: "Customers",
          totalRecordCount,
        },
      };
    };

    vi.mocked(fmFetch).mockImplementation((_scriptName, data) => {
      const payload = data as {
        batch?: boolean;
        limit?: number;
        offset?: number;
        requests?: Array<{ id: string; limit?: number; offset?: number }>;
      };
      if (payload.batch) {
        return Promise.resolve({
          responses: payload.requests?.map((request) => ({
            id: request.id,
            messages: [{ code: "0" }],
            response: getPageResponse(request),
          })),
        });
      }
      return Promise.resolve({
        messages: [{ code: "0" }],
        response: getPageResponse(payload),
      });
    });

    const adapter = new WebViewerAdapter({
      batch: { maxSize: 5, windowMs: 0 },
      scriptName: "execute_data_api",
    });
    const result = await adapter.listAll({
      data: { _limit: 100 } as unknown as ListOptions["data"],
      layout: "Customers",
    });

    expect(result.data).toHaveLength(1000);
    expect(result.dataInfo.returnedCount).toBe(1000);
    expect(fmFetch).toHaveBeenCalledTimes(3);
    expect(fmFetch).toHaveBeenNthCalledWith(1, "execute_data_api", {
      batch: true,
      requests: [
        {
          action: "read",
          id: "batch-0",
          layouts: "Customers",
          limit: 100,
          version: "vLatest",
        },
      ],
    });
    expect(fmFetch).toHaveBeenNthCalledWith(2, "execute_data_api", {
      batch: true,
      requests: [
        expect.objectContaining({ action: "read", offset: 101 }),
        expect.objectContaining({ action: "read", offset: 201 }),
        expect.objectContaining({ action: "read", offset: 301 }),
        expect.objectContaining({ action: "read", offset: 401 }),
        expect.objectContaining({ action: "read", offset: 501 }),
      ],
    });
    expect(fmFetch).toHaveBeenNthCalledWith(3, "execute_data_api", {
      batch: true,
      requests: [
        expect.objectContaining({ action: "read", offset: 601 }),
        expect.objectContaining({ action: "read", offset: 701 }),
        expect.objectContaining({ action: "read", offset: 801 }),
        expect.objectContaining({ action: "read", offset: 901 }),
      ],
    });
    for (const call of vi.mocked(fmFetch).mock.calls) {
      expect(JSON.stringify(call[1])).not.toContain("readAll");
      expect(JSON.stringify(call[1])).not.toContain("findAll");
    }
  });

  it("paginates findAll with bounded find requests", async () => {
    const totalRecordCount = 250;
    vi.mocked(fmFetch).mockImplementation((_scriptName, data) => {
      const payload = data as {
        batch?: boolean;
        limit?: number;
        offset?: number;
        requests?: Array<{ id: string; limit?: number; offset?: number }>;
      };
      const getPageResponse = (request: { limit?: number; offset?: number }) => {
        const limit = request.limit ?? 100;
        const offset = request.offset ?? 1;
        const pageEnd = Math.min(offset + limit - 1, totalRecordCount);
        const pageData =
          offset > totalRecordCount
            ? []
            : Array.from({ length: pageEnd - offset + 1 }, (_, index) => ({
                fieldData: { id: offset + index },
                modId: "0",
                portalData: {},
                recordId: String(offset + index),
              }));
        return {
          data: pageData,
          dataInfo: {
            database: "Test",
            foundCount: totalRecordCount,
            layout: "Customers",
            returnedCount: pageData.length,
            table: "Customers",
            totalRecordCount,
          },
        };
      };
      if (payload.batch) {
        return Promise.resolve({
          responses: payload.requests?.map((request) => ({
            id: request.id,
            messages: [{ code: "0" }],
            response: getPageResponse(request),
          })),
        });
      }
      return Promise.resolve({
        messages: [{ code: "0" }],
        response: getPageResponse(payload),
      });
    });

    const adapter = new WebViewerAdapter({ scriptName: "execute_data_api" });
    const result = await adapter.findAll({
      batch: false,
      data: {
        limit: 100,
        query: [{ status: "Active" }],
      } as unknown as FindOptions["data"],
      layout: "Customers",
    });

    expect(result.data).toHaveLength(250);
    expect(fmFetch).toHaveBeenCalledTimes(3);
    expect(fmFetch).toHaveBeenNthCalledWith(1, "execute_data_api", {
      batch: true,
      requests: [
        {
          action: "read",
          id: "batch-0",
          layouts: "Customers",
          limit: 100,
          query: [{ status: "Active" }],
          version: "vLatest",
        },
      ],
    });
    expect(fmFetch).toHaveBeenNthCalledWith(
      2,
      "execute_data_api",
      expect.objectContaining({
        batch: true,
        requests: [expect.objectContaining({ action: "read", limit: 100, offset: 101 })],
      }),
    );
    expect(fmFetch).toHaveBeenNthCalledWith(
      3,
      "execute_data_api",
      expect.objectContaining({
        batch: true,
        requests: [expect.objectContaining({ action: "read", limit: 100, offset: 201 })],
      }),
    );
    for (const call of vi.mocked(fmFetch).mock.calls) {
      expect(JSON.stringify(call[1])).not.toContain("findAll");
    }
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
      batch: true,
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

  it("allows a request to opt out of adapter-level coalescing", async () => {
    vi.mocked(fmFetch).mockImplementation((_scriptName, data) => {
      const payload = data as { batch?: boolean; requests?: Array<{ id: string; layouts: string }>; layouts?: string };
      if (payload.batch) {
        return Promise.resolve({
          responses: payload.requests?.map((request) => ({
            id: request.id,
            messages: [{ code: "0" }],
            response: { layout: request.layouts },
          })),
        });
      }
      return Promise.resolve({
        messages: [{ code: "0" }],
        response: { layout: payload.layouts },
      });
    });

    const adapter = new WebViewerAdapter({
      batch: { windowMs: 8 },
      scriptName: "execute_data_api",
    });
    const unbatched = adapter.list({
      batch: false,
      data: {} as ListOptions["data"],
      layout: "Customers",
    });
    const batched = adapter.list({
      data: {} as ListOptions["data"],
      layout: "Invoices",
    });

    await expect(unbatched).resolves.toEqual({ layout: "Customers" });
    expect(fmFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(8);

    await expect(batched).resolves.toEqual({ layout: "Invoices" });
    expect(fmFetch).toHaveBeenCalledTimes(2);
    expect(fmFetch).toHaveBeenNthCalledWith(
      1,
      "execute_data_api",
      expect.objectContaining({
        batch: true,
        requests: [expect.objectContaining({ layouts: "Customers" })],
      }),
    );
    expect(fmFetch).toHaveBeenNthCalledWith(
      2,
      "execute_data_api",
      expect.objectContaining({
        batch: true,
      }),
    );
  });

  it("keeps opt-out requests separate from queued coalesced requests", async () => {
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
      batch: { windowMs: 8 },
      scriptName: "execute_data_api",
    });
    const coalesced = adapter.list({
      data: {} as ListOptions["data"],
      layout: "Queued",
    });
    const optOut = adapter.list({
      batch: false,
      data: {} as ListOptions["data"],
      layout: "Solo",
    });

    await expect(optOut).resolves.toEqual({ layout: "Solo" });
    expect(fmFetch).toHaveBeenCalledTimes(1);
    expect(fmFetch).toHaveBeenNthCalledWith(
      1,
      "execute_data_api",
      expect.objectContaining({
        requests: [expect.objectContaining({ layouts: "Solo" })],
      }),
    );

    await vi.advanceTimersByTimeAsync(8);

    await expect(coalesced).resolves.toEqual({ layout: "Queued" });
    expect(fmFetch).toHaveBeenCalledTimes(2);
    expect(fmFetch).toHaveBeenNthCalledWith(
      2,
      "execute_data_api",
      expect.objectContaining({
        requests: [expect.objectContaining({ layouts: "Queued" })],
      }),
    );
  });

  it("sends single-request batches when adapter-level batching is disabled", async () => {
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
      batch: false,
      scriptName: "execute_data_api",
    });

    await expect(adapter.list({ data: {} as ListOptions["data"], layout: "Customers" })).resolves.toEqual({
      layout: "Customers",
    });

    expect(fmFetch).toHaveBeenCalledTimes(1);
    expect(fmFetch).toHaveBeenCalledWith("execute_data_api", {
      batch: true,
      requests: [
        {
          action: "read",
          id: "batch-0",
          layouts: "Customers",
          version: "vLatest",
        },
      ],
    });
  });

  it("allows requests to opt in when adapter-level batching is disabled", async () => {
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
      batch: false,
      scriptName: "execute_data_api",
    });
    const first = adapter.list({ batch: true, data: {} as ListOptions["data"], layout: "A" });
    const second = adapter.list({ batch: true, data: {} as ListOptions["data"], layout: "B" });

    expect(fmFetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(8);

    await expect(Promise.all([first, second])).resolves.toEqual([{ layout: "A" }, { layout: "B" }]);
    expect(fmFetch).toHaveBeenCalledTimes(1);
    expect(fmFetch).toHaveBeenCalledWith("execute_data_api", {
      batch: true,
      requests: [
        {
          action: "read",
          id: "batch-0",
          layouts: "A",
          version: "vLatest",
        },
        {
          action: "read",
          id: "batch-1",
          layouts: "B",
          version: "vLatest",
        },
      ],
    });
  });

  it("falls back to unbatched requests when the FileMaker script rejects batch payloads", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(fmFetch).mockImplementation((_scriptName, data) => {
      const payload = data as { batch?: boolean; layouts?: string };
      if (payload.batch) {
        return Promise.resolve({
          messages: [{ code: "1708", message: "Unknown key (batch)" }],
          response: {},
        });
      }
      return Promise.resolve({
        messages: [{ code: "0" }],
        response: { layout: payload.layouts },
      });
    });

    const adapter = new WebViewerAdapter({
      batch: true,
      scriptName: "execute_data_api",
    });
    const first = adapter.list({ data: {} as ListOptions["data"], layout: "Customers" });
    const second = adapter.list({ data: {} as ListOptions["data"], layout: "Invoices" });

    await vi.advanceTimersByTimeAsync(8);

    await expect(Promise.all([first, second])).resolves.toEqual([{ layout: "Customers" }, { layout: "Invoices" }]);
    expect(warnSpy).toHaveBeenCalledWith(
      "[ProofKit] ProofKit called the FileMaker script to execute Data API, but it did not support batching. Install the latest ProofKit add-on in your FileMaker file to get the updated script. Falling back to unbatched requests for this adapter. See https://proofkit.dev/docs/webviewer/batching",
    );
    expect(fmFetch).toHaveBeenCalledTimes(3);
    expect(fmFetch).toHaveBeenNthCalledWith(
      1,
      "execute_data_api",
      expect.objectContaining({
        batch: true,
      }),
    );
    expect(fmFetch).toHaveBeenNthCalledWith(
      2,
      "execute_data_api",
      expect.objectContaining({
        layouts: "Customers",
      }),
    );
    expect(fmFetch).toHaveBeenNthCalledWith(
      3,
      "execute_data_api",
      expect.objectContaining({
        layouts: "Invoices",
      }),
    );

    await expect(adapter.list({ data: {} as ListOptions["data"], layout: "Orders" })).resolves.toEqual({
      layout: "Orders",
    });
    expect(fmFetch).toHaveBeenLastCalledWith(
      "execute_data_api",
      expect.objectContaining({
        layouts: "Orders",
      }),
    );
    expect(fmFetch).not.toHaveBeenLastCalledWith(
      "execute_data_api",
      expect.objectContaining({
        batch: true,
      }),
    );
    warnSpy.mockRestore();
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

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])("falls back to default maxSize for invalid input %s", async (maxSize) => {
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
      batch: { maxSize, windowMs: 100 },
      scriptName: "execute_data_api",
    });
    const requests = Array.from({ length: 20 }, (_, index) =>
      adapter.list({
        data: {} as ListOptions["data"],
        layout: `Layout${index}`,
      }),
    );

    await expect(Promise.all(requests)).resolves.toHaveLength(20);
    expect(fmFetch).toHaveBeenCalledTimes(1);
    for (const call of vi.mocked(fmFetch).mock.calls) {
      const payload = call[1] as { requests: unknown[] };
      expect(payload.requests).toHaveLength(20);
    }
  });

  describe("containerUpload", () => {
    const makeFile = (contents: string, name = "photo.png") => new File([contents], name, { type: "image/png" });

    const okResponse = () => Promise.resolve({ messages: [{ code: "0" }], response: {} });

    it("sends a base64 payload to the container script without batching", async () => {
      vi.useRealTimers();
      vi.mocked(fmFetch).mockImplementation(okResponse);

      const adapter = new WebViewerAdapter({ scriptName: "execute_data_api" });
      await adapter.containerUpload({
        data: {
          containerFieldName: "Photo",
          file: makeFile("hello"),
          recordId: 3,
        },
        layout: "API_Assets",
      });

      expect(fmFetch).toHaveBeenCalledTimes(1);
      expect(fmFetch).toHaveBeenCalledWith("PK_container_upload", {
        base64: btoa("hello"),
        containerFieldName: "Photo",
        fileName: "photo.png",
        layout: "API_Assets",
        recordId: 3,
        repetition: 1,
      });
    });

    it("includes modId only when supplied", async () => {
      vi.useRealTimers();
      vi.mocked(fmFetch).mockImplementation(okResponse);

      const adapter = new WebViewerAdapter({ scriptName: "execute_data_api" });
      await adapter.containerUpload({
        data: {
          containerFieldName: "Photo",
          file: makeFile("hello"),
          modId: 7,
          recordId: 3,
        },
        layout: "API_Assets",
      });

      expect(vi.mocked(fmFetch).mock.calls[0]?.[1]).toMatchObject({ modId: 7 });
    });

    it("honors a custom container script name", async () => {
      vi.useRealTimers();
      vi.mocked(fmFetch).mockImplementation(okResponse);

      const adapter = new WebViewerAdapter({
        container: { scriptName: "My Container Script" },
        scriptName: "execute_data_api",
      });
      await adapter.containerUpload({
        data: { containerFieldName: "Photo", file: makeFile("hi"), recordId: 1 },
        layout: "API_Assets",
      });

      expect(fmFetch).toHaveBeenCalledWith("My Container Script", expect.anything());
    });

    it("throws a FileMakerError when the script reports a failure", async () => {
      vi.useRealTimers();
      vi.mocked(fmFetch).mockResolvedValue({
        messages: [{ code: "101", message: "Record is missing" }],
        response: {},
      });

      const adapter = new WebViewerAdapter({ scriptName: "execute_data_api" });
      await expect(
        adapter.containerUpload({
          data: { containerFieldName: "Photo", file: makeFile("hi"), recordId: 999 },
          layout: "API_Assets",
        }),
      ).rejects.toThrow(FILEMAKER_ERROR_101);
    });

    it("rejects a Blob without a file name", async () => {
      vi.useRealTimers();
      vi.mocked(fmFetch).mockImplementation(okResponse);

      const adapter = new WebViewerAdapter({ scriptName: "execute_data_api" });
      await expect(
        adapter.containerUpload({
          data: {
            containerFieldName: "Photo",
            file: new Blob(["hi"], { type: "image/png" }),
            recordId: 1,
          },
          layout: "API_Assets",
        }),
      ).rejects.toThrow(MISSING_FILE_NAME_ERROR);
      expect(fmFetch).not.toHaveBeenCalled();
    });

    it.each(["photo", "photo.", ".", ""])("rejects the file name %o for lacking an extension", async (name) => {
      vi.useRealTimers();
      vi.mocked(fmFetch).mockImplementation(okResponse);

      const adapter = new WebViewerAdapter({ scriptName: "execute_data_api" });
      await expect(
        adapter.containerUpload({
          data: {
            containerFieldName: "Photo",
            file: new File(["hi"], name, { type: "image/png" }),
            recordId: 1,
          },
          layout: "API_Assets",
        }),
      ).rejects.toThrow(MISSING_FILE_NAME_ERROR);
      expect(fmFetch).not.toHaveBeenCalled();
    });

    it("rejects repetitions above 1 until the script supports them", async () => {
      vi.useRealTimers();
      vi.mocked(fmFetch).mockImplementation(okResponse);

      const adapter = new WebViewerAdapter({ scriptName: "execute_data_api" });
      await expect(
        adapter.containerUpload({
          data: {
            containerFieldName: "Photo",
            file: makeFile("hi"),
            recordId: 1,
            repetition: 2,
          },
          layout: "API_Assets",
        }),
      ).rejects.toThrow(UNSUPPORTED_REPETITION_ERROR);
      expect(fmFetch).not.toHaveBeenCalled();
    });

    it("rejects files larger than maxFileBytes before encoding", async () => {
      vi.useRealTimers();
      vi.mocked(fmFetch).mockImplementation(okResponse);

      const adapter = new WebViewerAdapter({
        container: { maxFileBytes: 4 },
        scriptName: "execute_data_api",
      });
      await expect(
        adapter.containerUpload({
          data: { containerFieldName: "Photo", file: makeFile("way too long"), recordId: 1 },
          layout: "API_Assets",
        }),
      ).rejects.toThrow(FILE_TOO_LARGE_ERROR);
      expect(fmFetch).not.toHaveBeenCalled();
    });

    it("reports an unknown outcome when the script never calls back", async () => {
      vi.mocked(fmFetch).mockImplementation(() => new Promise(() => undefined));

      const adapter = new WebViewerAdapter({
        container: { timeoutMs: 500 },
        scriptName: "execute_data_api",
      });
      const result = adapter.containerUpload({
        data: { containerFieldName: "Photo", file: makeFile("hi"), recordId: 1 },
        layout: "API_Assets",
      });
      const assertion = expect(result).rejects.toThrow(UNKNOWN_OUTCOME_ERROR);

      await vi.advanceTimersByTimeAsync(500);
      await assertion;
    });

    it("marks a timeout as an unknown outcome rather than a failed write", async () => {
      vi.mocked(fmFetch).mockImplementation(() => new Promise(() => undefined));

      const adapter = new WebViewerAdapter({
        container: { timeoutMs: 500 },
        scriptName: "execute_data_api",
      });
      const result = adapter.containerUpload({
        data: { containerFieldName: "Photo", file: makeFile("hi"), recordId: 1 },
        layout: "API_Assets",
      });
      const assertion = expect(result).rejects.toMatchObject({
        name: "ContainerUploadTimeoutError",
        outcome: "unknown",
        scriptName: "PK_container_upload",
        timeoutMs: 500,
      });

      await vi.advanceTimersByTimeAsync(500);
      await assertion;
    });
  });
});
