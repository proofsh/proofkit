/**
 * Expand API Specification Tests
 *
 * These tests define the expected TypeScript behavior for the expand() API.
 * They use expectTypeOf to validate strict typing at compile time.
 *
 * DO NOT RUN THESE TESTS YET - they define the API we want to build.
 */

import { eq, FMServerConnection, fmTableOccurrence, numberField, textField } from "@proofkit/fmodata";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { assert, describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod/v4";
import { mockResponses } from "./fixtures/responses";

describe("Expand API Specification", () => {
  // Spec test table definitions (simplified for type testing)
  const userCustomer = fmTableOccurrence(
    "user_customer",
    {
      id: textField().primaryKey(),
      name: textField().notNull(),
      address: textField(),
      tier: textField().notNull(),
    },
    {
      defaultSelect: "all",
    },
  );

  const contacts = fmTableOccurrence(
    "contacts",
    {
      id: textField().primaryKey(),
      name: textField().notNull(),
      hobby: textField(),
      id_user: textField().notNull(),
    },
    {
      defaultSelect: "all",
      navigationPaths: ["users", "other_users"],
    },
  );

  const users = fmTableOccurrence(
    "users",
    {
      id: textField().primaryKey(),
      username: textField().notNull(),
      email: textField().notNull(),
      active: numberField().readValidator(z.coerce.boolean()).notNull(),
      id_customer: textField(),
    },
    {
      defaultSelect: "all",
      navigationPaths: ["user_customer", "contacts"],
    },
  );

  const otherUsers = fmTableOccurrence(
    "other_users",
    {
      id: textField().primaryKey(),
      username: textField().notNull(),
      email: textField().notNull(),
      active: numberField().readValidator(z.coerce.boolean()).notNull(),
      id_customer: textField().notNull(),
    },
    {
      defaultSelect: "all",
    },
  );

  // Real server schema table definitions (for validation tests that use captured responses)
  const contactsReal = fmTableOccurrence(
    "contacts",
    {
      PrimaryKey: textField().primaryKey(),
      CreationTimestamp: textField(),
      CreatedBy: textField(),
      ModificationTimestamp: textField(),
      ModifiedBy: textField(),
      name: textField(),
      hobby: textField(),
      id_user: textField(),
      my_calc: textField(),
    },
    {
      defaultSelect: "all",
      navigationPaths: ["users"],
    },
  );

  const usersReal = fmTableOccurrence(
    "users",
    {
      id: textField().primaryKey(),
      CreationTimestamp: textField(),
      CreatedBy: textField(),
      ModificationTimestamp: textField(),
      ModifiedBy: textField(),
      name: textField(),
      id_customer: textField(),
    },
    {
      defaultSelect: "all",
      navigationPaths: ["user_customer", "contacts"],
    },
  );

  const db = new MockFMServerConnection().database("test_db");

  describe("Simple expand (no callback)", () => {
    it("should generate query string for simple expand", () => {
      const queryString = db.from(contacts).list().expand(users).getQueryString();
      expect(queryString).toBe("/contacts?$top=1000&$expand=users");
    });

    it("should not allow arbitrary string relations", () => {
      db.from(contacts)
        .list()
        // @ts-expect-error - arbitrary string relation
        .expand("arbitrary_relation")
        .getQueryString();
    });
  });

  describe("Expand with callback - select", () => {
    it("should type callback builder to target table schema", () => {
      db.from(contacts)
        .list()
        .expand(users, (builder) => {
          // builder.select should only accept fields from users table
          expectTypeOf(builder.select).parameter(0).not.toEqualTypeOf<string>();

          return builder.select({
            username: users.username,
            email: users.email,
          });
        });
    });

    it("should have a properly typed response", () => {
      // checking types only, don't actually make a request
      async () => {
        const result = await db
          .from(contacts)
          .list()
          .expand(users, (b) => b.select({ username: users.username, email: users.email }))
          .execute();

        if (!result.data || result.data.length === 0) {
          throw new Error("Expected result.data to be defined and non-empty");
        }
        const firstRecord = result.data[0];
        if (!firstRecord) {
          throw new Error("Expected firstRecord to be defined");
        }

        // runtime tests to ensure the fields are not present
        // @ts-expect-error - these fields should not be present
        expect(firstRecord.ROWID).toBeUndefined();
        // @ts-expect-error - these fields should not be present
        expect(firstRecord.ROWMODID).toBeUndefined();

        // ROWID and MODID weren't selected, it's not returned by default
        expectTypeOf(firstRecord).not.toHaveProperty("ROWID");
        expectTypeOf(firstRecord).not.toHaveProperty("ROWMODID");

        // no select was called, so all fields are returned
        expectTypeOf(firstRecord).toHaveProperty("name");

        // users was expanded, so it will be an array in the response
        expectTypeOf(firstRecord).toHaveProperty("users");
        expectTypeOf(firstRecord.users).toBeArray();
        const firstUser = firstRecord.users[0];
        if (!firstUser) {
          throw new Error("Expected firstUser to be defined");
        }
      };
    });

    it("should generate query string with $select", () => {
      const queryString = db
        .from(contacts)
        .list()
        .expand(users, (b) => b.select({ username: users.username, email: users.email }))
        .getQueryString();

      expect(queryString).toBe("/contacts?$top=1000&$expand=users($select=username,email)");
    });

    it("should enforce callback returns builder", () => {
      db.from(contacts)
        .list()
        .expand(users, (b) => {
          // Must return the builder
          return b.select({ username: users.username });
        });
    });
  });

  describe("Expand with callback - filter", () => {
    it("should generate query string with $filter", () => {
      const queryString = db
        .from(contacts)
        .list()
        .expand(users, (b) => b.where(eq(users.active, 1)))
        .getQueryString();

      expect(queryString).toContain("$expand=users($filter=active");
    });
  });

  describe("Expand with callback - orderBy", () => {
    it("should generate query string with $orderby", () => {
      const queryString = db
        .from(contacts)
        .list()
        .expand(users, (b) => b.orderBy("username"))
        .getQueryString();

      expect(queryString).toContain("$expand=users($orderby=username");
    });
  });

  describe("Expand with callback - top and skip", () => {
    it("should generate query string with $top", () => {
      const queryString = db
        .from(contacts)
        .list()
        .expand(users, (b) => b.top(5))
        .getQueryString();

      expect(queryString).toContain("$expand=users($top=5");
    });

    it("should generate query string with $skip", () => {
      const queryString = db
        .from(contacts)
        .list()
        .expand(users, (b) => b.skip(10))
        .getQueryString();

      expect(queryString).toContain("$expand=users($skip=10");
    });
  });

  describe("Multiple expands (chaining)", () => {
    it("should allow chaining multiple expand calls", () => {
      const queryString = db
        .from(contacts)
        .list()
        .expand(users, (b) => b.select({ username: users.username }))
        .expand(otherUsers)
        .getQueryString();

      expect(queryString).toBe("/contacts?$top=1000&$expand=users($select=username),other_users");
    });

    it("should type each expand callback independently", () => {
      db.from(contacts)
        .list()
        .expand(users, (builder) => {
          // First callback typed to users
          expectTypeOf(builder.select).parameter(0).not.toEqualTypeOf<string>();

          return builder.select({ username: users.username });
        })
        .expand(otherUsers, (builder) => {
          // Second callback - arbitrary relation so accepts any
          return builder.select({ email: otherUsers.email });
        });
    });
  });

  describe("Nested expands", () => {
    it("should type nested expand callback to nested target schema", () => {
      const query = db
        .from(contacts)
        .list()
        .expand(users, (usersBuilder) => {
          return usersBuilder
            .select({ username: users.username, email: users.email })
            .expand(userCustomer, (customerBuilder) => {
              // customerBuilder should be typed to customer schema
              // Verify it accepts valid fields
              return customerBuilder.select({
                name: userCustomer.name,
                tier: userCustomer.tier,
              });
            });
        });

      // type tests, don't run this code
      async () => {
        const result = await query.execute();

        if (!result.data || result.data.length === 0) {
          throw new Error("Expected result.data to be defined and non-empty");
        }
        const firstRecord = result.data[0];
        if (!firstRecord) {
          throw new Error("Expected firstRecord to be defined");
        }

        const firstUser = firstRecord.users[0];
        if (!firstUser) {
          throw new Error("Expected firstUser to be defined");
        }

        // @ts-expect-error - this field was not selected, so it shouldn't be in the type
        firstUser.id_customer;
        expectTypeOf(firstUser).not.toHaveProperty("id_customer");
        expectTypeOf(firstUser).toHaveProperty("username");
      };
    });

    it("should validate nested expands on single record", async () => {
      // This test uses real server schema (contactsReal, usersReal) to match captured responses
      const mockData = mockResponses["deep nested expand"];
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/test_db/contacts",
        response: mockData.response,
        status: mockData.status,
        headers: mockData.headers,
      });
      const mockDb = mock.database("test_db");
      const result = await mockDb
        .from(contactsReal)
        .get("B5BFBC89-03E0-47FC-ABB6-D51401730227")
        .expand(usersReal, (usersBuilder) => {
          return usersBuilder
            .select({ name: usersReal.name, id: usersReal.id })
            .expand(userCustomer, (customerBuilder) => {
              return customerBuilder.select({ name: userCustomer.name });
            });
        })
        .execute();

      assert(result.data, "Result data should be defined");
      expect(result.data.name).toBe("Eric");
      expect(result.data.hobby).toBe("Board games");
      expect(result.data.users).toBeDefined();

      // Type check: verify that only selected fields are typed correctly
      const firstUser = result.data.users?.[0];
      if (!firstUser) {
        throw new Error("Expected firstUser to be defined");
      }
      expectTypeOf(firstUser).toHaveProperty("name");
      expectTypeOf(firstUser).toHaveProperty("id");
      expectTypeOf(firstUser).toHaveProperty("user_customer");
      // @ts-expect-error - id_customer was not selected, should not be in type
      expectTypeOf(firstUser.id_customer).toBeNever();

      // Verify nested expand structure exists
      expect(firstUser.id).toBe("1A269FA3-82E6-465A-94FA-39EE3F2F9B5D");
      expect(firstUser.name).toBe("Test User");
      expect(firstUser.user_customer).toBeDefined();
      expect(Array.isArray(firstUser.user_customer)).toBe(true);
      expect(firstUser.user_customer.length).toBe(1);

      // Verify nested customer data
      const firstCustomer = firstUser.user_customer?.[0];
      assert(firstCustomer, "First customer should be defined");

      expectTypeOf(firstCustomer).toHaveProperty("name");
      // @ts-expect-error - other fields were not selected
      expectTypeOf(firstCustomer.address).toBeNever();
      // @ts-expect-error - tier was not selected
      expectTypeOf(firstCustomer.tier).toBeNever();

      expect(firstCustomer.name).toBe("test");
    });

    it("should validate nested expands on list query", async () => {
      // This test uses real server schema (contactsReal, usersReal) to match captured responses
      const mockData = mockResponses["list with nested expand"];
      const mock = new MockFMServerConnection();
      mock.addRoute({
        urlPattern: "/test_db/contacts",
        response: mockData.response,
        status: mockData.status,
        headers: mockData.headers,
      });
      const mockDb = mock.database("test_db");
      const result = await mockDb
        .from(contactsReal)
        .list()
        .expand(usersReal, (usersBuilder) => {
          // No select on users - all fields should be returned
          return usersBuilder.expand(userCustomer, (customerBuilder) => {
            return customerBuilder.select({ name: userCustomer.name });
          });
        })
        .execute();

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data?.length).toBe(2);

      // Type check: verify list results are properly typed
      const firstContact = result.data?.[0];
      if (firstContact) {
        // Contact should have all its fields (no select was called on contacts)
        expectTypeOf(firstContact).toHaveProperty("name");
        expectTypeOf(firstContact).toHaveProperty("PrimaryKey");
        expectTypeOf(firstContact).toHaveProperty("hobby");

        // Verify users expand exists and is typed correctly
        expectTypeOf(firstContact).toHaveProperty("users");
        expectTypeOf(firstContact.users).toBeArray();

        // Verify runtime data (note: response has 'name' not 'id' due to real server schema)
        expect(firstContact.name).toBe("Eric");
        expect(firstContact.hobby).toBe("Board games");
        expect(firstContact.users).toBeDefined();
        expect(Array.isArray(firstContact.users)).toBe(true);
        expect(firstContact.users.length).toBe(1);

        const firstUser = firstContact.users?.[0];
        if (firstUser) {
          // All user fields should be present (no select was used)
          expectTypeOf(firstUser).toHaveProperty("id");
          expectTypeOf(firstUser).toHaveProperty("name");
          expectTypeOf(firstUser).toHaveProperty("id_customer");
          expectTypeOf(firstUser).toHaveProperty("user_customer");

          // Verify runtime data exists
          expect(firstUser.id).toBe("1A269FA3-82E6-465A-94FA-39EE3F2F9B5D");
          expect(firstUser.name).toBe("Test User");
          expect(firstUser.id_customer).toBe("3026B56E-0C6E-4F31-B666-EE8AC5B36542");
          expect(firstUser.user_customer).toBeDefined();
          expect(Array.isArray(firstUser.user_customer)).toBe(true);
          expect(firstUser.user_customer.length).toBe(1);

          // Verify nested customer data with selected fields only
          const firstCustomer = firstUser.user_customer?.[0];
          if (firstCustomer) {
            // Only 'name' was selected in nested expand
            expectTypeOf(firstCustomer).toHaveProperty("name");
            // @ts-expect-error - address was not selected, should not be in type
            expectTypeOf(firstCustomer.address).toBeNever();
            // @ts-expect-error - tier was not selected, should not be in type
            expectTypeOf(firstCustomer.tier).toBeNever();

            expect(firstCustomer.name).toBe("test");
          }
        }

        // Check second contact which has a different user structure
        const secondContact = result.data?.[1];
        if (secondContact) {
          expect(secondContact.name).toBe("Adam");
          expect(secondContact.hobby).toBe("trees");
          expect(secondContact.users).toBeDefined();
          expect(secondContact.users.length).toBe(1);

          const secondUser = secondContact.users?.[0];
          if (secondUser) {
            expect(secondUser.id).toBe("53D36C9A-8F90-4C21-A38F-F278D4F77718");
            expect(secondUser.name).toBe("adam user");
            expect(secondUser.id_customer).toBeNull();
            // This user has no customer, should be empty array
            expect(secondUser.user_customer).toEqual([]);
          }
        }
      }
    });

    it("should generate query string with nested $expand", () => {
      const queryString = db
        .from(contacts)
        .list()
        .expand(users, (b) =>
          b
            .select({ username: users.username })
            .expand(userCustomer, (nested) => nested.select({ name: userCustomer.name })),
        )
        .getQueryString();

      expect(queryString).toBe(
        "/contacts?$top=1000&$expand=users($select=username;$expand=user_customer($select=name))",
      );
    });

    it("should support deeply nested expands (3 levels)", () => {
      const queryString = db
        .from(contacts)
        .list()
        .expand(users, (b) =>
          b.expand(userCustomer, (nested) =>
            // If customer had relations, we could expand further
            nested.select({ name: userCustomer.name }),
          ),
        )
        .getQueryString();

      expect(queryString).toContain("$expand=user_customer($select=name)");
    });
  });

  describe("Complex combinations", () => {
    it("should support select + filter + orderBy + nested expand", () => {
      const queryString = db
        .from(contacts)
        .list()
        .expand(users, (b) =>
          b
            .select({ username: users.username, email: users.email })
            .where(eq(users.active, 1))
            .orderBy("username")
            .top(10)
            .expand(userCustomer, (nested) => nested.select({ name: userCustomer.name })),
        )
        .getQueryString();

      // Should contain all query options
      expect(queryString).toContain("$select=username,email");
      expect(queryString).toContain("$filter=active");
      expect(queryString).toContain("$orderby=username");
      expect(queryString).toContain("$top=10");
      expect(queryString).toContain("$expand=user_customer($select=name)");
    });

    it("should support multiple expands with different options", () => {
      const queryString = db
        .from(contacts)
        .list()
        .expand(users, (b) => b.select({ username: users.username }).where(eq(users.active, 1)))
        .expand(otherUsers, (b) => b.select({ email: otherUsers.email }).top(5))
        .getQueryString();

      expect(queryString).toBe(
        "/contacts?$top=1000&$expand=users($select=username;$filter=active eq 1),other_users($select=email;$top=5)",
      );
    });
  });

  describe("Integration with existing query methods", () => {
    it("should work with select on parent query", () => {
      const queryString = db
        .from(contacts)
        .list()
        .select({ name: contacts.name, hobby: contacts.hobby })
        .expand(users, (b) => b.select({ username: users.username }))
        .getQueryString();

      expect(queryString).toContain("$select=name,hobby");
      expect(queryString).toContain("$expand=users($select=username)");
    });

    it("should work with filter on parent query", () => {
      const queryString = db.from(contacts).list().where(eq(contacts.name, "Eric")).expand(users).getQueryString();

      expect(queryString).toContain("$filter=name eq");
      expect(queryString).toContain("$expand=users");
    });

    it("should work with orderBy, top, skip on parent query", () => {
      const queryString = db
        .from(contacts)
        .list()
        .orderBy("name")
        .top(20)
        .skip(10)
        .expand(users, (b) => b.select({ username: users.username }))
        .getQueryString();

      expect(queryString).toContain("$orderby=name");
      expect(queryString).toContain("$top=20");
      expect(queryString).toContain("$skip=10");
      expect(queryString).toContain("$expand=users($select=username)");
    });
  });
});

/**
 * GitHub Issue #109: Nested expand generates empty $select= causing OData parse error
 *
 * When expanding a table that has no readValidators and uses the default "schema"
 * defaultSelect, getDefaultSelectFields returns an empty array. This causes
 * buildExpandParts to generate "$select=" (empty) inside the expand, which
 * FileMaker OData cannot parse.
 *
 * @see https://github.com/proofkit/proofkit/issues/109
 */
const EMPTY_SELECT_CLOSE_PAREN = /\$select=\)/;
const EMPTY_SELECT_SEMICOLON = /\$select=;/;
const EMPTY_SELECT_END = /\$select=$/;
const EXPAND_CAPTURE = /\$expand=([^&]+)/;
const SELECT_CAPTURE = /\$select=([^;)]+)/;

describe("Issue #109: Empty $select in expand", () => {
  // Tables matching the issue reproduction: entity IDs, no defaultSelect (defaults to "schema"),
  // no readValidators on any fields
  const Parent = fmTableOccurrence(
    "Parent",
    {
      _pk: textField().primaryKey().entityId("FMFID:1"),
    },
    {
      entityId: "FMTID:1",
      navigationPaths: ["Child"],
    },
  );

  const Child = fmTableOccurrence(
    "Child",
    {
      _pk: textField().primaryKey().entityId("FMFID:2"),
      data: textField().entityId("FMFID:3"),
    },
    {
      entityId: "FMTID:2",
      navigationPaths: ["Parent"],
    },
  );

  const connection = new FMServerConnection({
    serverUrl: "https://example.com",
    auth: { username: "test", password: "test" },
  });

  const db = connection.database("Test.fmp12", { useEntityIds: true });

  it("should not generate empty $select= inside expand on .get()", () => {
    const queryString = db.from(Parent).get("test-id").expand(Child).getQueryString();

    // The query should NOT contain an empty $select= (i.e. "$select=)" or "$select=;")
    expect(queryString).not.toMatch(EMPTY_SELECT_CLOSE_PAREN);
    expect(queryString).not.toMatch(EMPTY_SELECT_SEMICOLON);
    expect(queryString).not.toMatch(EMPTY_SELECT_END);
  });

  it("should not generate empty $select= inside expand on .list()", () => {
    const queryString = db.from(Parent).list().expand(Child).getQueryString();

    expect(queryString).not.toMatch(EMPTY_SELECT_CLOSE_PAREN);
    expect(queryString).not.toMatch(EMPTY_SELECT_SEMICOLON);
  });

  it("should either omit $select or include all fields in expand without callback", () => {
    const queryString = db.from(Parent).get("test-id").expand(Child).getQueryString();

    // If expand includes $select, it must have actual field names
    if (queryString.includes("$expand=")) {
      const expandMatch = queryString.match(EXPAND_CAPTURE);
      expect(expandMatch).toBeTruthy();
      const expandContent = expandMatch?.[1];
      // If there's a $select inside the expand parens, it must not be empty
      if (expandContent?.includes("$select=")) {
        const selectMatch = expandContent.match(SELECT_CAPTURE);
        expect(selectMatch).toBeTruthy();
        expect(selectMatch?.[1]?.length).toBeGreaterThan(0);
      }
    }
  });

  it("should not generate empty $select= in nested expand without explicit select", () => {
    const queryString = db
      .from(Parent)
      .get("test-id")
      .expand(Child, (b) => b.expand(Parent))
      .getQueryString();

    // Neither the Child expand nor the nested Parent expand should have empty $select=
    expect(queryString).not.toMatch(EMPTY_SELECT_CLOSE_PAREN);
    expect(queryString).not.toMatch(EMPTY_SELECT_SEMICOLON);
  });
});
