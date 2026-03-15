/**
 * Insert and Update Tests
 *
 * Tests for the insert() and update() methods on EntitySet instances.
 * This validates type safety and required field constraints.
 */

import {
  and,
  eq,
  fmTableOccurrence,
  type InferTableSchema,
  lt,
  numberField,
  type Result,
  textField,
} from "@proofkit/fmodata";
import { InsertBuilder } from "@proofkit/fmodata/client/insert-builder";
import { ExecutableUpdateBuilder, UpdateBuilder } from "@proofkit/fmodata/client/update-builder";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod/v4";

describe("insert and update methods", () => {
  const _contactsTO = fmTableOccurrence(
    "contacts",
    {
      id: textField().primaryKey(),
      name: textField().notNull(),
      hobby: textField(),
    },
    {
      navigationPaths: ["users"],
    },
  );

  const users = fmTableOccurrence(
    "users",
    {
      id: textField().primaryKey(),
      username: textField().notNull(),
      email: textField(),
      count: numberField(),
      active: numberField()
        .notNull()
        .readValidator(z.coerce.boolean().default(true))
        .writeValidator(z.boolean().transform((v) => (v ? 1 : 0))),
    },
    {
      navigationPaths: ["contacts", "test"],
    },
  );

  // Users with required fields for insert
  const usersWithRequired = fmTableOccurrence("usersWithRequired", {
    id: textField().primaryKey(),
    username: textField().notNull(),
    email: textField().notNull(),
    createdAt: textField(),
  });

  const _testTO = fmTableOccurrence("test", {
    id: textField().primaryKey(),
    name: textField().notNull(),
  });

  type _UserFieldNames = keyof InferTableSchema<typeof users>;

  describe("insert method", () => {
    it("should return InsertBuilder when called", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const result = db.from(users).insert({ username: "test", active: true });
      expect(result).toBeInstanceOf(InsertBuilder);
    });

    it("should accept all fields as optional when no required specified", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      // @ts-expect-error - some fields are required, no empty object is allowed
      db.from(users).insert({});

      // @ts-expect-error - a required fields is missing
      db.from(users).insert({ username: "test" });

      // Should accept all fields
      db.from(users).insert({
        username: "test",
        email: "test@example.com",
        active: true,
      });
    });

    it("should require specified fields when required is set", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      // These should work - required fields are username and email
      db.from(usersWithRequired).insert({
        username: "test",
        email: "test@example.com",
      });

      db.from(usersWithRequired).insert({
        username: "test",
        email: "test@example.com",
      });

      // Type check: username and email should be required
      expectTypeOf(db.from(usersWithRequired).insert).parameter(0).toHaveProperty("username");
      expectTypeOf(db.from(usersWithRequired).insert).parameter(0).toHaveProperty("email");
    });

    it("should have execute() that returns Result without ODataRecordMetadata by default", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const builder = db.from(users).insert({ username: "test", active: true });

      expectTypeOf(builder.execute).returns.resolves.toMatchTypeOf<{
        data: InferTableSchema<typeof users> | undefined;
        error: Error | undefined;
      }>();
    });
  });

  describe("update method with builder pattern", () => {
    it("should return UpdateBuilder when update() is called", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const result = db.from(users).update({ username: "newname" });
      expect(result).toBeInstanceOf(UpdateBuilder);
    });

    it("should not have execute() on initial UpdateBuilder", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const updateBuilder = db.from(users).update({ username: "newname" });

      // Type check: execute should not exist on UpdateBuilder
      expectTypeOf(updateBuilder).not.toHaveProperty("execute");
    });

    it("should return ExecutableUpdateBuilder after byId()", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const result = db.from(users).update({ username: "newname" }).byId("user-123");
      expect(result).toBeInstanceOf(ExecutableUpdateBuilder);
    });

    it("should return ExecutableUpdateBuilder after where()", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const result = db
        .from(users)
        .update({ active: false })
        .where((q) => q.where(eq(users.active, true)));
      expect(result).toBeInstanceOf(ExecutableUpdateBuilder);
    });
  });

  describe("update by ID", () => {
    it("should generate correct URL for update by ID", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const updateBuilder = db.from(users).update({ username: "newname" }).byId("user-123");
      const config = updateBuilder.getRequestConfig();

      expect(config.method).toBe("PATCH");
      expect(config.url).toBe("/test_db/users('user-123')");
      expect(config.body).toBe(JSON.stringify({ username: "newname" }));
    });

    it("should return updatedCount type for update by ID", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const updateBuilder = db.from(users).update({ username: "newname" }).byId("user-123");

      // Type check: execute should return Result<{ updatedCount: number }>
      expectTypeOf(updateBuilder.execute).returns.resolves.toEqualTypeOf<Result<{ updatedCount: number }>>();
    });

    it("should execute update by ID and return count", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/test_db/users",
        method: "PATCH",
        status: 200,
        headers: { "fmodata.affected_rows": "1" },
        response: null,
      });

      const db = mock.database("test_db");

      const result = await db.from(users).update({ username: "newname" }).byId("user-123").execute();

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.updatedCount).toBe(1);
    });
  });

  describe("update by filter", () => {
    it("should generate correct URL for update by filter", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const updateBuilder = db
        .from(users)
        .update({ active: false })
        .where((q) => q.where(eq(users.active, true)));

      const config = updateBuilder.getRequestConfig();

      expect(config.method).toBe("PATCH");
      expect(config.url).toContain("/test_db/users");
      expect(config.url).toContain("$filter");
      expect(config.body).toBe(JSON.stringify({ active: false }));
    });

    it("should support complex filters with QueryBuilder", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const updateBuilder = db
        .from(users)
        .update({ active: false })
        .where((q) => q.where(and(eq(users.active, true), lt(users.count, 5))));

      const config = updateBuilder.getRequestConfig();

      expect(config.method).toBe("PATCH");
      expect(config.url).toContain("$filter");
    });

    it("should support QueryBuilder chaining in where callback", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const updateBuilder = db
        .from(users)
        .update({ active: false })
        .where((q) => q.where(eq(users.active, true)).top(10));

      const config = updateBuilder.getRequestConfig();

      expect(config.method).toBe("PATCH");
      expect(config.url).toContain("$filter");
      expect(config.url).toContain("$top");
    });

    it("should return updatedCount result type for filter-based update", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      const updateBuilder = db
        .from(users)
        .update({ active: false })
        .where((q) => q.where(eq(users.active, true)));

      // Type check: execute should return Result<{ updatedCount: number }>
      expectTypeOf(updateBuilder.execute).returns.resolves.toMatchTypeOf<{
        data: { updatedCount: number } | undefined;
        error: Error | undefined;
      }>();
    });

    it("should execute update by filter and return count", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/test_db/users",
        method: "PATCH",
        status: 204,
        headers: { "fmodata.affected_rows": "3" },
        response: null,
      });

      const db = mock.database("test_db");

      const result = await db
        .from(users)
        .update({ active: false })
        .where((q) => q.where(eq(users.active, true)))
        .execute();

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ updatedCount: 3 });
    });
  });

  describe("update with optional fields", () => {
    it("should allow all fields to be optional for updates", () => {
      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      // All fields should be optional for updates (updateRequired removed)
      db.from(usersWithRequired).update({
        username: "test",
      });

      db.from(usersWithRequired).update({
        email: "test@example.com",
      });

      // Can update with empty object
      db.from(usersWithRequired).update({});
    });

    it("should keep all fields optional regardless of insert requirements", () => {
      const usersForUpdate = fmTableOccurrence("usersForUpdate", {
        id: textField().primaryKey(),
        username: textField().notNull(), // Required for insert, but not for update
        email: textField().notNull(), // Required for insert, but not for update
        status: textField(),
      });

      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      // All fields are optional for update, even those required for insert
      db.from(usersForUpdate).update({
        status: "active",
      });

      db.from(usersForUpdate).update({
        username: "newname",
      });

      db.from(usersForUpdate).update({});
    });
  });

  describe("readOnly fields", () => {
    it("should exclude id field from insert automatically", () => {
      const usersWithReadOnly = fmTableOccurrence("usersWithReadOnly", {
        id: textField().primaryKey(),
        createdAt: textField().readOnly(),
        modifiedAt: textField().readOnly(),
        username: textField(),
        email: textField(),
      });

      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      // id, createdAt, and modifiedAt should not be available for insert
      db.from(usersWithReadOnly).insert({
        username: "john",
        // email: "john@example.com",

        // @ts-expect-error - primary key should be readOnly by default
        id: "123",
      });

      db.from(usersWithReadOnly).insert({
        username: "john",

        // @ts-expect-error - createdAt should be readOnly
        createdAt: "2025-01-01",
      });

      db.from(usersWithReadOnly).insert({
        username: "john",

        // @ts-expect-error - createdAt should be readOnly
        modifiedAt: "2025-01-01",
      });

      // Type check: id, createdAt, modifiedAt should not be in insert data type
      expectTypeOf(db.from(usersWithReadOnly).insert).parameter(0).not.toHaveProperty("id");

      expectTypeOf(db.from(usersWithReadOnly).insert).parameter(0).not.toHaveProperty("createdAt");

      expectTypeOf(db.from(usersWithReadOnly).insert).parameter(0).not.toHaveProperty("modifiedAt");
    });

    it("should exclude id field and readOnly fields from update", () => {
      const usersWithReadOnlyTO = fmTableOccurrence("usersWithReadOnly", {
        id: textField().primaryKey(),
        createdAt: textField().readOnly(),
        modifiedAt: textField().readOnly(),
        username: textField(),
        email: textField(),
      });

      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      // id, createdAt, and modifiedAt should not be available for update
      db.from(usersWithReadOnlyTO).update({
        username: "newname",
      });

      db.from(usersWithReadOnlyTO).update({
        email: "newemail@example.com",
      });

      // Type check: id, createdAt, modifiedAt should not be in update data type
      expectTypeOf(db.from(usersWithReadOnlyTO).update).parameter(0).not.toHaveProperty("id");

      expectTypeOf(db.from(usersWithReadOnlyTO).update).parameter(0).not.toHaveProperty("createdAt");

      expectTypeOf(db.from(usersWithReadOnlyTO).update).parameter(0).not.toHaveProperty("modifiedAt");
    });

    it("should allow inserts without specifying readOnly fields", () => {
      const usersWithReadOnlyTO = fmTableOccurrence("usersWithReadOnly", {
        id: textField().primaryKey(),
        createdAt: textField().readOnly(),
        username: textField(),
        email: textField(), // nullable by default
      });

      const mock = new MockFMServerConnection();
      const db = mock.database("test_db");

      // Should work - id and createdAt are excluded automatically
      db.from(usersWithReadOnlyTO).insert({
        username: "john",
        email: "john@example.com",
      });

      // Should work - email is optional (nullable)
      db.from(usersWithReadOnlyTO).insert({
        username: "jane",
      });
    });
  });

  describe("error handling", () => {
    it("should return error on failed update by ID", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/test_db/users",
        throwError: new Error("Network error"),
        response: null,
      });

      const db = mock.database("test_db");

      const result = await db.from(users).update({ username: "newname" }).byId("user-123").execute();

      expect(result.data).toBeUndefined();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe("Network error");
    });

    it("should return error on failed update by filter", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/test_db/users",
        throwError: new Error("Network error"),
        response: null,
      });

      const db = mock.database("test_db");

      const result = await db
        .from(users)
        .update({ active: false })
        .where((q) => q.where(eq(users.active, true)))
        .execute();

      expect(result.data).toBeUndefined();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe("Network error");
    });
  });
});
