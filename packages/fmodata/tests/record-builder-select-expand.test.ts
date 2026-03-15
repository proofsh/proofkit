/**
 * RecordBuilder Select/Expand Tests
 *
 * Tests for type-safe select() and expand() methods on the RecordBuilder (.get())
 * These tests validate:
 * - Type-safe field selection with proper return type narrowing
 * - Type-safe relation expansion with callback support
 * - Query string generation
 * - Response validation with expanded data
 */

import { eq, fmTableOccurrence, numberField, textField, timestampField } from "@proofkit/fmodata";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod/v4";
import { arbitraryTable, contacts, invoices, users } from "./utils/test-setup";

const EXPAND_WITH_ID_REGEX = /\$expand=users\([^)]*id[^)]*\)/;
const SELECT_ID_REGEX = /\$select=["']?id["']?\)/;

describe("RecordBuilder Select/Expand", () => {
  const mock = new MockFMServerConnection();
  const db = mock.database("test_db");

  // Create occurrences with different defaultSelect values for testing
  const contactsWithSchemaSelect = fmTableOccurrence(
    "contacts",
    {
      PrimaryKey: textField().primaryKey(),
      CreationTimestamp: timestampField(),
      CreatedBy: textField(),
      ModificationTimestamp: timestampField(),
      ModifiedBy: textField(),
      name: textField(),
      hobby: textField(),
      id_user: textField(),
    },
    {
      defaultSelect: "schema", // Should select all schema fields
      navigationPaths: ["users"],
    },
  );

  const contactsWithArraySelect = fmTableOccurrence(
    "contacts",
    {
      PrimaryKey: textField().primaryKey(),
      CreationTimestamp: timestampField(),
      CreatedBy: textField(),
      ModificationTimestamp: timestampField(),
      ModifiedBy: textField(),
      name: textField(),
      hobby: textField(),
      id_user: textField(),
    },
    {
      defaultSelect: (table) => ({
        name: table.name,
        hobby: table.hobby,
        id_user: table.id_user,
      }), // Specific fields
      navigationPaths: ["users"],
    },
  );

  // Create occurrences with navigation where target has different defaultSelect values
  const _contactsForExpandTest = fmTableOccurrence(
    "contacts",
    {
      PrimaryKey: textField().primaryKey(),
      CreationTimestamp: timestampField(),
      CreatedBy: textField(),
      ModificationTimestamp: timestampField(),
      ModifiedBy: textField(),
      name: textField(),
      hobby: textField(),
      id_user: textField(),
    },
    {
      defaultSelect: "all", // Parent table uses all
      navigationPaths: ["users"],
    },
  );

  const usersWithSchemaSelect = fmTableOccurrence(
    "users",
    {
      id: textField().primaryKey().readValidator(z.uuid()),
      CreationTimestamp: timestampField(),
      CreatedBy: textField(),
      ModificationTimestamp: timestampField(),
      ModifiedBy: textField(),
      name: textField(),
      active: numberField().readValidator(z.coerce.boolean()),
      fake_field: textField(),
      id_customer: textField(),
    },
    {
      defaultSelect: "schema", // Target table uses schema
      navigationPaths: ["contacts"],
    },
  );

  const usersWithArraySelect = fmTableOccurrence(
    "users",
    {
      id: textField().primaryKey().readValidator(z.uuid()),
      CreationTimestamp: timestampField(),
      CreatedBy: textField(),
      ModificationTimestamp: timestampField(),
      ModifiedBy: textField(),
      name: textField(),
      active: numberField().readValidator(z.coerce.boolean()),
      fake_field: textField(),
      id_customer: textField(),
    },
    {
      defaultSelect: (table) => ({
        name: table.name,
        active: table.active,
      }), // Target table uses specific fields
      navigationPaths: ["contacts"],
    },
  );

  // const dbWithExpandArraySelect = client.database("test_db_expand_array");
  describe("defaultSelect on get()", () => {
    it("should apply defaultSelect: 'schema' fields to query string when no select is called", () => {
      const queryString = db.from(contactsWithSchemaSelect).get("test-uuid").getQueryString();

      // When defaultSelect is "schema", the query should include $select with all schema fields
      expect(queryString).toContain("$select=");

      // Should contain all fields from the contacts schema
      expect(queryString).toContain("PrimaryKey");
      expect(queryString).toContain("CreationTimestamp");
      expect(queryString).toContain("CreatedBy");
      expect(queryString).toContain("ModificationTimestamp");
      expect(queryString).toContain("ModifiedBy");
      expect(queryString).toContain("name");
      expect(queryString).toContain("hobby");
      expect(queryString).toContain("id_user");
    });

    it("should apply defaultSelect: array of fields to query string when no select is called", () => {
      const queryString = db.from(contactsWithArraySelect).get("test-uuid").getQueryString();

      // When defaultSelect is an array, the query should include $select with those specific fields
      expect(queryString).toContain("$select=");
      expect(queryString).toContain("name");
      expect(queryString).toContain("hobby");
      expect(queryString).toContain("id_user");

      // Should NOT contain fields not in the array
      expect(queryString).not.toContain("PrimaryKey");
      expect(queryString).not.toContain("CreationTimestamp");
    });

    it("should NOT apply defaultSelect when defaultSelect is 'all'", () => {
      const queryString = db.from(contacts).get("test-uuid").getQueryString();

      // When defaultSelect is "all", no $select should be added
      // (current behavior - FileMaker returns all fields)
      expect(queryString).toBe("/contacts('test-uuid')");
      expect(queryString).not.toContain("$select=");
    });

    it("should override defaultSelect when explicit select() is called", () => {
      const queryString = db
        .from(contactsWithSchemaSelect)
        .get("test-uuid")
        .select({ name: contactsWithSchemaSelect.name }) // Explicit select should override defaultSelect
        .getQueryString();

      expect(queryString).toContain("$select=name");
      // Should not contain other schema fields when explicit select is used
      expect(queryString).not.toContain("PrimaryKey");
      expect(queryString).not.toContain("hobby");
    });

    it('should clear defaultSelect when select("all") is called on get()', () => {
      const queryString = db.from(contactsWithSchemaSelect).get("test-uuid").select("all").getQueryString();

      // select("all") should remove $select entirely
      expect(queryString).toBe("/contacts('test-uuid')");
      expect(queryString).not.toContain("$select=");
    });

    it('should clear defaultSelect when select("all") is called on list()', () => {
      const queryString = db.from(contactsWithSchemaSelect).list().select("all").getQueryString();

      // select("all") should remove $select entirely
      expect(queryString).not.toContain("$select=");
    });

    it('should clear custom defaultSelect when select("all") is called', () => {
      const queryString = db.from(contactsWithArraySelect).get("test-uuid").select("all").getQueryString();

      expect(queryString).toBe("/contacts('test-uuid')");
      expect(queryString).not.toContain("$select=");
    });
  });

  describe("defaultSelect within expand()", () => {
    it("should apply target table defaultSelect: 'schema' in expand when no callback select is called", () => {
      // When expanding to 'users' which has defaultSelect: "schema",
      // the expand should automatically include $select with all user schema fields
      const queryString = db
        .from(contactsWithSchemaSelect)
        .get("test-uuid")
        .expand(usersWithSchemaSelect)
        .getQueryString();

      // The expand should include $select for the target table's schema fields
      expect(queryString).toContain("$expand=users");
      expect(queryString).toContain("$select=");

      // Should contain user schema fields within the expand
      expect(queryString).toContain("id");
      expect(queryString).toContain("name");
      expect(queryString).toContain("active");
    });

    it("should apply target table defaultSelect: array in expand when no callback select is called", () => {
      // When expanding to 'users' which has defaultSelect: ["name", "active"],
      // the expand should automatically include $select with those specific fields
      const queryString = db
        .from(contactsWithArraySelect)
        .get("test-uuid")
        .expand(usersWithArraySelect)
        .getQueryString();

      // The expand should include $select for the target table's default fields
      expect(queryString).toContain("$expand=users($select=");
      expect(queryString).toContain("name");
      expect(queryString).toContain("active");

      // Should NOT contain fields not in the defaultSelect array
      expect(queryString).not.toMatch(EXPAND_WITH_ID_REGEX);
    });

    it("should override target defaultSelect when callback provides explicit select", () => {
      // Even though users has defaultSelect: ["name", "active"],
      // an explicit callback select should override it
      const queryString = db
        .from(contactsWithArraySelect)
        .get("test-uuid")
        .expand(users, (b: any) => b.select({ id: users.id }))
        .getQueryString();

      // Should only have the explicitly selected field (quotes may vary based on odata-query library)
      expect(queryString).toContain("$expand=users($select=");
      expect(queryString).toMatch(SELECT_ID_REGEX);
      // Should NOT contain the defaultSelect fields
      expect(queryString).not.toContain("active");
    });

    it("should apply defaultSelect in expand on list() queries too", () => {
      const queryString = db.from(contactsWithArraySelect).list().expand(usersWithSchemaSelect).getQueryString();

      // The expand should include $select for the target table's default fields
      expect(queryString).toContain("$expand=users($select=");
      expect(queryString).toContain("name");
      expect(queryString).toContain("active");
    });
  });

  describe("select() method", () => {
    it("should generate query string with $select for single field", () => {
      const queryString = db.from(contacts).get("test-uuid").select({ name: contacts.name }).getQueryString();

      expect(queryString).toBe("/contacts('test-uuid')?$select=name");
    });

    it("should generate query string with $select for multiple fields", () => {
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        .select({
          name: contacts.name,
          hobby: contacts.hobby,
          id_user: contacts.id_user,
        })
        .getQueryString();

      expect(queryString).toContain("$select=");
      expect(queryString).toContain("name");
      expect(queryString).toContain("hobby");
      expect(queryString).toContain("id_user");
    });

    it("should deduplicate selected fields", () => {
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        .select({ name: contacts.name, hobby: contacts.hobby })
        .getQueryString();

      // Count occurrences of "name" - should only appear once
      const nameCount = (queryString.match(/name/g) || []).length;
      expect(nameCount).toBe(1);
    });

    it("should narrow return type to selected fields only", () => {
      const recordBuilder = db.from(contacts).get("test-uuid").select({ name: contacts.name, hobby: contacts.hobby });

      // Type test - the execute result should only have name and hobby
      // This is a compile-time check
      expectTypeOf(recordBuilder.execute).returns.resolves.toMatchTypeOf<{
        data:
          | {
              name: string | null;
              hobby: string | null;
            }
          | undefined;
        error: any;
      }>();
    });

    it("should provide type errors for non-existent fields", () => {
      () => {
        db.from(contacts)
          .get("test-uuid")
          // @ts-expect-error - nonexistent is not a valid column
          .select({ name: contacts.nonexistent });
      };
    });

    it("should include selected fields in getRequestConfig URL", () => {
      const config = db
        .from(contacts)
        .get("test-uuid")
        .select({ name: contacts.name, hobby: contacts.hobby })
        .getRequestConfig();

      expect(config.url).toContain("$select=");
      expect(config.url).toContain("name");
      expect(config.url).toContain("hobby");
    });
  });

  describe("expand() method", () => {
    it("should generate query string with simple $expand", () => {
      const queryString = db.from(contacts).get("test-uuid").expand(users).getQueryString();

      expect(queryString).toBe("/contacts('test-uuid')?$expand=users");
    });

    it("should generate query string with $expand and nested $select", () => {
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        .expand(users, (b: any) => b.select({ name: users.name, active: users.active }))
        .getQueryString();

      expect(queryString).toBe("/contacts('test-uuid')?$expand=users($select=name,active)");
    });

    it("should provide autocomplete for known relations", () => {
      const recordBuilder = db.from(contacts).get("test-uuid");

      // The expand parameter should suggest "users" | (string & {})
      expectTypeOf(recordBuilder.expand).parameter(0).not.toEqualTypeOf<string>();
    });

    it("should type callback builder to target table schema", () => {
      db.from(contacts)
        .get("test-uuid")
        .expand(users, (builder: any) => {
          // builder.select should only accept fields from users table
          expectTypeOf(builder.select).parameter(0).not.toEqualTypeOf<string>();

          return builder.select({ name: users.name, active: users.active });
        });
    });

    it("should not allow arbitrary string relations", () => {
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        // @ts-expect-error - arbitraryTable is not a valid expand target
        .expand(arbitraryTable)
        .getQueryString();

      expect(queryString).toContain("/contacts('test-uuid')?$expand=arbitrary_table");
    });

    it("should support $filter in expand callback", () => {
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        .expand(users, (b: any) => b.where(eq(users.active, true)))
        .getQueryString();

      expect(queryString).toContain("$expand=users($filter=active");
    });

    it("should support $orderby in expand callback", () => {
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        .expand(users, (b: any) => b.orderBy("name"))
        .getQueryString();

      expect(queryString).toContain("$expand=users($orderby=name");
    });

    it("should support $top in expand callback", () => {
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        .expand(users, (b: any) => b.top(5))
        .getQueryString();

      expect(queryString).toContain("$expand=users($top=5");
    });

    it("should support $skip in expand callback", () => {
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        .expand(users, (b: any) => b.skip(10))
        .getQueryString();

      expect(queryString).toContain("$expand=users($skip=10");
    });

    it("should support nested expands", () => {
      // users -> contacts (circular navigation from setup)
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        .expand(users, (b: any) =>
          b.select({ name: users.name }).expand(contacts, (nested: any) => nested.select({ name: contacts.name })),
        )
        .getQueryString();

      expect(queryString).toBe("/contacts('test-uuid')?$expand=users($select=name;$expand=contacts($select=name))");
    });

    it("should support multiple expands via chaining", () => {
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        .expand(users, (b: any) => b.select({ name: users.name }))
        .expand(invoices)
        .getQueryString();

      expect(queryString).toBe("/contacts('test-uuid')?$expand=users($select=name),invoices");
    });
  });

  describe("select() + expand() combined", () => {
    it("should generate query string with both $select and $expand", () => {
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        .select({ name: contacts.name, hobby: contacts.hobby })
        .expand(users, (b: any) => b.select({ name: users.name }))
        .getQueryString();

      expect(queryString).toContain("$select=name,hobby");
      expect(queryString).toContain("$expand=users($select=name)");
    });

    it("should return properly typed result with both select and expand", () => {
      const recordBuilder = db
        .from(contacts)
        .get("test-uuid")
        .select({ name: contacts.name, hobby: contacts.hobby })
        .expand(users, (b: any) => b.select({ name: users.name, active: users.active }));

      async () => {
        const { data, error: _error } = await recordBuilder.execute();
        data?.users.map((user) => user.CreatedBy);
      };
    });
  });

  describe("execute() with mocked responses", () => {
    it("should execute query with select and return narrowed fields", async () => {
      const mockResponse = {
        url: "https://example.com/test",
        method: "GET",
        status: 200,
        headers: { "content-type": "application/json;charset=utf-8" },
        response: {
          "@context": "$metadata#contacts/$entity",
          "@id": "contacts('test-uuid')",
          "@editLink": "contacts('test-uuid')",
          name: "John Doe",
          hobby: "Reading",
        },
      };

      const execMock = new MockFMServerConnection();
      execMock.addRoute({ urlPattern: "/test_db/contacts", response: mockResponse.response, status: mockResponse.status, headers: mockResponse.headers });
      const execDb = execMock.database("test_db");

      const result = await execDb
        .from(contacts)
        .get("test-uuid")
        .select({ name: contacts.name, hobby: contacts.hobby })
        .execute();

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe("John Doe");
      expect(result.data?.hobby).toBe("Reading");
    });

    it("should execute query with expand and include related records", async () => {
      const mockResponse = {
        url: "https://example.com/test",
        method: "GET",
        status: 200,
        headers: { "content-type": "application/json;charset=utf-8" },
        response: {
          "@context": "$metadata#contacts/$entity",
          "@id": "contacts('test-uuid')",
          "@editLink": "contacts('test-uuid')",
          PrimaryKey: "test-uuid",
          CreationTimestamp: "2025-01-01T00:00:00Z",
          CreatedBy: "admin",
          ModificationTimestamp: "2025-01-01T00:00:00Z",
          ModifiedBy: "admin",
          name: "John Doe",
          hobby: "Reading",
          id_user: "user-1",
          users: [
            {
              "@id": "users('user-1')",
              "@editLink": "users('user-1')",
              name: "johndoe",
              active: true,
            },
          ],
        },
      };

      const execMock = new MockFMServerConnection();
      execMock.addRoute({ urlPattern: "/test_db/contacts", response: mockResponse.response, status: mockResponse.status, headers: mockResponse.headers });
      const execDb = execMock.database("test_db");

      const result = await execDb
        .from(contacts)
        .get("test-uuid")
        .expand(users, (b: any) => b.select({ name: users.name, active: users.active }))
        .execute();

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe("John Doe");
      expect(result.data?.users).toBeDefined();
      expect(result.data?.users).toHaveLength(1);
      expect(result.data?.users[0]?.name).toBe("johndoe");
    });

    it("should strip OData annotations by default", async () => {
      const mockResponse = {
        url: "https://example.com/test",
        method: "GET",
        status: 200,
        headers: { "content-type": "application/json;charset=utf-8" },
        response: {
          "@context": "$metadata#contacts/$entity",
          "@id": "contacts('test-uuid')",
          "@editLink": "contacts('test-uuid')",
          name: "John Doe",
          hobby: "Reading",
        },
      };

      const execMock = new MockFMServerConnection();
      execMock.addRoute({ urlPattern: "/test_db/contacts", response: mockResponse.response, status: mockResponse.status, headers: mockResponse.headers });
      const execDb = execMock.database("test_db");

      const result = await execDb
        .from(contacts)
        .get("test-uuid")
        .select({ name: contacts.name, hobby: contacts.hobby })
        .execute();

      expect(result.data).toBeDefined();
      // OData annotations should be stripped
      expect((result.data as any)["@id"]).toBeUndefined();
      expect((result.data as any)["@editLink"]).toBeUndefined();
    });

    it("should include OData annotations when requested", async () => {
      const mockResponse = {
        url: "https://example.com/test",
        method: "GET",
        status: 200,
        headers: { "content-type": "application/json;charset=utf-8" },
        response: {
          "@context": "$metadata#contacts/$entity",
          "@id": "contacts('test-uuid')",
          "@editLink": "contacts('test-uuid')",
          name: "John Doe",
          hobby: "Reading",
        },
      };

      const execMock = new MockFMServerConnection();
      execMock.addRoute({ urlPattern: "/test_db/contacts", response: mockResponse.response, status: mockResponse.status, headers: mockResponse.headers });
      const execDb = execMock.database("test_db");

      const result = await execDb
        .from(contacts)
        .get("test-uuid")
        .select({ name: contacts.name, hobby: contacts.hobby })
        .execute({
          includeODataAnnotations: true,
        });

      expect(result.data).toBeDefined();
      // OData annotations should be present
      expect((result.data as any)["@id"]).toBe("contacts('test-uuid')");
      expect((result.data as any)["@editLink"]).toBe("contacts('test-uuid')");
    });
  });

  describe("getSingleField() mutual exclusion", () => {
    it("should work independently of select/expand", () => {
      // getSingleField should work as before, returning just the field value
      const queryString = db.from(contacts).get("test-uuid").getSingleField(contacts.name).getQueryString();

      // getSingleField adds /fieldName to the URL, not $select
      expect(queryString).toBe("/contacts('test-uuid')/name");
      expect(queryString).not.toContain("$select");
    });
  });

  describe("getRequestConfig()", () => {
    it("should include query params in URL", () => {
      const config = db
        .from(contacts)
        .get("test-uuid")
        .select({ name: contacts.name })
        .expand(users)
        .getRequestConfig();

      expect(config.method).toBe("GET");
      expect(config.url).toContain("$select=name");
      expect(config.url).toContain("$expand=users");
    });
  });

  describe("Complex combinations", () => {
    it("should support select + filter + orderBy + top + nested expand", () => {
      // Using contacts -> users -> contacts (circular navigation from setup)
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        .select({ name: contacts.name, hobby: contacts.hobby })
        .expand(users, (b: any) =>
          b
            .select({ name: users.name, active: users.active })
            .where(eq(users.active, true))
            .orderBy(users.name)
            .top(10)
            .expand(contacts, (nested: any) => nested.select({ name: contacts.name })),
        )
        .getQueryString();

      // Should contain all query options
      expect(queryString).toContain("$select=name,hobby");
      expect(queryString).toContain("$select=name,active");
      expect(queryString).toContain("$filter=active");
      expect(queryString).toContain("$orderby=name");
      expect(queryString).toContain("$top=10");
      expect(queryString).toContain("$expand=contacts($select=name)");
    });

    it("should support multiple expands with different options", () => {
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        .expand(users, (b: any) => b.select({ name: users.name }).where(eq(users.active, true)))
        .expand(invoices, (b: any) => b.select({ invoiceNumber: invoices.invoiceNumber }).top(5))
        .getQueryString();

      expect(queryString).toContain("users($select=name;$filter=active eq 1)");
      expect(queryString).toContain("invoices($select=invoiceNumber;$top=5)");
    });
  });

  describe("Container Field Exclusion", () => {
    it("should exclude container fields from defaultSelect: schema", async () => {
      const mockResponse = {
        url: "https://example.com/test",
        method: "GET",
        status: 200,
        headers: { "content-type": "application/json;charset=utf-8" },
        response: {
          "@odata.context": "https://example.com/fmi/odata/v4/test_db/$metadata#contacts/$entity",
          PrimaryKey: "test-uuid",
          CreationTimestamp: "2025-01-01T00:00:00Z",
          CreatedBy: "admin",
          ModificationTimestamp: "2025-01-01T00:00:00Z",
          ModifiedBy: "admin",
          name: "John Doe",
          hobby: "Reading",
          id_user: "user-123",
          // Note: image field should NOT be included even though it's in the schema
        },
      };

      const execMock = new MockFMServerConnection();
      execMock.addRoute({ urlPattern: "/test_db/contacts", response: mockResponse.response, status: mockResponse.status, headers: mockResponse.headers });
      const execDb = execMock.database("test_db");

      const result = await execDb
        .from(contactsWithSchemaSelect)
        .get("test-uuid")
        .execute();

      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();

      // Container field should not appear in the result type or query
      const queryString = db.from(contactsWithSchemaSelect).get("test-uuid").getQueryString();

      // Should contain non-container fields
      expect(queryString).toContain("$select=");
      // Should NOT contain the image field
      expect(queryString).not.toContain("image");
    });

    it("should reject container field selection at compile time", () => {
      // Type test - this should produce a compile error
      expectTypeOf(() => {
        // @ts-expect-error - container fields cannot be selected
        db.from(contacts).get("test-uuid").select({ image: contacts.image });
      }).toBeFunction();
    });

    it("should allow getSingleField() to access container fields", () => {
      const queryString = db.from(contacts).get("test-uuid").getSingleField(contacts.image).getQueryString();

      expect(queryString).toBe("/contacts('test-uuid')/image");
    });

    it("should exclude container fields from list queries with defaultSelect: schema", () => {
      const queryString = db.from(contactsWithSchemaSelect).list().getQueryString();

      // Should have a select parameter
      expect(queryString).toContain("$select=");
      // Should NOT contain the image field
      expect(queryString).not.toContain("image");
      // Should contain other fields
      expect(queryString).toContain("name");
    });

    it("should reject container field selection in list queries at compile time", () => {
      // Type test - this should produce a compile error
      expectTypeOf(() => {
        // @ts-expect-error - container fields cannot be selected
        db.from(contacts).list().select({ image: contacts.image });
      }).toBeFunction();
    });

    it("should allow selecting non-container fields normally", () => {
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        .select({ name: contacts.name, hobby: contacts.hobby })
        .getQueryString();

      expect(queryString).toContain("$select=name,hobby");
      expect(queryString).not.toContain("image");
    });

    it("should allow non-container fields in expanded relations", () => {
      // Non-container fields should work fine in expanded relations
      const queryString = db
        .from(contacts)
        .get("test-uuid")
        .expand(users, (b: any) => b.select({ name: users.name }))
        .getQueryString();

      expect(queryString).toContain("users($select=name)");

      // Verify main select also works with non-container fields
      const queryString2 = db
        .from(contacts)
        .get("test-uuid")
        .select({ name: contacts.name, hobby: contacts.hobby })
        .getQueryString();

      expect(queryString2).toContain("$select=name,hobby");
    });
  });
});
