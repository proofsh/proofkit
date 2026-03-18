/**
 * Error Handling Tests
 *
 * Tests for rich error handling in the library, including:
 * - HTTP errors (4xx, 5xx)
 * - Network errors (timeout, abort, retry limit, circuit open)
 * - Validation errors with library-specific formatting (Zod example)
 * - OData errors
 * - Response structure errors
 * - Type guards and error detection
 */

import {
  fmTableOccurrence,
  HTTPError,
  isHTTPError,
  isODataError,
  isRecordCountMismatchError,
  isResponseStructureError,
  isSchemaLockedError,
  isValidationError,
  numberField,
  ODataError,
  RecordCountMismatchError,
  ResponseStructureError,
  SchemaLockedError,
  textField,
  ValidationError,
} from "@proofkit/fmodata";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

describe("Error Handling", () => {
  const users = fmTableOccurrence("users", {
    id: textField().primaryKey(),
    username: textField(),
    email: textField().readValidator(z.string().email()),
    active: numberField().readValidator(z.coerce.boolean()),
    age: numberField().readValidator(z.number().int().min(0).max(150)),
  });

  describe("HTTP Errors", () => {
    it("should return HTTPError for 404 Not Found", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: null,
        status: 404,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
      expect(result.error).toBeInstanceOf(HTTPError);

      const httpError = result.error as HTTPError;
      expect(httpError.status).toBe(404);
      expect(httpError.isNotFound()).toBe(true);
      expect(httpError.is4xx()).toBe(true);
      expect(httpError.is5xx()).toBe(false);
    });

    it("should return HTTPError for 401 Unauthorized", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: null,
        status: 401,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      expect(result.error).toBeInstanceOf(HTTPError);

      const httpError = result.error as HTTPError;
      expect(httpError.status).toBe(401);
      expect(httpError.isUnauthorized()).toBe(true);
    });

    it("should return HTTPError for 500 Server Error", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: null,
        status: 500,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      expect(result.error).toBeInstanceOf(HTTPError);

      const httpError = result.error as HTTPError;
      expect(httpError.status).toBe(500);
      expect(httpError.is5xx()).toBe(true);
      expect(httpError.is4xx()).toBe(false);
    });

    it("should include response body in HTTPError", async () => {
      const errorBody = { message: "Custom error message" };
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: errorBody,
        status: 400,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeInstanceOf(HTTPError);
      const httpError = result.error as HTTPError;
      expect(httpError.response).toEqual(errorBody);
    });
  });

  describe("OData Errors", () => {
    it("should return ODataError for OData error responses", async () => {
      const odataError = {
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid OData query",
          target: "$filter",
        },
      };

      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: odataError,
        status: 400,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      expect(result.error).toBeInstanceOf(ODataError);

      const odataErr = result.error as ODataError;
      expect(odataErr.code).toBe("INVALID_REQUEST");
      expect(odataErr.details).toEqual(odataError.error);
    });

    it("should return SchemaLockedError for database schema locked error (code 303)", async () => {
      const schemaLockedError = {
        error: {
          code: "303",
          message: "Database schema is locked by another user",
        },
      };

      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: schemaLockedError,
        status: 400,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      expect(result.error).toBeInstanceOf(SchemaLockedError);

      const schemaError = result.error as SchemaLockedError;
      expect(schemaError.code).toBe("303");
      expect(schemaError.message).toContain("Database schema is locked");
      expect(schemaError.details).toEqual(schemaLockedError.error);
      expect(schemaError.kind).toBe("SchemaLockedError");
    });

    it("should return SchemaLockedError when error code is numeric 303", async () => {
      const schemaLockedError = {
        error: {
          code: 303,
          message: "Database schema is locked by another user",
        },
      };

      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: schemaLockedError,
        status: 400,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      expect(result.error).toBeInstanceOf(SchemaLockedError);
    });
  });

  describe("Validation Errors", () => {
    it("should return ValidationError when schema validation fails", async () => {
      // Return data that doesn't match schema (email is invalid, age is out of range)
      const invalidData = [
        {
          id: "1",
          username: "testuser",
          email: "not-an-email", // Invalid email
          active: true,
          age: 200, // Out of range (max 150)
        },
      ];

      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: invalidData,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      expect(result.error).toBeInstanceOf(ValidationError);

      const validationError = result.error as ValidationError;
      expect(validationError.issues).toBeDefined();
      expect(Array.isArray(validationError.issues)).toBe(true);
      expect(validationError.issues.length).toBeGreaterThan(0);
      expect(validationError.value).toBeDefined();
    });

    it("should preserve Standard Schema issues on the error instance without setting cause", async () => {
      const invalidData = [
        {
          id: "1",
          username: "testuser",
          email: "not-an-email",
          active: true,
          age: 200,
        },
      ];

      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: invalidData,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeInstanceOf(ValidationError);
      const validationError = result.error as ValidationError;

      expect(Array.isArray(validationError.issues)).toBe(true);
      expect(validationError.issues.length).toBeGreaterThan(0);
      expect(validationError.cause).toBeUndefined();

      // The issues array is always available
      expect(validationError.issues).toBeDefined();
      expect(Array.isArray(validationError.issues)).toBe(true);
      expect(validationError.issues.length).toBeGreaterThan(0);

      // ensure the end user can pass this back to zod
      expect(z.prettifyError(validationError)).toBeDefined();
    });

    it("should include field name in ValidationError", async () => {
      const invalidData = [
        {
          id: "1",
          username: "testuser",
          email: "not-an-email",
          active: true,
          age: 25,
        },
      ];

      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: invalidData,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeInstanceOf(ValidationError);
      const validationError = result.error as ValidationError;

      // The error should mention which field failed
      expect(validationError.message).toContain("email");
    });
  });

  describe("Response Structure Errors", () => {
    it("should return ResponseStructureError for invalid response structure", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: JSON.stringify("not an object"),
        status: 200,
      });
      const db = mock.database("testdb");

      // Return invalid structure (not an object)
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      expect(result.error).toBeInstanceOf(ResponseStructureError);

      const structureError = result.error as ResponseStructureError;
      expect(structureError.expected).toContain("object");
    });

    it("should return ResponseStructureError when value is not an array", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: { value: "not an array" },
        status: 200,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      expect(result.error).toBeInstanceOf(ResponseStructureError);
    });
  });

  describe("Record Count Mismatch Errors", () => {
    it("should return RecordCountMismatchError for single() when multiple records found", async () => {
      const multipleRecords = [
        {
          id: "1",
          username: "user1",
          email: "user1@test.com",
          active: true,
          age: 25,
        },
        {
          id: "2",
          username: "user2",
          email: "user2@test.com",
          active: true,
          age: 30,
        },
      ];

      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: multipleRecords,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().single().execute();

      expect(result.error).toBeDefined();
      expect(result.error).toBeInstanceOf(RecordCountMismatchError);

      const countError = result.error as RecordCountMismatchError;
      expect(countError.expected).toBe("one");
      expect(countError.received).toBe(2);
    });

    it("should return RecordCountMismatchError for single() when no records found", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({ urlPattern: "/testdb/users", response: [] });
      const db = mock.database("testdb");
      const result = await db.from(users).list().single().execute();

      expect(result.error).toBeDefined();
      expect(result.error).toBeInstanceOf(RecordCountMismatchError);

      const countError = result.error as RecordCountMismatchError;
      expect(countError.expected).toBe("one");
      expect(countError.received).toBe(0);
    });
  });

  describe("Type Guards", () => {
    it("should correctly identify HTTPError using type guard", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: null,
        status: 404,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      expect(isHTTPError(result.error)).toBe(true);

      if (isHTTPError(result.error)) {
        // TypeScript should know this is HTTPError
        expect(result.error.status).toBe(404);
      }
    });

    it("should correctly identify ValidationError using type guard", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: [
          {
            id: "1",
            username: "test",
            email: "invalid-email",
            active: true,
            age: 25,
          },
        ],
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      expect(isValidationError(result.error)).toBe(true);

      if (isValidationError(result.error)) {
        // TypeScript should know this is ValidationError
        expect(result.error.issues).toBeDefined();
      }
    });

    it("should correctly identify ODataError using type guard", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: { error: { code: "ERROR", message: "Test" } },
        status: 400,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      expect(isODataError(result.error)).toBe(true);

      if (isODataError(result.error)) {
        // TypeScript should know this is ODataError
        expect(result.error.code).toBeDefined();
      }
    });

    it("should correctly identify SchemaLockedError using type guard", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: {
          error: { code: "303", message: "Database schema is locked" },
        },
        status: 400,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      expect(isSchemaLockedError(result.error)).toBe(true);

      if (isSchemaLockedError(result.error)) {
        // TypeScript should know this is SchemaLockedError
        expect(result.error.code).toBe("303");
        expect(result.error.kind).toBe("SchemaLockedError");
      }
    });

    it("should correctly identify ResponseStructureError using type guard", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: JSON.stringify("invalid"),
        status: 200,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      expect(isResponseStructureError(result.error)).toBe(true);
    });

    it("should correctly identify RecordCountMismatchError using type guard", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: [
          {
            id: "1",
            username: "user1",
            email: "user1@test.com",
            active: true,
            age: 25,
          },
          {
            id: "2",
            username: "user2",
            email: "user2@test.com",
            active: true,
            age: 30,
          },
        ],
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().single().execute();

      expect(result.error).toBeDefined();
      expect(isRecordCountMismatchError(result.error)).toBe(true);
    });
  });

  describe("Error Properties", () => {
    it("should include timestamp in all errors", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: null,
        status: 404,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      if (result.error && "timestamp" in result.error) {
        expect(result.error.timestamp).toBeInstanceOf(Date);
      }
    });

    it("should include kind property for discriminated unions", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: null,
        status: 404,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      expect(result.error).toBeDefined();
      if (result.error && "kind" in result.error) {
        expect(result.error.kind).toBe("HTTPError");
      }
    });
  });

  describe("Error Handling Patterns", () => {
    it("should allow instanceof checks (like ffetch pattern)", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: null,
        status: 404,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      if (result.error) {
        if (result.error instanceof HTTPError) {
          expect(result.error.status).toBe(404);
        } else {
          throw new Error("Expected HTTPError");
        }
      }
    });

    it("should allow switch statement on kind property", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/testdb/users",
        response: null,
        status: 404,
      });
      const db = mock.database("testdb");
      const result = await db.from(users).list().execute();

      if (result.error && "kind" in result.error) {
        switch (result.error.kind) {
          case "HTTPError":
            expect((result.error as HTTPError).status).toBe(404);
            break;
          case "ValidationError":
            throw new Error("Unexpected ValidationError");
          case "ODataError":
            throw new Error("Unexpected ODataError");
          default:
            throw new Error("Unexpected error kind");
        }
      }
    });
  });
});
