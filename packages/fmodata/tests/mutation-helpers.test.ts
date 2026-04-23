import {
  buildMutationUrl,
  buildRecordLocatorSegment,
  extractAffectedRows,
  parseRowIdFromLocationHeader,
  stripTablePathPrefix,
} from "@proofkit/fmodata/client/builders/mutation-helpers";
import { InvalidLocationHeaderError } from "@proofkit/fmodata/errors";
import { describe, expect, it } from "vitest";

describe("mutation helpers", () => {
  it("builds byId mutation URLs", () => {
    const url = buildMutationUrl({
      databaseName: "test_db",
      tableId: "users",
      tableName: "users",
      mode: "byId",
      recordLocator: "abc-123",
      builderName: "TestBuilder",
    });

    expect(url).toBe("/test_db/users('abc-123')");
  });

  it("builds byId mutation URLs with ROWID locator", () => {
    const url = buildMutationUrl({
      databaseName: "test_db",
      tableId: "users",
      tableName: "users",
      mode: "byId",
      recordLocator: { ROWID: 2 },
      builderName: "TestBuilder",
    });

    expect(url).toBe("/test_db/users(ROWID=2)");
  });

  it("escapes string record locators for OData", () => {
    expect(buildRecordLocatorSegment("abc'def")).toBe("('abc''def')");
  });

  it("builds byFilter mutation URLs and rewrites table prefix", () => {
    const queryBuilder = {
      getQueryString: () => "/users?$filter=name eq 'John'&$top=10",
    };

    const url = buildMutationUrl({
      databaseName: "test_db",
      tableId: "FMTID:555",
      tableName: "users",
      mode: "byFilter",
      queryBuilder,
      builderName: "TestBuilder",
    });

    expect(url).toBe("/test_db/FMTID:555?$filter=name eq 'John'&$top=10");
    expect(stripTablePathPrefix("/FMTID:555?$filter=active eq true", "FMTID:555", "users")).toBe(
      "?$filter=active eq true",
    );
  });

  it("extracts affected rows from headers and body fallbacks", () => {
    const headers = new Headers({ "fmodata.affected_rows": "7" });
    expect(extractAffectedRows(undefined, headers, 0, "updatedCount")).toBe(7);
    expect(extractAffectedRows({ updatedCount: 3 }, undefined, 0, "updatedCount")).toBe(3);
    expect(extractAffectedRows({ deletedCount: 2 }, undefined, 0, "deletedCount")).toBe(2);
    expect(extractAffectedRows(9, undefined, 0, "deletedCount")).toBe(9);
    expect(extractAffectedRows(undefined, undefined, 11, "deletedCount")).toBe(11);
  });

  it("parses row id from location header", () => {
    expect(parseRowIdFromLocationHeader("contacts(ROWID=4583)")).toBe(4583);
    expect(parseRowIdFromLocationHeader("contacts('42')")).toBe(42);
    expect(() => parseRowIdFromLocationHeader(undefined)).toThrow(InvalidLocationHeaderError);
    expect(() => parseRowIdFromLocationHeader("contacts('abc')")).toThrow(InvalidLocationHeaderError);
  });
});
