/**
 * Delete Tests
 *
 * Tests for the delete() method on EntitySet instances.
 * This validates type safety, builder pattern, and operation modes.
 */

import { and, eq, fmTableOccurrence, type InferTableSchema, lt, numberField, textField } from "@proofkit/fmodata";
import { DeleteBuilder, ExecutableDeleteBuilder } from "@proofkit/fmodata/client/delete-builder";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod/v4";

describe("delete method", () => {
  const usersTO = fmTableOccurrence("users", {
    id: textField().primaryKey(),
    username: textField().notNull(),
    email: textField().notNull(),
    active: numberField().readValidator(z.coerce.boolean()).notNull(),
    lastLogin: textField(),
  });

  type _UserSchema = InferTableSchema<typeof usersTO>;

  describe("builder pattern", () => {
    it("should return DeleteBuilder when delete() is called", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const result = db.from(usersTO).delete();
      expect(result).toBeInstanceOf(DeleteBuilder);
    });

    it("should not have execute() on initial DeleteBuilder", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const deleteBuilder = db.from(usersTO).delete();

      // Type check: execute should not exist on DeleteBuilder
      expectTypeOf(deleteBuilder).not.toHaveProperty("execute");
    });

    it("should return ExecutableDeleteBuilder after byId()", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const result = db.from(usersTO).delete().byId("user-123");
      expect(result).toBeInstanceOf(ExecutableDeleteBuilder);
    });

    it("should return ExecutableDeleteBuilder after where()", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const result = db
        .from(usersTO)
        .delete()
        .where((q) => q.where(eq(usersTO.active, 0)));
      expect(result).toBeInstanceOf(ExecutableDeleteBuilder);
    });

    it("should have execute() on ExecutableDeleteBuilder", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const executableBuilder = db.from(usersTO).delete().byId("user-123");

      // Type check: execute should exist
      expectTypeOf(executableBuilder).toHaveProperty("execute");
    });
  });

  describe("delete by ID", () => {
    it("should generate correct URL for delete by ID", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const deleteBuilder = db.from(usersTO).delete().byId("user-123");
      const config = deleteBuilder.getRequestConfig();

      expect(config.method).toBe("DELETE");
      expect(config.url).toBe("/test_db/users('user-123')");
    });

    it("should return deletedCount result type", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      db.from(usersTO).delete().byId("user-123");
    });

    it("should execute delete by ID and return count", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/test_db/users",
        method: "DELETE",
        status: 204,
        headers: { "fmodata.affected_rows": "1" },
        response: null,
      });
      const db = mock.database("test_db");

      const result = await db.from(usersTO).delete().byId("user-123").execute();

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ deletedCount: 1 });
    });
  });

  describe("delete by filter", () => {
    it("should generate correct URL for delete by filter", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const deleteBuilder = db
        .from(usersTO)
        .delete()
        .where((q) => q.where(eq(usersTO.active, 0)));

      const config = deleteBuilder.getRequestConfig();

      expect(config.method).toBe("DELETE");
      expect(config.url).toContain("/test_db/users");
      expect(config.url).toContain("$filter");
      expect(config.url).toContain("active");
    });

    it("should support complex filters with QueryBuilder", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const deleteBuilder = db
        .from(usersTO)
        .delete()
        .where((q) => q.where(and(eq(usersTO.active, 0), lt(usersTO.lastLogin, "2023-01-01"))));

      const config = deleteBuilder.getRequestConfig();

      expect(config.method).toBe("DELETE");
      expect(config.url).toContain("$filter");
    });

    it("should support QueryBuilder chaining in where callback", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const deleteBuilder = db
        .from(usersTO)
        .delete()
        .where((q) => q.where(eq(usersTO.active, 0)).top(10));

      const config = deleteBuilder.getRequestConfig();

      expect(config.method).toBe("DELETE");
      expect(config.url).toContain("$filter");
      expect(config.url).toContain("$top");
    });

    it("should return deletedCount result type for filter-based delete", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      db.from(usersTO)
        .delete()
        .where((q) => q.where(eq(usersTO.active, 0)));
    });

    it("should execute delete by filter and return count", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/test_db/users",
        method: "DELETE",
        status: 204,
        headers: { "fmodata.affected_rows": "5" },
        response: null,
      });
      const db = mock.database("test_db");

      const result = await db
        .from(usersTO)
        .delete()
        .where((q) => q.where(eq(usersTO.active, 0)))
        .execute();

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ deletedCount: 5 });
    });
  });

  describe("type safety", () => {
    it("should enforce type-safe filter properties", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      // This should work - valid property
      db.from(usersTO)
        .delete()
        .where((q) => q.where(eq(usersTO.active, 0)));
    });

    it("should provide type-safe QueryBuilder in where callback", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      db.from(usersTO)
        .delete()
        .where((q) => {
          // Type check: q should have where, orderBy, top, skip methods
          expectTypeOf(q).toHaveProperty("where");
          expectTypeOf(q).toHaveProperty("orderBy");
          expectTypeOf(q).toHaveProperty("top");
          expectTypeOf(q).toHaveProperty("skip");

          return q.where(eq(usersTO.active, 0));
        });
    });
  });

  describe("error handling", () => {
    it("should return error on failed delete", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/test_db/users",
        method: "DELETE",
        throwError: new Error("Network error"),
        response: null,
      });
      const db = mock.database("test_db");

      const result = await db.from(usersTO).delete().byId("user-123").execute();

      expect(result.data).toBeUndefined();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe("Network error");
    });
  });
});
