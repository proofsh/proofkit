import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEnvValues, validateEnvValues } from "../src/getEnvValues";

describe("getEnvValues + validateEnvValues", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      "FM_SERVER",
      "FM_DATABASE",
      "OTTO_API_KEY",
      "FM_USERNAME",
      "FM_PASSWORD",
      "FM_HTTP_BASE_URL",
      "FM_CONNECTED_FILE_NAME",
      "CUSTOM_SERVER",
      "CUSTOM_DB",
      "CUSTOM_KEY",
      "CUSTOM_HTTP_URL",
      "CUSTOM_HTTP_FILE",
    ]) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("validates standard mode with api key", () => {
    process.env.FM_SERVER = "https://example.com";
    process.env.FM_DATABASE = "MyDB";
    process.env.OTTO_API_KEY = "KEY_test_123";

    const envValues = getEnvValues();
    const result = validateEnvValues(envValues);

    expect(result.success).toBe(true);
    if (result.success && result.mode === "standard") {
      expect(result.mode).toBe("standard");
      expect(result.server).toBe("https://example.com");
      expect(result.db).toBe("MyDB");
      expect(result.auth).toEqual({ apiKey: "KEY_test_123" });
    }
  });

  it("validates fmHttp mode with default env names", () => {
    process.env.FM_HTTP_BASE_URL = "http://127.0.0.1:1365";
    process.env.FM_CONNECTED_FILE_NAME = "MyFile";

    const envValues = getEnvValues();
    const result = validateEnvValues(envValues, undefined, { fmHttp: true });

    expect(result.success).toBe(true);
    if (result.success && result.mode === "fmHttp") {
      expect(result.mode).toBe("fmHttp");
      expect(result.baseUrl).toBe("http://127.0.0.1:1365");
      expect(result.connectedFileName).toBe("MyFile");
    }
  });

  it("returns clear error when fmHttp env vars are missing", () => {
    const envValues = getEnvValues();
    const result = validateEnvValues(envValues, undefined, { fmHttp: true });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toContain("FM_HTTP_BASE_URL");
      expect(result.errorMessage).toContain("FM_CONNECTED_FILE_NAME");
    }
  });

  it("reads custom env variable names", () => {
    process.env.CUSTOM_SERVER = "https://custom.example.com";
    process.env.CUSTOM_DB = "CustomDB";
    process.env.CUSTOM_KEY = "KEY_custom_123";
    process.env.CUSTOM_HTTP_URL = "http://127.0.0.1:1365";
    process.env.CUSTOM_HTTP_FILE = "CustomFile";

    const envValues = getEnvValues({
      server: "CUSTOM_SERVER",
      db: "CUSTOM_DB",
      auth: { apiKey: "CUSTOM_KEY" },
      fmHttp: { baseUrl: "CUSTOM_HTTP_URL", connectedFileName: "CUSTOM_HTTP_FILE" },
    });

    expect(envValues.server).toBe("https://custom.example.com");
    expect(envValues.db).toBe("CustomDB");
    expect(envValues.apiKey).toBe("KEY_custom_123");
    expect(envValues.fmHttpBaseUrl).toBe("http://127.0.0.1:1365");
    expect(envValues.fmHttpConnectedFileName).toBe("CustomFile");
  });
});
