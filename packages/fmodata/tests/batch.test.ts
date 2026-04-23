/**
 * Batch Operations Tests
 *
 * Tests for batch operation parsing and error handling using mocked responses.
 * These tests don't require a live server connection.
 */

import { eq, fmTableOccurrence, isBatchTruncatedError, isNotNull, isODataError, textField } from "@proofkit/fmodata";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { describe, expect, it } from "vitest";

/**
 * Creates a mock fetch handler that returns a multipart batch response
 */
function createBatchMockFetch(batchResponseBody: string): typeof fetch {
  return (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    // Extract boundary from the batch response body (first line starts with --)
    const firstLine = batchResponseBody.split("\r\n")[0] || batchResponseBody.split("\n")[0] || "";
    const boundary = firstLine.startsWith("--") ? firstLine.substring(2) : "batch_test";

    return Promise.resolve(
      new Response(batchResponseBody, {
        status: 200,
        statusText: "OK",
        headers: {
          "content-type": `multipart/mixed; boundary=${boundary}`,
        },
      }),
    );
  };
}

describe("Batch Operations - Mock Tests", () => {
  const mock = new MockFMServerConnection();

  // Define simple schemas for batch testing
  const contactsTO = fmTableOccurrence("contacts", {
    PrimaryKey: textField().primaryKey(),
    name: textField(),
    hobby: textField(),
  });

  const usersTO = fmTableOccurrence("users", {
    id: textField().primaryKey(),
    name: textField(),
  });

  const db = mock.database("test_db");

  describe("Mixed success/failure responses", () => {
    it("should support list().count() and top-level count() in the same batch", async () => {
      const mockBatchResponse = [
        "--b_test_boundary",
        "Content-Type: application/http",
        "",
        "HTTP/1.1 200 Ok",
        "Content-Type: application/json;charset=utf-8",
        "",
        JSON.stringify({
          "@odata.context": "test/$metadata#contacts",
          "@odata.count": "2",
          value: [
            {
              "@odata.id": "contacts('id-1')",
              PrimaryKey: "id-1",
              name: "First",
              hobby: "Testing",
            },
          ],
        }),
        "--b_test_boundary",
        "Content-Type: application/http",
        "",
        "HTTP/1.1 200 Ok",
        "Content-Type: text/plain",
        "",
        "5",
        "--b_test_boundary--",
      ].join("\r\n");

      const listWithCountQuery = db.from(contactsTO).list().where(eq(contactsTO.hobby, "Testing")).count();
      const topLevelCountQuery = db.from(contactsTO).count().where(eq(contactsTO.hobby, "Testing"));

      const result = await db.batch([listWithCountQuery, topLevelCountQuery]).execute({
        fetchHandler: createBatchMockFetch(mockBatchResponse),
      });

      const [r1, r2] = result.results;
      expect(r1?.error).toBeUndefined();
      expect(r1?.data).toEqual({
        count: 2,
        records: [{ PrimaryKey: "id-1", hobby: "Testing", name: "First" }],
      });
      expect(r2?.error).toBeUndefined();
      expect(r2?.data).toBe(5);
    });

    it("should handle batch response where first succeeds, second fails (404), and third is truncated", async () => {
      // This mock response simulates a real FileMaker batch response where:
      // 1. First query succeeds with data
      // 2. Second query fails with 404 - table not found
      // 3. Third query is never executed (truncated) because FileMaker stops on error
      const mockBatchResponse = [
        "--b_test_boundary",
        "Content-Type: application/http",
        "",
        "HTTP/1.1 200 Ok",
        "Content-Type: application/json;charset=utf-8",
        "Content-Length: 200",
        "",
        JSON.stringify({
          "@odata.context": "test/$metadata#contacts",
          value: [
            {
              "@odata.id": "contacts('id-1')",
              PrimaryKey: "id-1",
              name: "First Success Record",
              hobby: "Testing",
            },
          ],
        }),
        "--b_test_boundary",
        "Content-Type: application/http",
        "",
        "HTTP/1.1 404 Not Found",
        "Content-Type: application/json;charset=utf-8",
        "Content-Length: 89",
        "",
        JSON.stringify({
          error: {
            code: "-1020",
            message: "Table 'Purchase_Orders' not defined in database",
          },
        }),
        "--b_test_boundary--",
      ].join("\r\n");

      // Create three queries
      const query1 = db.from(contactsTO).list().where(eq(contactsTO.hobby, "Testing"));
      const query2 = db.from(usersTO).list().where(eq(usersTO.name, "NonExistent"));
      const query3 = db.from(contactsTO).list().where(isNotNull(contactsTO.name));

      // Execute batch with mock
      const result = await db.batch([query1, query2, query3]).execute({
        fetchHandler: createBatchMockFetch(mockBatchResponse),
      });

      // Verify we got a BatchResult
      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(result.results.length).toBe(3);

      const [r1, r2, r3] = result.results;

      // First result should be successful
      expect(r1.error).toBeUndefined();
      expect(r1.data).toBeDefined();
      expect(Array.isArray(r1.data)).toBe(true);
      expect((r1.data as any[]).length).toBeGreaterThan(0);
      expect(r1.status).toBe(200);

      // Second result should have an error (404)
      expect(r2.error).toBeDefined();
      expect(r2.data).toBeUndefined();
      expect(r2.status).toBe(404);

      // Verify the error is an ODataError with proper details
      expect(isODataError(r2.error)).toBe(true);
      if (isODataError(r2.error)) {
        expect(r2.error.code).toBe("-1020");
        expect(r2.error.message).toContain("Table 'Purchase_Orders' not defined");
        expect(r2.error.kind).toBe("ODataError");
      }

      // Third result should be truncated (never executed due to error in second)
      expect(r3.error).toBeDefined();
      expect(r3.data).toBeUndefined();
      expect(r3.status).toBe(0);
      if (r3.error && isBatchTruncatedError(r3.error)) {
        expect(r3.error.operationIndex).toBe(2);
        expect(r3.error.failedAtIndex).toBe(1);
      }
      expect(isBatchTruncatedError(r3.error)).toBe(true);

      // Verify summary statistics
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(2);
      expect(result.truncated).toBe(true);
      expect(result.firstErrorIndex).toBe(1);
    });

    it("should handle batch response where all three queries succeed", async () => {
      const mockBatchResponse = [
        "--b_success_boundary",
        "Content-Type: application/http",
        "",
        "HTTP/1.1 200 Ok",
        "Content-Type: application/json;charset=utf-8",
        "Content-Length: 200",
        "",
        JSON.stringify({
          "@odata.context": "test/$metadata#contacts",
          value: [
            { PrimaryKey: "id-1", name: "Contact 1", hobby: "Reading" },
            { PrimaryKey: "id-2", name: "Contact 2", hobby: "Writing" },
          ],
        }),
        "--b_success_boundary",
        "Content-Type: application/http",
        "",
        "HTTP/1.1 200 Ok",
        "Content-Type: application/json;charset=utf-8",
        "Content-Length: 150",
        "",
        JSON.stringify({
          "@odata.context": "test/$metadata#users",
          value: [{ id: "user-1", name: "User 1" }],
        }),
        "--b_success_boundary",
        "Content-Type: application/http",
        "",
        "HTTP/1.1 200 Ok",
        "Content-Type: application/json;charset=utf-8",
        "Content-Length: 180",
        "",
        JSON.stringify({
          "@odata.context": "test/$metadata#contacts",
          value: [{ PrimaryKey: "id-3", name: "Contact 3", hobby: "Gaming" }],
        }),
        "--b_success_boundary--",
      ].join("\r\n");

      const query1 = db.from(contactsTO).list().where(eq(contactsTO.hobby, "Reading"));
      const query2 = db.from(usersTO).list().top(1);
      const query3 = db.from(contactsTO).list().where(eq(contactsTO.hobby, "Gaming"));

      const result = await db.batch([query1, query2, query3]).execute({
        fetchHandler: createBatchMockFetch(mockBatchResponse),
      });

      expect(result.results).toBeDefined();
      expect(result.results.length).toBe(3);

      const [r1, r2, r3] = result.results;

      // First query: contacts with hobby=Reading
      expect(r1.error).toBeUndefined();
      expect(Array.isArray(r1.data)).toBe(true);
      expect((r1.data as any[]).length).toBe(2);
      expect(r1.status).toBe(200);

      // Second query: users
      expect(r2.error).toBeUndefined();
      expect(Array.isArray(r2.data)).toBe(true);
      expect((r2.data as any[]).length).toBe(1);
      expect(r2.status).toBe(200);

      // Third query: contacts with hobby=Gaming
      expect(r3.error).toBeUndefined();
      expect(Array.isArray(r3.data)).toBe(true);
      expect((r3.data as any[]).length).toBe(1);
      expect(r3.status).toBe(200);

      // Verify summary statistics
      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(result.truncated).toBe(false);
      expect(result.firstErrorIndex).toBeNull();
    });

    it("should handle batch response where middle query fails with empty result set", async () => {
      // This simulates when a filter returns no results (not an error, just empty)
      const mockBatchResponse = [
        "--b_empty_boundary",
        "Content-Type: application/http",
        "",
        "HTTP/1.1 200 Ok",
        "Content-Type: application/json;charset=utf-8",
        "Content-Length: 100",
        "",
        JSON.stringify({
          "@odata.context": "test/$metadata#contacts",
          value: [{ PrimaryKey: "id-1", name: "Found Record", hobby: null }],
        }),
        "--b_empty_boundary",
        "Content-Type: application/http",
        "",
        "HTTP/1.1 200 Ok",
        "Content-Type: application/json;charset=utf-8",
        "Content-Length: 50",
        "",
        JSON.stringify({
          "@odata.context": "test/$metadata#users",
          value: [], // Empty result set
        }),
        "--b_empty_boundary",
        "Content-Type: application/http",
        "",
        "HTTP/1.1 200 Ok",
        "Content-Type: application/json;charset=utf-8",
        "Content-Length: 100",
        "",
        JSON.stringify({
          "@odata.context": "test/$metadata#contacts",
          value: [{ PrimaryKey: "id-2", name: "Another Record", hobby: null }],
        }),
        "--b_empty_boundary--",
      ].join("\r\n");

      const query1 = db.from(contactsTO).list().top(1);
      const query2 = db.from(usersTO).list().where(eq(usersTO.name, "NonExistent"));
      const query3 = db.from(contactsTO).list().top(1);

      const result = await db.batch([query1, query2, query3]).execute({
        fetchHandler: createBatchMockFetch(mockBatchResponse),
      });

      expect(result.results).toBeDefined();
      expect(result.results.length).toBe(3);

      const [r1, r2, r3] = result.results;

      expect(r1.error).toBeUndefined();
      expect(Array.isArray(r1.data)).toBe(true);
      expect((r1.data as any[]).length).toBe(1);
      expect(r1.status).toBe(200);

      // Empty result set should still be a valid empty array
      expect(r2.error).toBeUndefined();
      expect(Array.isArray(r2.data)).toBe(true);
      expect((r2.data as any[]).length).toBe(0);
      expect(r2.status).toBe(200);

      expect(r3.error).toBeUndefined();
      expect(Array.isArray(r3.data)).toBe(true);
      expect((r3.data as any[]).length).toBe(1);
      expect(r3.status).toBe(200);

      // Verify summary statistics
      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(result.truncated).toBe(false);
      expect(result.firstErrorIndex).toBeNull();
    });
  });
});
