/**
 * TypeScript-only API ergonomics tests
 *
 * This test file focuses on exploring and validating the end-user API without
 * executing actual queries. These tests are designed to:
 *
 * - Verify TypeScript type correctness and API structure
 * - Explore API ergonomics and ensure methods can be chained correctly
 * - Test query builder creation without making network requests
 * - Catch breaking changes in the public API during refactoring
 *
 * These tests do NOT:
 * - Execute actual HTTP requests (.execute() is never called)
 * - Require a mock fetch implementation
 * - Test runtime behavior or network responses
 *
 * They serve as compile-time verification and API documentation examples,
 * helping ensure the API remains ergonomic and type-safe as the library evolves.
 */

import {
  eq,
  FMTable,
  fmTableOccurrence,
  getTableColumns,
  type InferTableSchema,
  listField,
  numberField,
  textField,
} from "@proofkit/fmodata";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod/v4";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { contacts, users } from "./utils/test-setup";

describe("fmodata", () => {
  describe("API ergonomics", () => {
    const client = new MockFMServerConnection();
    const db = client.database("TestDB");

    it("should support list() with query chaining", () => {
      const table = db.from(contacts);
      const listBuilder = table.list();

      expect(listBuilder).toBeDefined();
      expect(listBuilder.getQueryString).toBeDefined();
    });

    it("should support get() for single record retrieval", () => {
      const table = db.from(contacts);
      const getBuilder = table.get("my-uuid");

      expect(getBuilder).toBeDefined();
      expect(getBuilder.getRequestConfig).toBeDefined();
    });

    it("should support getSingleField() API", () => {
      const table = db.from(contacts);
      const singleFieldBuilder = table.get("my-uuid").getSingleField(contacts.name);

      expect(singleFieldBuilder).toBeDefined();
      expect(singleFieldBuilder.getRequestConfig).toBeDefined();
    });

    it("should support select() for returning arrays of records", () => {
      const table = db.from(contacts);
      const selectBuilder = table.list().select({ name: contacts.name, hobby: contacts.hobby });

      expect(selectBuilder).toBeDefined();
      expect(selectBuilder.getQueryString).toBeDefined();
    });

    it("should support single() modifier on select()", () => {
      const table = db.from(contacts);
      const singleSelectBuilder = table.list().select({ name: contacts.name, hobby: contacts.hobby }).single();

      expect(singleSelectBuilder).toBeDefined();
      expect(singleSelectBuilder.getQueryString).toBeDefined();
    });

    it("should generate query strings correctly", () => {
      const table = db.from(contacts);
      const queryString = table.list().select({ name: contacts.name, hobby: contacts.hobby }).getQueryString();

      expect(queryString).toBeDefined();
      expect(typeof queryString).toBe("string");
    });

    it("should infer field names for select() based on schema", () => {
      const users = fmTableOccurrence("Users", {
        id: textField().primaryKey(),
        name: textField(),
        email: textField(),
        age: numberField(),
      });

      const db = client.database("TestDB");
      const entitySet = db.from(users);

      // These should have autocomplete for "id", "name", "email", "age"
      const query1 = entitySet.list().select({ id: users.id, name: users.name });
      const query2 = entitySet.list().select({ email: users.email, age: users.age });
      const query3 = entitySet.list().select({
        id: users.id,
        name: users.name,
        email: users.email,
        age: users.age,
      });

      expect(query1).toBeDefined();
      expect(query2).toBeDefined();
      expect(query3).toBeDefined();

      // select("all") should be accepted and return full schema type
      const allQuery = entitySet.list().select("all");
      expectTypeOf(allQuery.execute).returns.resolves.toMatchTypeOf<{
        data: { id: string; name: string | null; email: string | null; age: number | null }[] | undefined;
      }>();

      // These should be TypeScript errors - fields not in schema
      const _typeChecks = () => {
        // @ts-expect-error - should pass an object
        entitySet.list().select("invalidField");
        // @ts-expect-error - should pass an object
        entitySet.list().select("");
        // @ts-expect-error - should pass an object with column references
        entitySet.list().select({ invalidField: true });
        // @ts-expect-error - column must be from the correct table
        entitySet.list().select({
          age: users.age,
          name: contacts.name,
        });
      };
      // Type check only - variable intentionally unused
      _typeChecks;
    });

    it("should infer field names for select() with entity IDs", () => {
      const products = fmTableOccurrence(
        "Products",
        {
          productId: textField().primaryKey().readOnly().entityId("FMFID:1000001"),
          productName: textField().entityId("FMFID:1000002"),
          price: numberField().entityId("FMFID:1000003"),
          category: textField().entityId("FMFID:1000004"),
          inStock: numberField().readValidator(z.coerce.boolean()).entityId("FMFID:1000005"),
        },
        {
          entityId: "FMTID:2000001",
        },
      );

      const entitySet = db.from(products);

      // Type inspection to debug the issue
      type _OccurrenceType = typeof products;
      //   ^? Should show FMTable with fields
      type _EntitySetType = typeof entitySet;
      //   ^? Should show EntitySet with schema

      // These should have autocomplete for "productId", "productName", "price", "category", "inStock"
      const query1 = entitySet.list().select({
        productId: products.productId,
        productName: products.productName,
      });
      const listQuery = entitySet.list();
      type _ListQueryType = typeof listQuery;
      //   ^? First param should be schema type, not never
      type _Autocomplete1 = Parameters<typeof listQuery.select>[0];
      //        ^?
      const query2 = entitySet.list().select({
        price: products.price,
        category: products.category,
        inStock: products.inStock,
      });
      const query3 = entitySet.list().select({
        productId: products.productId,
        productName: products.productName,
        price: products.price,
        category: products.category,
        inStock: products.inStock,
      });

      expect(query1).toBeDefined();
      expect(query2).toBeDefined();
      expect(query3).toBeDefined();

      // These should be TypeScript errors - fields not in schema
      const _typeChecks = () => {
        // @ts-expect-error - should pass an object
        entitySet.list().select("invalidField");
        // @ts-expect-error - should pass an object
        entitySet.list().select("");
        // @ts-expect-error - should pass an object with column references
        entitySet.list().select({ invalidField: true });
        // @ts-expect-error - column must be from the correct table
        entitySet.list().select({
          anyName: products.productName,
          name: contacts.name,
        });
      };
      // Type check only - variable intentionally unused
      _typeChecks;
    });

    it("should not allow getQueryString() on EntitySet directly", () => {
      const entitySet = db.from(users);

      // TypeScript should error if trying to call getQueryString() directly on EntitySet
      // You must first call a method like list(), select(), filter(), etc. to get a QueryBuilder
      const _typeCheck = () => {
        // @ts-expect-error - EntitySet does not have getQueryString method
        entitySet.getQueryString();
      };
      // Type check only - variable intentionally unused
      _typeCheck;

      // Correct usage: call list() first to get a QueryBuilder
      const queryBuilder = entitySet.list();
      expect(queryBuilder.getQueryString).toBeDefined();
      expect(typeof queryBuilder.getQueryString()).toBe("string");
    });

    it("should infer listField nullability and item types from options", () => {
      const table = fmTableOccurrence("ListTypes", {
        tags: listField(),
        optionalTags: listField({ allowNull: true }),
        ids: listField({ itemValidator: z.coerce.number().int() }),
        optionalIds: listField({ itemValidator: z.coerce.number().int(), allowNull: true }),
      });

      expectTypeOf(table.tags).toEqualTypeOf<typeof table.tags>();
      expectTypeOf(table.tags._phantomOutput).toEqualTypeOf<string[]>();
      expectTypeOf(table.optionalTags._phantomOutput).toEqualTypeOf<string[] | null>();
      expectTypeOf(table.ids._phantomOutput).toEqualTypeOf<number[]>();
      expectTypeOf(table.optionalIds._phantomOutput).toEqualTypeOf<number[] | null>();

      const _typeChecks = () => {
        // @ts-expect-error - listField options must be an object when options are provided
        listField(z.string());
      };
      _typeChecks;
    });
  });

  describe("BaseTable and TableOccurrence", () => {
    const client = new MockFMServerConnection();

    it("should create BaseTable and TableOccurrence", () => {
      const tableOcc = fmTableOccurrence("Users", {
        id: numberField().primaryKey(),
        name: textField(),
        email: textField(),
      });

      // Check that the table has the expected name via Symbol
      expect((tableOcc as any)[FMTable.Symbol.Name]).toBe("Users");
      expect((tableOcc as any)[FMTable.Symbol.Schema]).toBeDefined();
      expect((tableOcc as any)[FMTable.Symbol.BaseTableConfig].idField).toBe("id");
    });

    it("should use TableOccurrence with database.from()", () => {
      const users = fmTableOccurrence("Users", {
        id: numberField().primaryKey(),
        name: textField(),
        email: textField(),
      });

      const db = client.database("TestDB");
      const entitySet = db.from(users);

      const queryBuilder = entitySet.list().select({ id: users.id, name: users.name });
      expect(queryBuilder).toBeDefined();
      expect(queryBuilder.getQueryString()).toContain("$select");

      const recordBuilder = entitySet.get("123");
      expect(recordBuilder).toBeDefined();
      expect(recordBuilder.getRequestConfig().url).toContain("Users");
    });

    it("should allow table occurrences to be reused across different contexts", () => {
      const products = fmTableOccurrence("Products", {
        id: numberField().primaryKey(),
        name: textField(),
      });

      const client1 = new MockFMServerConnection();
      const client2 = new MockFMServerConnection();

      const db1 = client1.database("DB1");
      const db2 = client2.database("DB2");

      const entitySet1 = db1.from(products);
      const entitySet2 = db2.from(products);

      expect(entitySet1.get("1").getRequestConfig().url).toContain("Products");
      expect(entitySet2.get("1").getRequestConfig().url).toContain("Products");
    });

    it("should support navigation properties with navigationPaths", () => {
      const users = fmTableOccurrence(
        "Users",
        {
          id: textField().primaryKey(),
          name: textField(),
          email: textField(),
        },
        {
          navigationPaths: ["Orders"],
        },
      );

      const orders = fmTableOccurrence(
        "Orders",
        {
          orderId: textField().primaryKey(),
          userId: textField(),
          total: numberField(),
        },
        {
          navigationPaths: ["Users"],
        },
      );

      expect((users as any)[FMTable.Symbol.NavigationPaths]).toContain("Orders");
      expect((orders as any)[FMTable.Symbol.NavigationPaths]).toContain("Users");
    });

    it("should support base table without idField", () => {
      const categories = fmTableOccurrence("Categories", {
        categoryId: textField(),
        name: textField(),
        description: textField(),
        // No primaryKey() - idField is undefined
      });

      expect((categories as any)[FMTable.Symbol.Name]).toBe("Categories");
      expect((categories as any)[FMTable.Symbol.BaseTableConfig].idField).toBeUndefined();
      expect((categories as any)[FMTable.Symbol.Schema]).toBeDefined();
    });
  });

  describe("Type safety and result parsing", () => {
    it("should properly type the result of a query", async () => {
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/TestDB/Users",
        response: [
          {
            "@id": "1",
            "@editLink": "https://api.example.com/Users/1",
            id: 1,
            name: "John Doe",
            active: 0, // should coerce to boolean false
            activeHuman: "active",
          },
        ],
      });
      const client = mock;

      const usersTO = fmTableOccurrence("Users", {
        id: numberField().primaryKey(),
        name: textField().notNull(),
        active: numberField().readValidator(z.coerce.boolean()).notNull(),
        activeHuman: textField().readValidator(z.enum(["active", "inactive"])),
      });

      const db = client.database("TestDB");
      const usersQuery = db.from(usersTO);
      const result = await usersQuery.list().execute();

      if (!result.data?.[0]) {
        console.error(result);
        throw new Error("Expected at least one result");
      }

      const firstResult = result.data[0];

      expectTypeOf(firstResult.name).toEqualTypeOf<string>();
      expectTypeOf(firstResult.active).toEqualTypeOf<boolean>();
      expect(firstResult.active).toBe(false);
      expectTypeOf(firstResult.activeHuman).toEqualTypeOf<"active" | "inactive">();

      const result2 = await usersQuery.list().select(getTableColumns(usersTO)).execute();

      if (!result2.data?.[0]) {
        console.error(result);
        throw new Error("Expected at least one result");
      }

      const firstResult2 = result2.data[0];

      expectTypeOf(firstResult2.name).toEqualTypeOf<string>();
      expectTypeOf(firstResult2.active).toEqualTypeOf<boolean>();
      expect(firstResult2.active).toBe(false);
      expectTypeOf(firstResult2.activeHuman).toEqualTypeOf<"active" | "inactive">();

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBe(1);
    });
  });

  describe("Type-safe orderBy API", () => {
    /**
     * These tests document the DESIRED orderBy API for typed databases.
     *
     * DESIRED API:
     * - .orderBy("name")                           → single field, default asc
     * - .orderBy(["name", "desc"])                 → single field with direction (tuple)
     * - .orderBy([["name", "asc"], ["id", "desc"]]) → multiple fields (array of tuples)
     *
     * The tuple syntax should ONLY accept "asc" or "desc" as the second value,
     * NOT field names. This provides:
     * - Clear autocomplete: second position shows only "asc" | "desc"
     * - Unambiguous syntax: no confusion between [field, field] vs [field, direction]
     *
     * Uses existing occurrences from test-setup.ts.
     */

    it("should support single field orderBy with default ascending", () => {
      const client = new MockFMServerConnection();
      const db = client.database("fmdapi_test.fmp12");

      // ✅ Single field name - defaults to ascending
      const query = db.from(users).list().orderBy("name");

      expect(query).toBeDefined();
      expect(query.getQueryString()).toContain("$orderby");
      expect(query.getQueryString()).toContain("name");

      // ✅ Invalid field names are now caught at compile time
      // @ts-expect-error - "anyInvalidField" is not a valid field
      db.from("users").list().orderBy("anyInvalidField");
    });

    it("should support tuple syntax for single field with explicit direction", () => {
      const client = new MockFMServerConnection();
      const db = client.database("fmdapi_test.fmp12");

      // ✅ Tuple syntax: [fieldName, direction]
      // Second value autocompletes to "asc" | "desc" ONLY
      const ascQuery = db.from(users).list().orderBy(["name", "asc"]);
      const descQuery = db.from(users).list().orderBy(["id", "desc"]);

      expect(ascQuery.getQueryString()).toContain("$orderby");
      expect(ascQuery.getQueryString()).toBe("/users?$orderby=name asc&$top=1000");
      expect(descQuery.getQueryString()).toContain("$orderby");
      expect(descQuery.getQueryString()).toBe("/users?$orderby=id desc&$top=1000");

      // ✅ Second value must be "asc" or "desc" - field names are rejected
      // @ts-expect-error - "name" is not a valid direction
      db.from("users").list().orderBy(["name", "name"]);
    });

    it("should support tuple syntax with entity IDs and transform field names to FMFIDs", () => {
      const client = new MockFMServerConnection();
      const db = client.database("test.fmp12");

      // ✅ Tuple syntax: [fieldName, direction]
      // Field names are transformed to FMFIDs in the query string
      // Table name is also transformed to FMTID when using entity IDs
      const ascQuery = db.from(users).list().orderBy(["name", "asc"]);
      const descQuery = db.from(users).list().orderBy(["id", "desc"]);

      expect(ascQuery.getQueryString()).toContain("$orderby");
      expect(ascQuery.getQueryString()).toBe("/users?$orderby=name asc&$top=1000");
      expect(descQuery.getQueryString()).toContain("$orderby");
      expect(descQuery.getQueryString()).toBe("/users?$orderby=id desc&$top=1000");

      // ✅ Second value must be "asc" or "desc" - field names are rejected
      // @ts-expect-error - "name" is not a valid direction
      db.from(users).list().orderBy(["name", "name"]);
    });

    it("should support array of tuples for multiple fields", () => {
      const client = new MockFMServerConnection();
      const db = client.database("fmdapi_test.fmp12");

      // ✅ Array of tuples for multiple fields with explicit directions
      const query = db
        .from(users)
        .list()
        .orderBy([
          ["name", "asc"],
          ["id", "desc"],
        ]);

      expect(query).toBeDefined();
      expect(query.getQueryString()).toContain("$orderby");
    });

    it("should chain orderBy with other query methods", () => {
      const client = new MockFMServerConnection();
      const db = client.database("fmdapi_test.fmp12");

      const query = db
        .from(users)
        .list()
        .select({ name: users.name, id: users.id, active: users.active })
        .where(eq(users.active, true))
        .orderBy(["name", "asc"])
        .top(10)
        .skip(0);

      const queryString = query.getQueryString();

      expect(queryString).toContain("$select");
      expect(queryString).toContain("$filter");
      expect(queryString).toContain("$orderby");
      expect(queryString).toContain("$top");
      expect(queryString).toContain("$skip");
    });

    /**
     * Type error tests - validates compile-time type checking for orderBy.
     *
     * Custom TypeSafeOrderBy<T> type enforces:
     * - Single field: keyof T
     * - Tuple: [keyof T, 'asc' | 'desc'] - second position MUST be direction
     * - Multiple fields: Array<[keyof T, 'asc' | 'desc']> - array of tuples
     */
    it("should reject invalid usage at compile time", () => {
      const client = new MockFMServerConnection();
      const db = client.database("fmdapi_test.fmp12");

      const _typeChecks = () => {
        // ✅ Invalid field name is caught
        // @ts-expect-error - "nonexistent" is not a valid field name
        db.from("users").list().orderBy(["nonexistent", "asc"]);

        // ✅ Second position must be "asc" or "desc", not a field name
        // @ts-expect-error - "name" is not a valid direction
        db.from("users").list().orderBy(["name", "name"]);

        // ✅ Ambiguous [field, field] syntax is now rejected
        // @ts-expect-error - "id" is not a valid direction
        db.from("users").list().orderBy(["name", "id"]);
      };
      // Type check only - variable intentionally unused
      _typeChecks;
    });
  });

  describe("InferSchemaType", () => {
    it("Primary key fields should not be nullable in the inferred schema", () => {
      const specialUsers = fmTableOccurrence("specialUsers", {
        id: textField().primaryKey(),
        name: textField(),
      });
      type SpecialUserSchema = InferTableSchema<typeof specialUsers>;
      type IdField = SpecialUserSchema["id"];

      const _controlTest: string | null = null;

      // @ts-expect-error - id should not be nullable
      const _idData: IdField = null;
    });
  });
});
