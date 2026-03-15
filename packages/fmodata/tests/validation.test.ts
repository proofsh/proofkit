/**
 * Mock Fetch Tests
 *
 * These tests use captured responses from real FileMaker OData API calls
 * to test the client without requiring a live server connection.
 *
 * The mock responses are stored in tests/fixtures/responses.ts and are
 * captured using the capture script: pnpm capture
 *
 * To add new tests:
 * 1. First, ensure you have a corresponding mock response captured
 * 2. Create a test that uses the same query pattern
 * 3. The mock fetch will automatically match the request URL to the stored response
 */

import { fmTableOccurrence, textField } from "@proofkit/fmodata";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { assert, describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod/v4";
import { contacts, type hobbyEnum, users } from "./utils/test-setup";

describe("Validation Tests", () => {
  describe("validateRecord", () => {
    it("should validate a single record", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/fmdapi_test.fmp12/contacts",
        response: {
          "@context":
            "https://api.example.com/fmi/odata/v4/fmdapi_test.fmp12/$metadata#contacts",
          value: [
            {
              hobby: "Invalid Hobby",
            },
          ],
        },
        status: 200,
      });
      const db = mock.database("fmdapi_test.fmp12");

      const result = await db
        .from(contacts)
        .list()
        .select({ hobby: contacts.hobby })
        .execute();

      assert(result.data, "Result data should be defined");
      const firstRecord = result.data?.[0];
      assert(firstRecord, "First record should be defined");

      // should use catch block to validate the hobby
      expect(firstRecord?.hobby).toBe("Unknown");
    });

    it("should validate records within an expand expression", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/fmdapi_test.fmp12/contacts",
        response: {
          "@context":
            "https://api.example.com/fmi/odata/v4/fmdapi_test.fmp12/$metadata#contacts",
          value: [
            {
              PrimaryKey: "B5BFBC89-03E0-47FC-ABB6-D51401730227",
              CreationTimestamp: "2025-10-31T10:03:27Z",
              CreatedBy: "admin",
              ModificationTimestamp: "2025-10-31T15:55:53Z",
              ModifiedBy: "admin",
              name: "Eric",
              hobby: "Board games",
              id_user: "1A269FA3-82E6-465A-94FA-39EE3F2F9B5D",
              users: [
                {
                  name: "Test User",
                },
              ],
            },
          ],
        },
        status: 200,
      });
      const db = mock.database("fmdapi_test.fmp12");

      const result = await db
        .from(contacts)
        .list()
        .expand(users, (b: any) =>
          b.select({ name: users.name, fake_field: users.fake_field }),
        )
        .execute();

      assert(result.data, "Result data should be defined");
      expect(result.error).toBeUndefined();
      if (!result.data) {
        throw new Error("Expected result.data to be defined");
      }
      const firstRecord = result.data[0];
      if (!firstRecord) {
        throw new Error("Expected firstRecord to be defined");
      }
      assert(firstRecord, "First record should be defined");

      // Verify the contact record is validated
      expect(firstRecord.name).toBe("Eric");
      expect(firstRecord.hobby).toBe("Board games");

      // Verify the expanded users are validated and present
      expect(firstRecord.users).toBeDefined();
      expect(Array.isArray(firstRecord.users)).toBe(true);
      expect(firstRecord.users.length).toBe(1);

      const expandedUser = firstRecord.users[0];
      if (!expandedUser) {
        throw new Error("Expected expandedUser to be defined");
      }

      assert(expandedUser, "Expanded user should be defined");

      // Verify the expanded user fields are validated according to schema
      expect(expandedUser.name).toBe("Test User");
      expect(expandedUser.fake_field).toBe(
        "I only exist in the schema, not the database",
      );
    });
  });
  it("should automatically select only fields in the schema", () => {
    const simpleUsers = fmTableOccurrence("users", {
      id: textField().primaryKey().notNull(),
      name: textField().notNull(),
    });
    const mock = new MockFMServerConnection();
    const db = mock.database("fmdapi_test.fmp12");
    const query = db.from(simpleUsers).list();

    const queryString = query.getQueryString();

    expect(queryString).toContain("$select=");
    expect(queryString).toContain("name");
    expect(queryString).toContain(`"id"`); // must quote the id field
    expect(queryString).not.toContain("$expand");
  });

  it("should skip validation if requested", async () => {
    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/fmdapi_test.fmp12/contacts",
      response: {
        "@context":
          "https://api.example.com/fmi/odata/v4/fmdapi_test.fmp12/$metadata#contacts",
        value: [
          {
            PrimaryKey: "B5BFBC89-03E0-47FC-ABB6-D51401730227",
            hobby: "not a valid hobby",
          },
        ],
      },
      status: 200,
    });
    const db = mock.database("fmdapi_test.fmp12");

    const result = await db.from(contacts).list().execute({
      skipValidation: true,
    });

    expect(result).toBeDefined();
    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    if (!result.data) {
      throw new Error("Expected result.data to be defined");
    }
    expect(Array.isArray(result.data)).toBe(true);

    const firstRecord = result.data[0];
    if (!firstRecord) {
      throw new Error("Expected firstRecord to be defined");
    }
    // types should not change, even if skipValidation is true
    expectTypeOf(firstRecord.hobby).toEqualTypeOf<
      z.infer<typeof hobbyEnum> | null
    >();

    expect(firstRecord?.hobby).toBe("not a valid hobby");
  });

  it("should return odata annotations if requested, even if skipValidation is true", async () => {
    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/fmdapi_test.fmp12/contacts",
      response: {
        "@context":
          "https://api.example.com/fmi/odata/v4/fmdapi_test.fmp12/$metadata#contacts",
        value: [
          {
            "@id":
              "https://api.example.com/fmi/odata/v4/fmdapi_test.fmp12/contacts(B5BFBC89-03E0-47FC-ABB6-D51401730227)",
            "@editLink":
              "https://api.example.com/fmi/odata/v4/fmdapi_test.fmp12/contacts(B5BFBC89-03E0-47FC-ABB6-D51401730227)",
            PrimaryKey: "B5BFBC89-03E0-47FC-ABB6-D51401730227",
            hobby: "not a valid hobby",
          },
        ],
      },
      status: 200,
    });
    const db = mock.database("fmdapi_test.fmp12");

    const result = await db.from(contacts).list().execute({
      skipValidation: true,
      includeODataAnnotations: true,
    });

    expect(result).toBeDefined();
    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    if (!result.data) {
      throw new Error("Expected result.data to be defined");
    }
    expect(Array.isArray(result.data)).toBe(true);

    const firstRecord = result.data[0];
    if (!firstRecord) {
      throw new Error("Expected firstRecord to be defined");
    }
    expect(firstRecord).toHaveProperty("@id");
    expect(firstRecord).toHaveProperty("@editLink");
  });
});
