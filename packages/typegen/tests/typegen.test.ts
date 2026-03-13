/**
 * Unit Tests for Typegen (fmdapi)
 *
 * These tests use mocked layout metadata responses to test the code generation
 * logic without requiring a live FileMaker server connection.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod/v4";
import { generateTypedClients } from "../src/typegen";
import type { typegenConfigSingle } from "../src/types";
import { mockLayoutMetadata } from "./fixtures/layout-metadata";
import { createLayoutMetadataMock, createLayoutMetadataSequenceMock } from "./utils/mock-fetch";

// Helper function to get the base path for generated files
function getBaseGenPath(): string {
  return path.resolve(__dirname, "./unit-typegen-output");
}

async function cleanupGeneratedFiles(genPath: string): Promise<void> {
  await fs.rm(genPath, { recursive: true, force: true });
}

describe("typegen unit tests", () => {
  const baseGenPath = getBaseGenPath();

  // Store original env values to restore after tests
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    // Clean up any previous output
    await fs.rm(baseGenPath, { recursive: true, force: true });

    // Save original env
    originalEnv.OTTO_API_KEY = process.env.OTTO_API_KEY;
    originalEnv.FM_SERVER = process.env.FM_SERVER;
    originalEnv.FM_DATABASE = process.env.FM_DATABASE;
    originalEnv.FM_USERNAME = process.env.FM_USERNAME;
    originalEnv.FM_PASSWORD = process.env.FM_PASSWORD;
    originalEnv.FM_HTTP_BASE_URL = process.env.FM_HTTP_BASE_URL;
    originalEnv.FM_CONNECTED_FILE_NAME = process.env.FM_CONNECTED_FILE_NAME;
    // Set mock env values for tests
    // Use valid Otto API key format (KEY_ prefix for Otto v3)
    process.env.OTTO_API_KEY = "KEY_test_api_key_12345";
    process.env.FM_SERVER = "https://test.example.com";
    process.env.FM_DATABASE = "TestDB";
  });

  afterEach(async () => {
    // Restore original env
    for (const key of Object.keys(originalEnv)) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }

    // Clean up generated files
    await cleanupGeneratedFiles(baseGenPath);

    // Restore fetch
    vi.unstubAllGlobals();
  });

  it("generates schema file with basic fields", async () => {
    // Mock fetch to return basic layout metadata
    vi.stubGlobal(
      "fetch",
      createLayoutMetadataMock({
        TestLayout: mockLayoutMetadata["basic-layout"],
      }),
    );

    const config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }> = {
      type: "fmdapi",
      layouts: [
        {
          layoutName: "TestLayout",
          schemaName: "testSchema",
        },
      ],
      path: "unit-typegen-output/basic",
      generateClient: false,
      validator: false,
    };

    await generateTypedClients(config, { cwd: import.meta.dirname });

    // Verify the generated file exists
    const schemaPath = path.join(__dirname, "unit-typegen-output/basic/generated/testSchema.ts");
    const exists = await fs
      .access(schemaPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);

    // Check content has expected fields
    const content = await fs.readFile(schemaPath, "utf-8");
    expect(content).toContain("recordId");
    expect(content).toContain("name");
    expect(content).toContain("email");
    expect(content).toContain("age");
    expect(content).toContain("balance");
    expect(content).toContain("created_at");
  });

  it("generates schema with portal data", async () => {
    vi.stubGlobal(
      "fetch",
      createLayoutMetadataMock({
        CustomerLayout: mockLayoutMetadata["layout-with-portal"],
      }),
    );

    const config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }> = {
      type: "fmdapi",
      layouts: [
        {
          layoutName: "CustomerLayout",
          schemaName: "customer",
        },
      ],
      path: "unit-typegen-output/portal",
      generateClient: false,
      validator: false,
    };

    await generateTypedClients(config, { cwd: import.meta.dirname });

    const schemaPath = path.join(__dirname, "unit-typegen-output/portal/generated/customer.ts");
    const content = await fs.readFile(schemaPath, "utf-8");

    // Check portal-related content
    expect(content).toContain("Orders");
    expect(content).toContain("order_id");
    expect(content).toContain("order_date");
    expect(content).toContain("amount");
  });

  it("generates schema with value lists", async () => {
    vi.stubGlobal(
      "fetch",
      createLayoutMetadataMock({
        StatusLayout: mockLayoutMetadata["layout-with-value-lists"],
      }),
    );

    const config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }> = {
      type: "fmdapi",
      layouts: [
        {
          layoutName: "StatusLayout",
          schemaName: "statusSchema",
          valueLists: "strict",
        },
      ],
      path: "unit-typegen-output/valuelists",
      generateClient: false,
      validator: "zod",
    };

    await generateTypedClients(config, { cwd: import.meta.dirname });

    const schemaPath = path.join(__dirname, "unit-typegen-output/valuelists/generated/statusSchema.ts");
    const content = await fs.readFile(schemaPath, "utf-8");

    // Check value list literals are generated
    expect(content).toContain("Active");
    expect(content).toContain("Inactive");
    expect(content).toContain("Pending");
    expect(content).toContain("High");
    expect(content).toContain("Medium");
    expect(content).toContain("Low");
  });

  it("generates schema with all field types", async () => {
    vi.stubGlobal(
      "fetch",
      createLayoutMetadataMock({
        AllFields: mockLayoutMetadata["layout-all-field-types"],
      }),
    );

    const config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }> = {
      type: "fmdapi",
      layouts: [
        {
          layoutName: "AllFields",
          schemaName: "allFields",
        },
      ],
      path: "unit-typegen-output/allfields",
      generateClient: false,
      validator: false,
    };

    await generateTypedClients(config, { cwd: import.meta.dirname });

    const schemaPath = path.join(__dirname, "unit-typegen-output/allfields/generated/allFields.ts");
    const content = await fs.readFile(schemaPath, "utf-8");

    // Check various field types are present
    expect(content).toContain("text_field");
    expect(content).toContain("number_field");
    expect(content).toContain("date_field");
    expect(content).toContain("time_field");
    expect(content).toContain("timestamp_field");
    expect(content).toContain("container_field");
    expect(content).toContain("calc_field");
    expect(content).toContain("summary_field");
    expect(content).toContain("global_field");
  });

  it("generates zod validators when specified", async () => {
    vi.stubGlobal(
      "fetch",
      createLayoutMetadataMock({
        ZodLayout: mockLayoutMetadata["basic-layout"],
      }),
    );

    const config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }> = {
      type: "fmdapi",
      layouts: [
        {
          layoutName: "ZodLayout",
          schemaName: "zodSchema",
        },
      ],
      path: "unit-typegen-output/zod",
      generateClient: false,
      validator: "zod",
    };

    await generateTypedClients(config, { cwd: import.meta.dirname });

    const schemaPath = path.join(__dirname, "unit-typegen-output/zod/generated/zodSchema.ts");
    const content = await fs.readFile(schemaPath, "utf-8");

    // Check for zod imports and schema definitions
    expect(content).toContain('from "zod');
    expect(content).toContain("z.object");
  });

  it("generates client file when generateClient is true", async () => {
    vi.stubGlobal(
      "fetch",
      createLayoutMetadataMock({
        ClientLayout: mockLayoutMetadata["basic-layout"],
      }),
    );

    const config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }> = {
      type: "fmdapi",
      layouts: [
        {
          layoutName: "ClientLayout",
          schemaName: "clientSchema",
        },
      ],
      path: "unit-typegen-output/client",
      generateClient: true,
      validator: false,
    };

    await generateTypedClients(config, { cwd: import.meta.dirname });

    // Check client file exists
    const clientPath = path.join(__dirname, "unit-typegen-output/client/client/clientSchema.ts");
    const exists = await fs
      .access(clientPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);

    const content = await fs.readFile(clientPath, "utf-8");
    expect(content).toContain("DataApi");
    expect(content).toContain("OttoAdapter");
  });

  it("generates override file that can be edited", async () => {
    vi.stubGlobal(
      "fetch",
      createLayoutMetadataMock({
        OverrideLayout: mockLayoutMetadata["basic-layout"],
      }),
    );

    const config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }> = {
      type: "fmdapi",
      layouts: [
        {
          layoutName: "OverrideLayout",
          schemaName: "overrideSchema",
        },
      ],
      path: "unit-typegen-output/override",
      generateClient: false,
      validator: "zod",
    };

    await generateTypedClients(config, { cwd: import.meta.dirname });

    // Check override file exists
    const overridePath = path.join(__dirname, "unit-typegen-output/override/overrideSchema.ts");
    const exists = await fs
      .access(overridePath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);

    const content = await fs.readFile(overridePath, "utf-8");
    // Override file should re-export from generated
    expect(content).toContain("generated/overrideSchema");
  });

  it("handles multiple layouts in sequence", async () => {
    // Use sequence mock for multiple layouts
    vi.stubGlobal(
      "fetch",
      createLayoutMetadataSequenceMock([mockLayoutMetadata["basic-layout"], mockLayoutMetadata["layout-with-portal"]]),
    );

    const config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }> = {
      type: "fmdapi",
      layouts: [
        {
          layoutName: "Layout1",
          schemaName: "schema1",
        },
        {
          layoutName: "Layout2",
          schemaName: "schema2",
        },
      ],
      path: "unit-typegen-output/multi",
      generateClient: false,
      validator: false,
    };

    await generateTypedClients(config, { cwd: import.meta.dirname });

    // Check both schema files exist
    const schema1Path = path.join(__dirname, "unit-typegen-output/multi/generated/schema1.ts");
    const schema2Path = path.join(__dirname, "unit-typegen-output/multi/generated/schema2.ts");

    const [exists1, exists2] = await Promise.all([
      fs
        .access(schema1Path)
        .then(() => true)
        .catch(() => false),
      fs
        .access(schema2Path)
        .then(() => true)
        .catch(() => false),
    ]);

    expect(exists1).toBe(true);
    expect(exists2).toBe(true);
  });

  it("uses FetchAdapter when username/password env vars are set", async () => {
    // Set username/password instead of API key
    // biome-ignore lint/performance/noDelete: required to unset env vars
    delete process.env.OTTO_API_KEY;
    process.env.FM_USERNAME = "testuser";
    process.env.FM_PASSWORD = "testpass";

    vi.stubGlobal(
      "fetch",
      createLayoutMetadataMock({
        FetchLayout: mockLayoutMetadata["basic-layout"],
      }),
    );

    const config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }> = {
      type: "fmdapi",
      layouts: [
        {
          layoutName: "FetchLayout",
          schemaName: "fetchSchema",
        },
      ],
      path: "unit-typegen-output/fetch",
      generateClient: true,
      envNames: {
        auth: { username: "FM_USERNAME", password: "FM_PASSWORD" },
        server: "FM_SERVER",
        db: "FM_DATABASE",
      },
    };

    await generateTypedClients(config, { cwd: import.meta.dirname });

    const clientPath = path.join(__dirname, "unit-typegen-output/fetch/client/fetchSchema.ts");
    const content = await fs.readFile(clientPath, "utf-8");

    expect(content).toContain("FetchAdapter");
    expect(content).not.toContain("OttoAdapter");
    expect(content).toContain("FM_USERNAME");
    expect(content).toContain("FM_PASSWORD");
  });

  it("handles strictNumbers option", async () => {
    vi.stubGlobal(
      "fetch",
      createLayoutMetadataMock({
        StrictLayout: mockLayoutMetadata["basic-layout"],
      }),
    );

    const config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }> = {
      type: "fmdapi",
      layouts: [
        {
          layoutName: "StrictLayout",
          schemaName: "strictSchema",
          strictNumbers: true,
        },
      ],
      path: "unit-typegen-output/strict",
      generateClient: false,
      validator: "zod",
    };

    await generateTypedClients(config, { cwd: import.meta.dirname });

    const schemaPath = path.join(__dirname, "unit-typegen-output/strict/generated/strictSchema.ts");
    const content = await fs.readFile(schemaPath, "utf-8");

    // With strict numbers, number fields should have stricter validation
    // Check file was generated (content validation depends on implementation)
    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(0);
  });

  it("handles custom client suffix", async () => {
    vi.stubGlobal(
      "fetch",
      createLayoutMetadataMock({
        SuffixLayout: mockLayoutMetadata["basic-layout"],
      }),
    );

    const config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }> = {
      type: "fmdapi",
      layouts: [
        {
          layoutName: "SuffixLayout",
          schemaName: "suffixSchema",
        },
      ],
      path: "unit-typegen-output/suffix",
      generateClient: true,
      clientSuffix: "Layout",
    };

    await generateTypedClients(config, { cwd: import.meta.dirname });

    // Check index file has the custom suffix
    const indexPath = path.join(__dirname, "unit-typegen-output/suffix/client/index.ts");
    const content = await fs.readFile(indexPath, "utf-8");

    expect(content).toContain("suffixSchemaLayout");
  });

  it("generates client using WebViewerAdapter when fmHttp config is provided", async () => {
    process.env.FM_HTTP_BASE_URL = "http://127.0.0.1:1365";
    process.env.FM_CONNECTED_FILE_NAME = "TestFile";

    const fetchMock = vi.fn(
      createLayoutMetadataMock({
        FmHttpLayout: mockLayoutMetadata["basic-layout"],
      }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }> = {
      type: "fmdapi",
      envNames: undefined,
      layouts: [
        {
          layoutName: "FmHttpLayout",
          schemaName: "fmHttpSchema",
        },
      ],
      path: "unit-typegen-output/fm-http",
      generateClient: true,
      validator: false,
      fmHttp: {
        scriptName: "execute_data_api_custom",
      },
    };

    await generateTypedClients(config, { cwd: import.meta.dirname });

    const clientPath = path.join(__dirname, "unit-typegen-output/fm-http/client/fmHttpSchema.ts");
    const content = await fs.readFile(clientPath, "utf-8");

    expect(content).toContain("WebViewerAdapter");
    expect(content).not.toContain("FmHttpAdapter");
    expect(content).not.toContain("FM_HTTP_BASE_URL");
    expect(content).not.toContain("FM_CONNECTED_FILE_NAME");
    expect(content).toContain('scriptName: "execute_data_api_custom"');

    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/callScript");

    const body = JSON.parse(String(init?.body ?? "{}"));
    expect(body.scriptName).toBe("execute_data_api_custom");
    const scriptParam = JSON.parse(String(body.data ?? "{}"));
    expect(scriptParam.action).toBe("metaData");
    expect(scriptParam.layouts).toBe("FmHttpLayout");
  });
});
