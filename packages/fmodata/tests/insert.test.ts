/**
 * Insert and Update Tests
 *
 * Tests for the insert() and update() methods with returnFullRecord option.
 */

import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { describe, expect, expectTypeOf, it } from "vitest";
import { mockResponses } from "./fixtures/responses";
import { contacts } from "./utils/test-setup";

const UUID_REGEX = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

describe("insert and update operations with returnFullRecord", () => {
  it("should insert a record and return the created record with metadata", async () => {
    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/fmdapi_test.fmp12/contacts",
      response: mockResponses.insert?.response ?? {},
      status: mockResponses.insert?.status ?? 200,
      headers: mockResponses.insert?.headers,
    });
    const db = mock.database("fmdapi_test.fmp12");

    const result = await db
      .from(contacts)
      .insert({
        name: "Capture test",
      })
      .execute();

    // Verify no errors
    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    // @ts-expect-error - should not return odata annotations
    result.data?.["@editLink"];
    // @ts-expect-error - should not return odata annotations
    result.data?.["@id"];

    expect(result.data).not.toHaveProperty("@editLink");
    expect(result.data).not.toHaveProperty("@id");

    // Verify the inserted record has expected structure (not specific values that change with captures)
    expect(result.data).toHaveProperty("PrimaryKey");
    expect(typeof result.data?.PrimaryKey).toBe("string");
    expect(result.data?.PrimaryKey).toMatch(UUID_REGEX);

    // Check fields that should have stable values
    expect(result.data).toMatchObject({
      name: "Capture test",
      hobby: null,
      id_user: null,
      my_calc: "you betcha",
    });
  });

  it("should allow returnFullRecord=false to get just ROWID", async () => {
    const insertMinimalMock = new MockFMServerConnection();
    insertMinimalMock.addRoute({
      urlPattern: "/fmdapi_test.fmp12/contacts",
      response: mockResponses["insert-return-minimal"]?.response ?? {},
      status: mockResponses["insert-return-minimal"]?.status ?? 200,
      headers: mockResponses["insert-return-minimal"]?.headers,
    });
    const db = insertMinimalMock.database("fmdapi_test.fmp12");

    const result = await db
      .from(contacts)
      .insert(
        {
          name: "Capture test",
        },
        // Set returnFullRecord to false to get just the ROWID
        { returnFullRecord: false },
      )
      .execute();

    // Type check: when returnFullRecord is false, result should only have ROWID
    expectTypeOf(result.data).toEqualTypeOf<{ ROWID: number } | undefined>();

    // Type check: when returnFullRecord is true or omitted, result should have full record
    const insertFullMock = new MockFMServerConnection();
    insertFullMock.addRoute({
      urlPattern: "/fmdapi_test.fmp12/contacts",
      response: mockResponses.insert?.response ?? {},
      status: mockResponses.insert?.status ?? 200,
      headers: mockResponses.insert?.headers,
    });
    const db2 = insertFullMock.database("fmdapi_test.fmp12");

    const fullResult = await db2
      .from(contacts)
      .insert(
        {
          name: "anything",
        },
        { returnFullRecord: true },
      )
      .execute();

    expectTypeOf(fullResult.data).not.toEqualTypeOf<{ ROWID: number } | undefined>();

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();

    // when returnFullRecord=false, the library should extract the ROWID from the location header
    expect(result.data).toHaveProperty("ROWID");
    expect(typeof result.data?.ROWID).toBe("number");
    expect(result.data?.ROWID).toBeGreaterThan(0);
  });

  it("should allow returnFullRecord=true for update to get full record", async () => {
    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/fmdapi_test.fmp12/contacts",
      response: mockResponses.insert?.response ?? {},
      status: mockResponses.insert?.status ?? 200,
      headers: mockResponses.insert?.headers,
    });
    const db = mock.database("fmdapi_test.fmp12");

    // Test with returnFullRecord=true
    const result = await db
      .from(contacts)
      .update({ name: "Updated name" }, { returnFullRecord: true })
      .byId("331F5862-2ABF-4FB6-AA24-A00F7359BDDA")
      .execute();

    // Type check: when returnFullRecord is true, result should have full record
    expectTypeOf(result.data).not.toEqualTypeOf<{ updatedCount: number } | undefined>();

    // Test without returnFullRecord (default - returns count)
    const countResult = await db
      .from(contacts)
      .update({ name: "Updated name" })
      .byId("331F5862-2ABF-4FB6-AA24-A00F7359BDDA")
      .execute();

    // Type check: default should return count
    expectTypeOf(countResult.data).toEqualTypeOf<{ updatedCount: number } | undefined>();

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();

    // when returnFullRecord=true, should return the full updated record
    expect(result.data).toHaveProperty("PrimaryKey");
    expect(typeof result.data?.PrimaryKey).toBe("string");
    expect(result.data?.name).toBe("Capture test"); // From mock response
  });
});
