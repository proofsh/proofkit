import { afterEach, describe, expect, it, vi } from "vitest";
import { FmHttpAdapter } from "../src/adapters/fm-http";
import { FileMakerError } from "../src/client-types";
import { DataApi } from "../src/index";

/** Wraps a FM Data API response in the /callScript envelope */
function callScriptResponse(fmResponse: object, { asString = false } = {}) {
  return {
    result: asString ? JSON.stringify(fmResponse) : fmResponse,
  };
}

function mockFetch(body: object, status = 200): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
}

function createAdapter(opts?: Partial<{ scriptName: string }>) {
  return new FmHttpAdapter({
    baseUrl: "http://localhost:3000",
    connectedFileName: "MyFile",
    ...opts,
  });
}

function createClient(adapter = createAdapter()) {
  return DataApi({ adapter, layout: "TestLayout" });
}

const successEnvelope = (response: unknown) =>
  callScriptResponse({
    messages: [{ code: "0" }],
    response,
  });

const errorEnvelope = (code: string) =>
  callScriptResponse({
    messages: [{ code }],
    response: {},
  });

describe("FmHttpAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("list / read", () => {
    it("sends correct payload to /callScript", async () => {
      const spy = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              successEnvelope({
                data: [],
                dataInfo: { totalRecordCount: 0, foundCount: 0, returnedCount: 0 },
              }),
            ),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
      );
      vi.stubGlobal("fetch", spy);

      const client = createClient();
      await client.list();

      expect(spy).toHaveBeenCalledOnce();
      const [url, init] = spy.mock.calls[0];
      expect(url).toBe("http://localhost:3000/callScript");
      expect(init?.method).toBe("POST");

      const body = JSON.parse(init?.body as string);
      expect(body.connectedFileName).toBe("MyFile");
      expect(body.scriptName).toBe("execute_data_api");

      const param = JSON.parse(body.data);
      expect(param.layouts).toBe("TestLayout");
      expect(param.action).toBe("read");
      expect(param.version).toBe("vLatest");
    });

    it("returns records from list", async () => {
      const records = [
        { fieldData: { name: "A" }, recordId: "1", modId: "1", portalData: {} },
        { fieldData: { name: "B" }, recordId: "2", modId: "1", portalData: {} },
      ];
      vi.stubGlobal(
        "fetch",
        mockFetch(
          successEnvelope({
            data: records,
            dataInfo: { totalRecordCount: 2, foundCount: 2, returnedCount: 2 },
          }),
        ),
      );

      const client = createClient();
      const resp = await client.list();
      expect(resp.data.length).toBe(2);
    });
  });

  describe("create", () => {
    it("sends create action", async () => {
      const spy = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(JSON.stringify(successEnvelope({ recordId: "42", modId: "1" })), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      );
      vi.stubGlobal("fetch", spy);

      const client = createClient();
      const resp = await client.create({ fieldData: { name: "test" } });
      expect(resp.recordId).toBe("42");

      const body = JSON.parse(spy.mock.calls[0][1]?.body as string);
      const param = JSON.parse(body.data);
      expect(param.action).toBe("create");
    });
  });

  describe("update", () => {
    it("sends update action with recordId", async () => {
      const spy = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(JSON.stringify(successEnvelope({ modId: "2" })), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      );
      vi.stubGlobal("fetch", spy);

      const client = createClient();
      const resp = await client.update({ recordId: 1, fieldData: { name: "updated" } });
      expect(resp.modId).toBe("2");

      const body = JSON.parse(spy.mock.calls[0][1]?.body as string);
      const param = JSON.parse(body.data);
      expect(param.action).toBe("update");
      expect(param.fieldData).toEqual({ name: "updated" });
    });
  });

  describe("delete", () => {
    it("sends delete action", async () => {
      const spy = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(JSON.stringify(successEnvelope({})), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      );
      vi.stubGlobal("fetch", spy);

      const client = createClient();
      await client.delete({ recordId: 5 });

      const body = JSON.parse(spy.mock.calls[0][1]?.body as string);
      const param = JSON.parse(body.data);
      expect(param.action).toBe("delete");
      expect(param.recordId).toBe(5);
    });
  });

  describe("layoutMetadata", () => {
    it("sends metaData action", async () => {
      const metadata = {
        fieldMetaData: [{ name: "name", type: "normal" }],
        portalMetaData: {},
      };
      vi.stubGlobal("fetch", mockFetch(successEnvelope(metadata)));

      const client = createClient();
      const resp = await client.layoutMetadata();
      expect(resp.fieldMetaData).toHaveLength(1);
    });
  });

  describe("error handling", () => {
    it("throws FileMakerError on non-0 message code", async () => {
      vi.stubGlobal("fetch", mockFetch(errorEnvelope("401")));

      const client = createClient();
      await expect(client.list()).rejects.toBeInstanceOf(FileMakerError);
      await expect(client.list()).rejects.toHaveProperty("code", "401");
    });

    it("throws FileMakerError on HTTP error", async () => {
      vi.stubGlobal(
        "fetch",
        () => Promise.resolve(new Response("Internal Server Error", { status: 500 })),
      );

      const client = createClient();
      await expect(client.list()).rejects.toBeInstanceOf(FileMakerError);
    });
  });

  describe("string result parsing", () => {
    it("parses result when returned as JSON string", async () => {
      const records = [{ fieldData: { name: "A" }, recordId: "1", modId: "1", portalData: {} }];
      vi.stubGlobal(
        "fetch",
        mockFetch(
          callScriptResponse(
            {
              messages: [{ code: "0" }],
              response: { data: records, dataInfo: { totalRecordCount: 1, foundCount: 1, returnedCount: 1 } },
            },
            { asString: true },
          ),
        ),
      );

      const client = createClient();
      const resp = await client.list();
      expect(resp.data.length).toBe(1);
    });
  });

  describe("custom script name", () => {
    it("uses custom scriptName when provided", async () => {
      const spy = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              successEnvelope({
                data: [],
                dataInfo: { totalRecordCount: 0, foundCount: 0, returnedCount: 0 },
              }),
            ),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
      );
      vi.stubGlobal("fetch", spy);

      const adapter = createAdapter({ scriptName: "my_custom_script" });
      const client = createClient(adapter);
      await client.list();

      const body = JSON.parse(spy.mock.calls[0][1]?.body as string);
      expect(body.scriptName).toBe("my_custom_script");
    });
  });

  describe("underscore param normalization", () => {
    it("converts _offset/_limit/_sort to offset/limit/sort", async () => {
      const spy = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              successEnvelope({
                data: [],
                dataInfo: { totalRecordCount: 0, foundCount: 0, returnedCount: 0 },
              }),
            ),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
      );
      vi.stubGlobal("fetch", spy);

      const client = createClient();
      await client.list({
        offset: 5,
        limit: 10,
        sort: { fieldName: "name", sortOrder: "ascend" },
      });

      const body = JSON.parse(spy.mock.calls[0][1]?.body as string);
      const param = JSON.parse(body.data);
      expect(param.offset).toBe(5);
      expect(param.limit).toBe(10);
      expect(param._offset).toBeUndefined();
      expect(param._limit).toBeUndefined();
    });
  });

  describe("containerUpload", () => {
    it("throws not supported error", () => {
      const adapter = createAdapter();
      expect(() => adapter.containerUpload({} as never)).toThrow("not supported");
    });
  });

  describe("executeScript", () => {
    it("calls /callScript with the given script name", async () => {
      const spy = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(JSON.stringify({ result: "hello" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      );
      vi.stubGlobal("fetch", spy);

      const client = createClient();
      const resp = await client.executeScript({ script: "MyScript", scriptParam: "param1" });

      expect(resp.scriptResult).toBe("hello");
      const body = JSON.parse(spy.mock.calls[0][1]?.body as string);
      expect(body.scriptName).toBe("MyScript");
      expect(body.data).toBe("param1");
      expect(body.connectedFileName).toBe("MyFile");
    });
  });
});
