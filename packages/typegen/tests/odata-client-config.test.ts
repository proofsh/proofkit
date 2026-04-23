import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOdataClientFromConfig } from "../src/server/createDataApiClient";

const CLARIS_PASSWORD_RE = /Claris ID password/i;

describe("createOdataClientFromConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns clarisId authType for fmodata config", async () => {
    process.env.FM_SERVER = "https://example.com";
    process.env.FM_DATABASE = "MyDB.fmp12";
    process.env.CLARIS_ID_USERNAME = "claris-user";
    process.env.CLARIS_ID_PASSWORD = "claris-pass";

    const result = await createOdataClientFromConfig({
      type: "fmodata",
      path: "schema",
      validator: "zod/v4",
      tables: [],
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.authType).toBe("clarisId");
    }
  });

  it("returns missing env error when claris password is absent", async () => {
    process.env.FM_SERVER = "https://example.com";
    process.env.FM_DATABASE = "MyDB.fmp12";
    process.env.CLARIS_ID_USERNAME = "claris-user";
    process.env.CLARIS_ID_PASSWORD = undefined;

    const result = await createOdataClientFromConfig({
      type: "fmodata",
      path: "schema",
      validator: "zod/v4",
      tables: [],
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.message).toMatch(CLARIS_PASSWORD_RE);
    }
  });
});
