import { RecordCountMismatchError } from "@proofkit/fmodata";
import {
  processODataResponse,
  processQueryResponse,
  processRecordResponse,
} from "@proofkit/fmodata/client/builders/response-processor";
import { describe, expect, it } from "vitest";

const logger = {
  debug: () => undefined,
  info: () => undefined,
  success: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  get level() {
    return "error" as const;
  },
};

describe("response processor", () => {
  it("renames fields when skipValidation is enabled", async () => {
    const result = await processODataResponse<{ userEmail: string }>(
      { value: [{ email: "john@example.com" }] },
      {
        singleMode: false,
        skipValidation: true,
        fieldMapping: { email: "userEmail" },
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual([{ userEmail: "john@example.com" }]);
  });

  it("returns record count mismatch in exact single mode", async () => {
    const result = await processQueryResponse<{ id: string }>(
      { value: [{ id: "a" }, { id: "b" }] },
      {
        singleMode: "exact",
        queryOptions: {},
        expandConfigs: [],
        skipValidation: true,
        logger,
      },
    );

    expect(result.data).toBeUndefined();
    expect(result.error).toBeInstanceOf(RecordCountMismatchError);
  });

  it("processes record responses through the canonical query flow", async () => {
    const result = await processRecordResponse<{ id: string; alias: string }>(
      { id: "abc", name: "Taylor" },
      {
        selectedFields: ["id", "name"],
        expandConfigs: [],
        skipValidation: true,
        fieldMapping: { name: "alias" },
        logger,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ id: "abc", alias: "Taylor" });
  });
});
