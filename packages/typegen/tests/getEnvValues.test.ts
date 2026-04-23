import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEnvValues, validateEnvValues } from "../src/getEnvValues";

const CLARIS_AUTH_RE = /Claris ID authentication/i;

describe("getEnvValues + validateEnvValues", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      "FM_SERVER",
      "FM_DATABASE",
      "OTTO_API_KEY",
      "CLARIS_ID_USERNAME",
      "CLARIS_ID_PASSWORD",
      "FM_USERNAME",
      "FM_PASSWORD",
      "FM_MCP_BASE_URL",
      "FM_CONNECTED_FILE_NAME",
      "CUSTOM_SERVER",
      "CUSTOM_DB",
      "CUSTOM_KEY",
      "CUSTOM_CLARIS_USER",
      "CUSTOM_CLARIS_PASS",
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

  it("validates fmMcp mode with default env names", () => {
    process.env.FM_MCP_BASE_URL = "http://127.0.0.1:1365";
    process.env.FM_CONNECTED_FILE_NAME = "MyFile";

    const envValues = getEnvValues();
    const result = validateEnvValues(envValues, undefined, { fmMcp: true });

    expect(result.success).toBe(true);
    if (result.success && result.mode === "fmMcp") {
      expect(result.mode).toBe("fmMcp");
      expect(result.baseUrl).toBe("http://127.0.0.1:1365");
      expect(result.connectedFileName).toBe("MyFile");
    }
  });

  it("validates standard mode with Claris ID auth when enabled", () => {
    process.env.FM_SERVER = "https://example.com";
    process.env.FM_DATABASE = "MyDB";
    process.env.CLARIS_ID_USERNAME = "claris-user";
    process.env.CLARIS_ID_PASSWORD = "claris-pass";

    const envValues = getEnvValues();
    const result = validateEnvValues(envValues, undefined, { allowClarisId: true });

    expect(result.success).toBe(true);
    if (result.success && result.mode === "standard") {
      expect(result.auth).toEqual({
        clarisId: {
          username: "claris-user",
          password: "claris-pass",
        },
      });
    }
  });

  it("requires Claris ID password when using Claris ID auth", () => {
    process.env.FM_SERVER = "https://example.com";
    process.env.FM_DATABASE = "MyDB";
    process.env.CLARIS_ID_USERNAME = "claris-user";

    const envValues = getEnvValues();
    const result = validateEnvValues(envValues, undefined, { allowClarisId: true });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toMatch(CLARIS_AUTH_RE);
    }
  });

  it("defaults baseUrl and allows empty connectedFileName for auto-discovery when fmMcp env vars are missing", () => {
    const envValues = getEnvValues();
    const result = validateEnvValues(envValues, undefined, { fmMcp: true });

    expect(result.success).toBe(true);
    if (result.success && result.mode === "fmMcp") {
      expect(result.baseUrl).toBe("http://127.0.0.1:1365");
      expect(result.connectedFileName).toBe("");
    }
  });

  it("uses config values over env vars for fmMcp", () => {
    process.env.FM_MCP_BASE_URL = "http://env-url:9999";
    process.env.FM_CONNECTED_FILE_NAME = "EnvFile";

    const envValues = getEnvValues();
    const result = validateEnvValues(envValues, undefined, {
      fmMcp: true,
      fmMcpConfig: { baseUrl: "http://config-url:1234", connectedFileName: "ConfigFile" },
    });

    expect(result.success).toBe(true);
    if (result.success && result.mode === "fmMcp") {
      expect(result.baseUrl).toBe("http://config-url:1234");
      expect(result.connectedFileName).toBe("ConfigFile");
    }
  });

  it("reads custom env variable names", () => {
    process.env.CUSTOM_SERVER = "https://custom.example.com";
    process.env.CUSTOM_DB = "CustomDB";
    process.env.CUSTOM_KEY = "KEY_custom_123";
    process.env.CUSTOM_CLARIS_USER = "claris-user";
    process.env.CUSTOM_CLARIS_PASS = "claris-pass";
    process.env.CUSTOM_HTTP_URL = "http://127.0.0.1:1365";
    process.env.CUSTOM_HTTP_FILE = "CustomFile";

    const envValues = getEnvValues({
      server: "CUSTOM_SERVER",
      db: "CUSTOM_DB",
      auth: {
        apiKey: "CUSTOM_KEY",
        clarisIdUsername: "CUSTOM_CLARIS_USER",
        clarisIdPassword: "CUSTOM_CLARIS_PASS",
      },
      fmMcp: { baseUrl: "CUSTOM_HTTP_URL", connectedFileName: "CUSTOM_HTTP_FILE" },
    });

    expect(envValues.server).toBe("https://custom.example.com");
    expect(envValues.db).toBe("CustomDB");
    expect(envValues.apiKey).toBe("KEY_custom_123");
    expect(envValues.clarisIdUsername).toBe("claris-user");
    expect(envValues.clarisIdPassword).toBe("claris-pass");
    expect(envValues.fmMcpBaseUrl).toBe("http://127.0.0.1:1365");
    expect(envValues.fmMcpConnectedFileName).toBe("CustomFile");
  });
});
