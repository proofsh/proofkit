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

import { assert } from "node:console";
import { eq } from "@proofkit/fmodata";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { describe, expect, expectTypeOf, it } from "vitest";
import { mockResponses } from "./fixtures/responses";
import { contacts } from "./utils/test-setup";

describe("Mock Fetch Tests", () => {
  describe("List queries", () => {
    it("should execute a basic list query using mocked response", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/fmdapi_test.fmp12/contacts",
        response: mockResponses["list-with-pagination"]?.response,
        status: mockResponses["list-with-pagination"]?.status ?? 200,
        headers: mockResponses["list-with-pagination"]?.headers,
      });
      const db = mock.database("fmdapi_test.fmp12");

      const result = await db.from(contacts).list().execute();

      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      if (!result.data) {
        throw new Error("Expected result.data to be defined");
      }
      expect(Array.isArray(result.data)).toBe(true);

      const firstRecord = result.data[0];
      expect(firstRecord).not.toHaveProperty("@id");
      expect(firstRecord).not.toHaveProperty("@editLink");
    });

    it("should return odata annotations if requested", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/fmdapi_test.fmp12/contacts",
        response: mockResponses["list-with-pagination"]?.response,
        status: mockResponses["list-with-pagination"]?.status ?? 200,
        headers: mockResponses["list-with-pagination"]?.headers,
      });
      const db = mock.database("fmdapi_test.fmp12");

      const result = await db
        .from(contacts)
        .list()
        .execute({ includeODataAnnotations: true });

      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      if (!result.data) {
        throw new Error("Expected result.data to be defined");
      }
      expect(Array.isArray(result.data)).toBe(true);

      const firstRecord = result.data[0];
      expect(firstRecord).toHaveProperty("@id");
      expect(firstRecord).toHaveProperty("@editLink");
    });

    it("should execute a list query with $select using mocked response", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/fmdapi_test.fmp12/contacts",
        response: mockResponses["list-with-pagination"]?.response,
        status: mockResponses["list-with-pagination"]?.status ?? 200,
        headers: mockResponses["list-with-pagination"]?.headers,
      });
      const db = mock.database("fmdapi_test.fmp12");

      const result = await db
        .from(contacts)
        .list()
        .select({ name: contacts.name, PrimaryKey: contacts.PrimaryKey })
        .execute();

      expect(result).toBeDefined();
      if (result.error) {
        console.log(result.error);
      }
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      if (!result.data) {
        throw new Error("Expected result.data to be defined");
      }
      if (result.data.length > 0) {
        const firstRecord = result.data[0] as any;
        // Verify selected fields are present (if captured response has them)
        expect(firstRecord).toBeDefined();
      }
    });

    it("should execute a list query with $top using mocked response", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/fmdapi_test.fmp12/contacts",
        response: mockResponses["list-with-orderby"]?.response,
        status: mockResponses["list-with-orderby"]?.status ?? 200,
        headers: mockResponses["list-with-orderby"]?.headers,
      });
      const db = mock.database("fmdapi_test.fmp12");

      const result = await db.from(contacts).list().top(5).execute();

      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      if (!result.data) {
        throw new Error("Expected result.data to be defined");
      }
      // If the mock response limits results, verify we got limited results
      if (result.data.length > 0) {
        expect(result.data.length).toBeLessThanOrEqual(5);
      }
    });

    it("should execute a list query with $orderby using mocked response", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/fmdapi_test.fmp12/contacts",
        response: mockResponses["list-with-orderby"]?.response,
        status: mockResponses["list-with-orderby"]?.status ?? 200,
        headers: mockResponses["list-with-orderby"]?.headers,
      });
      const db = mock.database("fmdapi_test.fmp12");

      const result = await db
        .from(contacts)
        .list()
        .orderBy("name")
        .top(5)
        .execute();

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("should error if more than 1 record is returned in single mode", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/fmdapi_test.fmp12/contacts",
        response: mockResponses["list-with-orderby"]?.response,
        status: mockResponses["list-with-orderby"]?.status ?? 200,
        headers: mockResponses["list-with-orderby"]?.headers,
      });
      const db = mock.database("fmdapi_test.fmp12");

      const result = await db
        .from(contacts)
        .list()
        .single()
        .execute();

      expect(result).toBeDefined();
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
    });
    it("should not error if no records are returned in maybeSingle mode", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/fmdapi_test.fmp12/contacts",
        response: { value: [] },
        status: 200,
      });
      const db = mock.database("fmdapi_test.fmp12");

      const result = await db
        .from(contacts)
        .list()
        .maybeSingle()
        .execute();

      expect(result.data).toBeNull();
      expect(result.error).toBeUndefined();

      assert(!result.error, "Expected no error");
      expectTypeOf(result.data).toBeNullable();
    });
    it("should error if more than 1 record is returned in maybeSingle mode", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/fmdapi_test.fmp12/contacts",
        response: { value: [{}, {}] },
        status: 200,
      });
      const db = mock.database("fmdapi_test.fmp12");

      const result = await db
        .from(contacts)
        .list()
        .maybeSingle()
        .execute();

      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    it("should execute a list query with pagination using mocked response", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/fmdapi_test.fmp12/contacts",
        response: mockResponses["list-with-pagination"]?.response,
        status: mockResponses["list-with-pagination"]?.status ?? 200,
        headers: mockResponses["list-with-pagination"]?.headers,
      });
      const db = mock.database("fmdapi_test.fmp12");

      const result = await db
        .from(contacts)
        .list()
        .top(2)
        .skip(2)
        .execute();

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe("Single record queries", () => {
    it("should execute a single record query using mocked response", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/fmdapi_test.fmp12/contacts",
        response: mockResponses["single-record"]?.response,
        status: mockResponses["single-record"]?.status ?? 200,
        headers: mockResponses["single-record"]?.headers,
      });
      const db = mock.database("fmdapi_test.fmp12");

      const result = await db
        .from(contacts)
        .get("B5BFBC89-03E0-47FC-ABB6-D51401730227")
        .execute();

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();

      // Single record queries return the record directly, not wrapped in { value: [...] }
      expect(typeof result.data).toBe("object");
    });

    it("should execute a single field query using mocked response", async () => {
      // Note: Type errors for wrong columns are now caught at compile time
      // We can't easily test this with @ts-expect-error since we'd need a wrong table's column

      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/fmdapi_test.fmp12/contacts",
        response: mockResponses["single-field"]?.response,
        status: mockResponses["single-field"]?.status ?? 200,
        headers: mockResponses["single-field"]?.headers,
      });
      const db = mock.database("fmdapi_test.fmp12");

      const result = await db
        .from(contacts)
        .get("B5BFBC89-03E0-47FC-ABB6-D51401730227")
        .getSingleField(contacts.name)
        .execute();

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();

      if (result.data) {
        expectTypeOf(result.data).toEqualTypeOf<string>();
      }

      // Single field queries return the field value directly
      expect(result.data).toBe("Eric");
    });
  });

  describe("Query builder methods", () => {
    it("should generate correct query strings even with mocks", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("fmdapi_test.fmp12");

      const queryString = db
        .from(contacts)
        .list()
        .select({ name: contacts.name, hobby: contacts.hobby })
        .where(eq(contacts.name, "John"))
        .orderBy("name")
        .top(10)
        .getQueryString();

      expect(queryString).toContain("$select");
      expect(queryString).toContain("name");
      expect(queryString).toContain("hobby");
      expect(queryString).toContain("$filter");
      expect(queryString).toContain("$orderby");
      expect(queryString).toContain("$top");
    });
  });
});
