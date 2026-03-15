/**
 * Webhook Manager Tests
 *
 * Tests for the WebhookManager class using mock responses.
 * These tests verify that webhook methods correctly handle API responses
 * and return properly typed data.
 */

import {
  eq,
  fmTableOccurrence,
  textField,
  type WebhookAddResponse,
  type WebhookInfo,
  type WebhookListResponse,
} from "@proofkit/fmodata";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { assert, describe, expect, it } from "vitest";
import { mockResponses } from "./fixtures/responses";
import { createMockFetch } from "./utils/mock-fetch";

describe("WebhookManager", () => {
  const connection = new MockFMServerConnection();
  const db = connection.database("fmdapi_test.fmp12");

  // Create a simple table occurrence for testing
  const contacts = fmTableOccurrence("contacts", {
    PrimaryKey: textField().primaryKey(),
    name: textField(),
  });

  describe("list()", () => {
    it("should return a list of webhooks with status", async () => {
      const result = await db.webhook.list({
        fetchHandler: createMockFetch(mockResponses["webhook-list"]),
      });

      expect(result).toBeDefined();
      expect(result.status).toBe("ACTIVE");
      expect(Array.isArray(result.webhooks)).toBe(true);
      expect(result.webhooks.length).toBeGreaterThan(0);

      // Extract expected data from mock response
      const mockData = mockResponses["webhook-list"].response;
      const expectedWebhooks = mockData.webhooks;
      expect(result.webhooks.length).toBe(expectedWebhooks.length);

      const firstWebhook = result.webhooks[0];
      expect(firstWebhook).toBeDefined();
      if (!firstWebhook) {
        throw new Error("Expected firstWebhook to be defined");
      }

      // Use the first webhook from the mock response as the expected value
      const expectedFirstWebhook = expectedWebhooks[0];
      if (!expectedFirstWebhook) {
        throw new Error("Expected first webhook in mock response");
      }
      expect(firstWebhook.webhookID).toBe(expectedFirstWebhook.webhookID);
      expect(firstWebhook.tableName).toBe("contacts");
      expect(firstWebhook.webhook).toBe("https://example.com/webhook");
      expect(firstWebhook.headers).toEqual({ "X-Custom-Header": "test-value" });
      expect(firstWebhook.notifySchemaChanges).toBe(false);
      expect(firstWebhook.select).toBe("");
      expect(firstWebhook.filter).toBe("");
      expect(Array.isArray(firstWebhook.pendingOperations)).toBe(true);
    });

    it("should have correct TypeScript types", async () => {
      const result = await db.webhook.list({
        fetchHandler: createMockFetch(mockResponses["webhook-list"]),
      });

      // Type check - result should be WebhookListResponse
      const typedResult: WebhookListResponse = result;
      expect(typedResult.status).toBe("ACTIVE");

      // Extract expected ID from mock response
      const mockData = mockResponses["webhook-list"].response;
      const expectedFirstWebhookID = mockData.webhooks[0]?.webhookID;
      expect(typedResult.webhooks[0]?.webhookID).toBe(expectedFirstWebhookID);
    });
  });

  describe("add()", () => {
    it("should add a webhook and return the webhook ID", async () => {
      const result = await db.webhook.add(
        {
          webhook: "https://example.com/webhook",
          tableName: contacts,
          headers: { "X-Custom-Header": "test-value" },
        },
        {
          fetchHandler: createMockFetch(mockResponses["webhook-add"]),
        },
      );

      expect(result).toBeDefined();
      expect(result.webhookResult).toBeDefined();

      // Extract expected ID from mock response
      const expectedWebhookID = mockResponses["webhook-add"].response.webhookResult.webhookID;
      expect(result.webhookResult.webhookID).toBe(expectedWebhookID);
    });

    it("should extract table name from FMTable instance", async () => {
      const result = await db.webhook.add(
        {
          webhook: "https://example.com/webhook",
          tableName: contacts,
        },
        {
          fetchHandler: createMockFetch(mockResponses["webhook-add"]),
        },
      );

      // Extract expected ID from mock response
      const expectedWebhookID = mockResponses["webhook-add"].response.webhookResult.webhookID;
      expect(result.webhookResult.webhookID).toBe(expectedWebhookID);
    });

    it("should support the same filter/select DX as the main query builder", async () => {
      let requestBody: string | null = null;
      await db.webhook.add(
        {
          webhook: "https://example.com/webhook",
          tableName: contacts,
          filter: eq(contacts.name, "John"),
          select: [contacts.name, contacts.PrimaryKey],
        },
        {
          hooks: {
            before: async (req: Request) => {
              if (req.body) {
                // Clone the request to read the body without consuming it
                const clonedRequest = req.clone();
                requestBody = await clonedRequest.text();
              }
            },
          },
          fetchHandler: createMockFetch(mockResponses["webhook-add-with-options"]),
        },
      );
      assert(requestBody, "Request body should be defined");

      // Parse the request body to verify it contains the transformed OData expressions
      const body = JSON.parse(requestBody);

      // Verify the filter is transformed to OData filter syntax
      // eq(contacts.name, "John") should become "name eq 'John'"
      expect(body.filter).toBe("name eq 'John'");

      // Verify the select is transformed to OData select syntax
      // [contacts.name, contacts.PrimaryKey] should become "name,PrimaryKey"
      expect(body.select).toBe("name,PrimaryKey");
    });

    it("should have correct TypeScript types", async () => {
      const result = await db.webhook.add(
        {
          webhook: "https://example.com/webhook",
          tableName: contacts,
        },
        {
          fetchHandler: createMockFetch(mockResponses["webhook-add"]),
        },
      );

      // Type check - result should be WebhookAddResponse
      const typedResult: WebhookAddResponse = result;

      // Extract expected ID from mock response
      const expectedWebhookID = mockResponses["webhook-add"].response.webhookResult.webhookID;
      expect(typedResult.webhookResult.webhookID).toBe(expectedWebhookID);
    });
  });

  describe("get()", () => {
    it("should get a webhook by ID", async () => {
      // Extract webhook ID from mock response URL or response data
      const mockData = mockResponses["webhook-get"].response;
      const webhookID = mockData.webhookID;

      const result = await db.webhook.get(webhookID, {
        fetchHandler: createMockFetch(mockResponses["webhook-get"]),
      });

      expect(result).toBeDefined();
      expect(result.webhookID).toBe(webhookID);
      expect(result.tableName).toBe("contacts");
      expect(result.webhook).toBe("https://example.com/webhook");
      expect(result.headers).toEqual({ "X-Custom-Header": "test-value" });
      expect(result.notifySchemaChanges).toBe(false);
      expect(result.select).toBe("");
      expect(result.filter).toBe("");
      expect(Array.isArray(result.pendingOperations)).toBe(true);
    });

    it("should throw an error for non-existent webhook", async () => {
      await expect(
        db.webhook.get(99_999, {
          fetchHandler: createMockFetch(mockResponses["webhook-get-not-found"]),
        }),
      ).rejects.toThrow();
    });

    it("should have correct TypeScript types", async () => {
      // Extract webhook ID from mock response
      const mockData = mockResponses["webhook-get"].response;
      const webhookID = mockData.webhookID;

      const result = await db.webhook.get(webhookID, {
        fetchHandler: createMockFetch(mockResponses["webhook-get"]),
      });

      // Type check - result should be WebhookInfo
      const typedResult: WebhookInfo = result;
      expect(typedResult.webhookID).toBe(webhookID);
      expect(typedResult.tableName).toBe("contacts");
    });
  });

  describe("remove()", () => {
    it("should remove a webhook successfully", async () => {
      // Extract webhook ID from mock response
      const webhookID = mockResponses["webhook-delete"].response.webhookResult.webhookID;

      await expect(
        db.webhook.remove(webhookID, {
          fetchHandler: createMockFetch(mockResponses["webhook-delete"]),
        }),
      ).resolves.toBeUndefined();
    });

    it("should return void on success", async () => {
      // Extract webhook ID from mock response
      const webhookID = mockResponses["webhook-delete"].response.webhookResult.webhookID;

      const result = await db.webhook.remove(webhookID, {
        fetchHandler: createMockFetch(mockResponses["webhook-delete"]),
      });

      expect(result).toBeUndefined();
    });
  });

  // TODO: Re-enable these tests when webhook invoke functionality is implemented
  // describe("invoke()", () => {
  //   it("should invoke a webhook without rowIDs", async () => {
  //     const result = await db.webhook.invoke(1, undefined, {
  //       fetchHandler: createMockFetch(mockResponses["webhook-invoke"]),
  //     });
  //     expect(result).toBeDefined();
  //     expect(typeof result).toBe("object");
  //     if (result && typeof result === "object" && "status" in result) {
  //       expect((result as any).status).toBe("success");
  //     }
  //   });
  //   it("should invoke a webhook with rowIDs", async () => {
  //     const result = await db.webhook.invoke(
  //       1,
  //       { rowIDs: [63, 61] },
  //       {
  //         fetchHandler: createMockFetch(mockResponses["webhook-invoke"]),
  //       },
  //     );
  //     expect(result).toBeDefined();
  //     expect(typeof result).toBe("object");
  //   });
  // });

  describe("integration", () => {
    it("should add, get, and remove a webhook in sequence", async () => {
      // Extract expected IDs from mock responses
      const expectedAddID = mockResponses["webhook-add"].response.webhookResult.webhookID;
      const expectedGetID = mockResponses["webhook-get"].response.webhookID;

      // Add webhook
      const addResult = await db.webhook.add(
        {
          webhook: "https://example.com/webhook",
          tableName: contacts,
        },
        {
          fetchHandler: createMockFetch(mockResponses["webhook-add"]),
        },
      );

      expect(addResult.webhookResult.webhookID).toBe(expectedAddID);

      // Get webhook - use the ID from the add result, but verify it matches expected get ID
      // Note: In a real scenario, the get would use the add result ID, but for mocking
      // we need to use the ID that matches our mock response
      const getResult = await db.webhook.get(expectedGetID, {
        fetchHandler: createMockFetch(mockResponses["webhook-get"]),
      });

      expect(getResult.webhookID).toBe(expectedGetID);

      // Remove webhook - use the ID from the delete mock response
      const expectedDeleteID = mockResponses["webhook-delete"].response.webhookResult.webhookID;
      await expect(
        db.webhook.remove(expectedDeleteID, {
          fetchHandler: createMockFetch(mockResponses["webhook-delete"]),
        }),
      ).resolves.toBeUndefined();
    });
  });
});
