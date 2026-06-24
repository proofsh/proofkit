/**
 * Unit tests for client methods using mocked responses.
 * These tests verify the client behavior without requiring a live FileMaker server.
 */
import { afterEach, describe, expect, it, test, vi } from "vitest";
import { z } from "zod/v4";
import type { Adapter } from "../src/adapters/core";
import type { AllLayoutsMetadataResponse, Layout, ScriptOrFolder, ScriptsMetadataResponse } from "../src/client-types";
import { DataApi, FileMakerError, OttoAdapter } from "../src/index";
import { mockResponses } from "./fixtures/responses";
import { createMockFetch, createMockFetchSequence } from "./utils/mock-fetch";

// Test client factory - creates a client with mocked fetch
function createTestClient(layout = "layout") {
  return DataApi({
    adapter: new OttoAdapter({
      auth: { apiKey: "dk_test_api_key" },
      db: "test",
      server: "https://api.example.com",
    }),
    layout,
  });
}

function createAdapter(overrides: Partial<Adapter>): Adapter {
  return {
    containerUpload: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    executeScript: vi.fn(),
    find: vi.fn(),
    get: vi.fn(),
    layoutMetadata: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    ...overrides,
  } as Adapter;
}

describe("sort methods", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("should sort descending", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["list-sorted-descend"]));
    const client = createTestClient();

    const resp = await client.list({
      sort: { fieldName: "recordId", sortOrder: "descend" },
    });

    expect(resp.data.length).toBe(3);
    const firstRecord = Number.parseInt(resp.data[0]?.fieldData.recordId as string, 10);
    const secondRecord = Number.parseInt(resp.data[1]?.fieldData.recordId as string, 10);
    expect(firstRecord).toBeGreaterThan(secondRecord);
  });

  test("should sort ascending by default", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["list-sorted-ascend"]));
    const client = createTestClient();

    const resp = await client.list({
      sort: { fieldName: "recordId" },
    });

    const firstRecord = Number.parseInt(resp.data[0]?.fieldData.recordId as string, 10);
    const secondRecord = Number.parseInt(resp.data[1]?.fieldData.recordId as string, 10);
    expect(secondRecord).toBeGreaterThan(firstRecord);
  });
});

describe("find methods", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("successful find", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["find-basic"]));
    const client = createTestClient();

    const resp = await client.find({
      query: { anything: "anything" },
    });

    expect(Array.isArray(resp.data)).toBe(true);
    expect(resp.data.length).toBe(2);
  });

  test("successful findFirst with multiple return", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["find-basic"]));
    const client = createTestClient();

    const resp = await client.findFirst({
      query: { anything: "anything" },
    });

    expect(Array.isArray(resp.data)).toBe(false);
    expect(resp.data.fieldData).toBeDefined();
  });

  test("successful findOne", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["find-unique"]));
    const client = createTestClient();

    const resp = await client.findOne({
      query: { anything: "unique" },
    });

    expect(Array.isArray(resp.data)).toBe(false);
  });

  it("findOne with 2 results should fail", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["find-basic"]));
    const client = createTestClient();

    await expect(
      client.findOne({
        query: { anything: "anything" },
      }),
    ).rejects.toThrow();
  });
});

describe("portal methods", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return portal data with default limit", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["list-with-portal-data"]));
    const client = createTestClient();

    const result = await client.list({ limit: 1 });
    expect(result.data[0]?.portalData?.test?.length).toBe(50);
  });

  it("should return portal data with limit and offset", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["list-with-portal-ranges"]));
    const client = createTestClient();

    const { data } = await client.list({
      limit: 1,
      portalRanges: { test: { limit: 1, offset: 2 } },
    });

    expect(data.length).toBe(1);
    const portalData = data[0]?.portalData;
    const testPortal = portalData?.test;
    expect(testPortal?.length).toBe(1);
    expect(testPortal?.[0]?.["related::related_field"]).toContain("2");
  });
});

describe("other methods", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should allow list method without params", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["list-basic"]));
    const client = createTestClient();

    const result = await client.list();
    expect(result.data).toBeDefined();
  });

  it("should rename offset param", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["list-basic"]));
    const client = createTestClient();

    await client.list({ offset: 0 });
  });

  it("should retrieve a list of folders and layouts", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["all-layouts"]));
    const client = createTestClient();

    const resp = (await client.layouts()) as AllLayoutsMetadataResponse;

    expect(Object.hasOwn(resp, "layouts")).toBe(true);
    expect(resp.layouts.length).toBeGreaterThanOrEqual(2);
    expect(resp.layouts[0] as Layout).toHaveProperty("name");
    const layoutFolder = resp.layouts.find((o) => "isFolder" in o);
    expect(layoutFolder).not.toBeUndefined();
    expect(layoutFolder).toHaveProperty("isFolder");
    expect(layoutFolder).toHaveProperty("folderLayoutNames");
  });

  it("should retrieve a list of folders and scripts", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["all-scripts"]));
    const client = createTestClient();

    const resp = (await client.scripts()) as ScriptsMetadataResponse;

    expect(Object.hasOwn(resp, "scripts")).toBe(true);
    expect(resp.scripts.length).toBe(3);
    expect(resp.scripts[0] as ScriptOrFolder).toHaveProperty("name");
    expect(resp.scripts[1] as ScriptOrFolder).toHaveProperty("isFolder");
  });

  it("should retrieve layout metadata", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["layout-metadata"]));
    const client = createTestClient();

    const response = await client.layoutMetadata();

    expect(response).toBeDefined();
    expect(response).toBeTypeOf("object");
    expect(response).toHaveProperty("fieldMetaData");
    expect(response).toHaveProperty("portalMetaData");
    expect(Array.isArray(response.fieldMetaData)).toBe(true);
    expect(typeof response.portalMetaData).toBe("object");

    if (response.fieldMetaData.length > 0) {
      expect(response.fieldMetaData[0]).toHaveProperty("name");
      expect(response.fieldMetaData[0]).toHaveProperty("type");
    }
  });

  it("should paginate through all records", async () => {
    // listAll will make multiple calls until all records are fetched
    vi.stubGlobal(
      "fetch",
      createMockFetchSequence([
        mockResponses["list-with-limit"],
        mockResponses["list-with-limit"],
        mockResponses["list-with-limit"],
      ]),
    );
    const client = createTestClient();

    const data = await client.listAll({ limit: 1 });
    expect(data.length).toBe(3);
  });

  it("should use adapter listAll capability when available", async () => {
    const adapterListAll = vi.fn().mockResolvedValue({
      data: [{ fieldData: { name: "Ada" }, modId: "1", portalData: {}, recordId: "1" }],
      dataInfo: {
        database: "test",
        foundCount: 1,
        layout: "layout",
        returnedCount: 1,
        table: "layout",
        totalRecordCount: 1,
      },
    });
    const adapter = createAdapter({ listAll: adapterListAll });
    const client = DataApi({ adapter, layout: "layout" });

    const data = await client.listAll({
      limit: 25,
      offset: 2,
      sort: { fieldName: "name" },
    });

    expect(data).toHaveLength(1);
    expect(adapter.list).not.toHaveBeenCalled();
    expect(adapterListAll).toHaveBeenCalledWith({
      data: {
        _limit: 25,
        _offset: 2,
        _sort: [{ fieldName: "name" }],
      },
      fetch: undefined,
      layout: "layout",
      timeout: undefined,
    });
  });

  it("should paginate using findAll method", async () => {
    vi.stubGlobal("fetch", createMockFetchSequence([mockResponses["find-basic"], mockResponses["find-no-results"]]));
    const client = createTestClient();

    const data = await client.findAll({
      query: { anything: "anything" },
      limit: 1,
    });

    expect(data.length).toBe(2);
  });

  it("should use adapter findAll capability when available", async () => {
    const adapterFindAll = vi.fn().mockResolvedValue({
      data: [{ fieldData: { name: "Ada" }, modId: "1", portalData: {}, recordId: "1" }],
      dataInfo: {
        database: "test",
        foundCount: 1,
        layout: "layout",
        returnedCount: 1,
        table: "layout",
        totalRecordCount: 1,
      },
    });
    const adapter = createAdapter({ findAll: adapterFindAll });
    const client = DataApi({ adapter, layout: "layout" });

    const data = await client.findAll({
      limit: 50,
      query: { name: "==Ada" },
    });

    expect(data).toHaveLength(1);
    expect(adapter.find).not.toHaveBeenCalled();
    expect(adapterFindAll).toHaveBeenCalledWith({
      data: {
        limit: 50,
        query: [{ name: "==Ada" }],
      },
      fetch: undefined,
      layout: "layout",
      timeout: undefined,
    });
  });

  it("should return from execute script", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["execute-script"]));
    const client = createTestClient();

    const param = JSON.stringify({ hello: "world" });

    const resp = await client.executeScript({
      script: "script",
      scriptParam: param,
    });

    expect(resp.scriptResult).toBe("result");
  });
});

describe("error handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("missing layout should error", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["error-missing-layout"]));
    const client = DataApi({
      adapter: new OttoAdapter({
        auth: { apiKey: "dk_test_api_key" },
        db: "test",
        server: "https://api.example.com",
      }),
      layout: "not_a_layout",
    });

    await client.list().catch((err) => {
      expect(err).toBeInstanceOf(FileMakerError);
      expect(err.code).toBe("105");
    });
  });
});

describe("zod validation", () => {
  const ZCustomer = z.object({ name: z.string(), phone: z.string() });
  const ZPortalTable = z.object({
    "related::related_field": z.string(),
  });

  const ZCustomerPortals = {
    PortalTable: ZPortalTable,
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should pass validation, allow extra fields", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["customer-list"]));

    const client = DataApi({
      adapter: new OttoAdapter({
        auth: { apiKey: "dk_test_api_key" },
        db: "test",
        server: "https://api.example.com",
      }),
      layout: "customer",
      schema: { fieldData: ZCustomer },
    });

    await client.list();
  });

  it("list method: should fail validation when field is missing", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["customer-fields-missing"]));

    const client = DataApi({
      adapter: new OttoAdapter({
        auth: { apiKey: "dk_test_api_key" },
        db: "test",
        server: "https://api.example.com",
      }),
      layout: "customer_fieldsMissing",
      schema: { fieldData: ZCustomer },
    });

    await expect(client.list()).rejects.toBeInstanceOf(Error);
  });

  it("find method: should properly infer from root type", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["customer-find"]));

    const client = DataApi({
      adapter: new OttoAdapter({
        auth: { apiKey: "dk_test_api_key" },
        db: "test",
        server: "https://api.example.com",
      }),
      layout: "customer",
      schema: { fieldData: ZCustomer },
    });

    const resp = await client.find({ query: { name: "test" } });
    const _name = resp.data[0].fieldData.name;
    const _phone = resp.data[0].fieldData.phone;
    expect(_name).toBeDefined();
    expect(_phone).toBeDefined();
  });

  it("client with portal data passed as zod type", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["customer-list"]));

    const client = DataApi({
      adapter: new OttoAdapter({
        auth: { apiKey: "dk_test_api_key" },
        db: "test",
        server: "https://api.example.com",
      }),
      layout: "customer",
      schema: { fieldData: ZCustomer, portalData: ZCustomerPortals },
    });

    const data = await client.list();
    const portalField = data.data[0]?.portalData?.PortalTable?.[0]?.["related::related_field"];
    expect(portalField).toBeDefined();
  });
});

describe("zod transformation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return JS-native types when in the zod schema", async () => {
    vi.stubGlobal("fetch", createMockFetch(mockResponses["layout-transformation"]));

    const customClient = DataApi({
      adapter: new OttoAdapter({
        auth: { apiKey: "dk_test_api_key" },
        db: "test",
        server: "https://api.example.com",
      }),
      layout: "layout",
      schema: {
        fieldData: z.object({
          booleanField: z.coerce.boolean(),
          CreationTimestamp: z.coerce.date(),
        }),
        portalData: {
          test: z.object({
            "related::related_field": z.string(),
            "related::recordId": z.coerce.string(),
          }),
        },
      },
    });

    const data = await customClient.listAll();
    expect(typeof data[0].fieldData.booleanField).toBe("boolean");
    expect(typeof data[0].fieldData.CreationTimestamp).toBe("object");
    const firstPortalRecord = data[0].portalData.test[0];
    expect(typeof firstPortalRecord["related::related_field"]).toBe("string");
    expect(typeof firstPortalRecord["related::recordId"]).toBe("string");
    expect(firstPortalRecord.recordId).not.toBeUndefined();
    expect(firstPortalRecord.modId).not.toBeUndefined();
  });
});
