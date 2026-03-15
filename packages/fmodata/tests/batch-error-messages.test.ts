/**
 * Batch Error Messages Test
 *
 * This test demonstrates that batch operations now properly parse and return
 * FileMaker error responses instead of vague validation errors.
 *
 * BEFORE: "Invalid response structure: expected 'value' property to be an array"
 * AFTER: "OData error: Table 'Purchase_Orders' not defined in database" with code "-1020"
 */

import { fmTableOccurrence, isODataError, isResponseStructureError, textField } from "@proofkit/fmodata";
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
          "Content-Type": `multipart/mixed; boundary=${boundary}`,
        },
      }),
    );
  };
}

describe("Batch Error Messages - Improved Error Parsing", () => {
  // Batch tests use a custom fetchHandler because multipart responses are easier
  // to model directly than via per-route JSON response helpers.
  const mock = new MockFMServerConnection();

  // Define simple schemas for batch testing
  const addressesTO = fmTableOccurrence("addresses", {
    id: textField().primaryKey(),
    street: textField(),
  });

  const db = mock.database("test_db");

  it("should return ODataError with helpful message instead of vague ResponseStructureError", async () => {
    // This simulates the exact scenario from the user's error:
    // A batch with multiple queries where one uses a bad table name
    const mockBatchResponse = [
      "--batch_boundary",
      "Content-Type: application/http",
      "",
      "HTTP/1.1 200 Ok",
      "Content-Type: application/json;charset=utf-8",
      "",
      JSON.stringify({
        "@odata.context": "test/$metadata#addresses",
        value: [
          {
            "@odata.id": "addresses('addr-1')",
            id: "addr-1",
            street: "123 Main St",
          },
        ],
      }),
      "--batch_boundary",
      "Content-Type: application/http",
      "",
      "HTTP/1.1 404 Not Found",
      "Content-Type: application/json;charset=utf-8",
      "",
      JSON.stringify({
        error: {
          code: "-1020",
          message: "Table 'Purchase_Orders' not defined in database",
        },
      }),
      "--batch_boundary",
      "Content-Type: application/http",
      "",
      "HTTP/1.1 200 Ok",
      "Content-Type: application/json;charset=utf-8",
      "",
      JSON.stringify({
        "@odata.context": "test/$metadata#addresses",
        value: [],
      }),
      "--batch_boundary--",
    ].join("\r\n");

    // Create three queries (simulating user's punchlistQuery, purchaseOrdersQuery, ticketsQuery)
    const query1 = db.from(addressesTO).list();
    const query2 = db.from(addressesTO).list(); // Will fail with 404 in mock
    const query3 = db.from(addressesTO).list();

    // Execute batch with mock
    const result = await db.batch([query1, query2, query3]).execute({
      fetchHandler: createBatchMockFetch(mockBatchResponse),
    });

    // Verify we got results
    expect(result.results).toBeDefined();
    expect(result.results.length).toBe(3);

    const [r1, r2, r3] = result.results;

    // First query succeeded
    expect(r1.error).toBeUndefined();
    expect(r1.data).toBeDefined();

    // Second query failed with a HELPFUL error message
    expect(r2.error).toBeDefined();
    expect(r2.data).toBeUndefined();

    // ✅ BEFORE: This would be ResponseStructureError with vague message
    // ✅ AFTER: This is now ODataError with the actual FileMaker error
    expect(isResponseStructureError(r2.error)).toBe(false); // NOT a validation error
    expect(isODataError(r2.error)).toBe(true); // IS an OData error

    if (isODataError(r2.error)) {
      // The error now contains the actual FileMaker error details
      expect(r2.error.code).toBe("-1020");
      expect(r2.error.message).toContain("Table 'Purchase_Orders' not defined");
      expect(r2.error.kind).toBe("ODataError");
    }

    // Third query succeeded (not truncated in this mock)
    expect(r3.error).toBeUndefined();
    expect(r3.data).toBeDefined();
  });

  it("should handle error when table doesn't exist - the original use case", async () => {
    // This is the exact scenario from the user's error message:
    // They're querying a table that doesn't exist (Purchase_Orders with underscore instead of space)
    const mockBatchResponse = [
      "--batch_boundary",
      "Content-Type: application/http",
      "",
      "HTTP/1.1 404 Not Found",
      "Content-Type: application/json;charset=utf-8",
      "",
      JSON.stringify({
        error: {
          code: "-1020",
          message: "Table 'Purchase_Orders' not defined in database",
        },
      }),
      "--batch_boundary--",
    ].join("\r\n");

    const badQuery = db.from(addressesTO).list();

    const result = await db.batch([badQuery]).execute({
      fetchHandler: createBatchMockFetch(mockBatchResponse),
    });

    const [r1] = result.results;

    // Error should be an ODataError, not ResponseStructureError
    expect(r1.error).toBeDefined();
    expect(isODataError(r1.error)).toBe(true);

    if (isODataError(r1.error)) {
      // Verify we get the actual FileMaker error code and message
      expect(r1.error.code).toBe("-1020");
      expect(r1.error.message).toBe("OData error: Table 'Purchase_Orders' not defined in database");

      // This is much more helpful than:
      // "Invalid response structure: expected 'value' property to be an array"
    }
  });
});
