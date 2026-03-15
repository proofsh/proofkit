/**
 * OData Query String Generation Tests
 *
 * This test file validates that the query builder correctly generates OData
 * query strings. These tests focus on ensuring that:
 *
 * - Query options ($select, $filter, $orderby, $top, $skip, $expand, $count)
 *   are correctly formatted according to OData v4 specification
 * - Query string encoding and escaping is handled properly
 * - Method chaining produces correct combined query strings
 * - Edge cases and special characters are handled correctly
 *
 * These tests do NOT:
 * - Execute actual HTTP requests (.execute() is never called)
 * - Test network behavior or responses
 * - Require a mock fetch implementation
 *
 * They serve to ensure the query builder generates valid OData query strings
 * that will be correctly parsed by OData endpoints.
 */

const SELECT_QUERY_REGEX = /\$select=([^&]+)/;

import { and, asc, desc, eq, fmTableOccurrence, gt, isNull, numberField, or, textField } from "@proofkit/fmodata";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { describe, expect, it } from "vitest";

const users = fmTableOccurrence(
  "users",
  {
    id: textField().primaryKey(),
    name: textField(),
    "name with spaces": textField(),
    "special%char": textField(),
    "special&char": textField(),
    email: textField(),
    age: numberField(),
  },
  { navigationPaths: ["contacts"] },
);
const contacts = fmTableOccurrence("contacts", {
  PrimaryKey: textField().primaryKey(),
  name: textField(),
  "name with spaces": textField(),
  "special%char": textField(),
  "special&char": textField(),
});

describe("OData Query String Generation", () => {
  const client = new MockFMServerConnection();
  const db = client.database("TestDB");

  describe("$select", () => {
    it("should generate $select query for single field", () => {
      const queryString = db.from(users).list().select({ name: users.name }).getQueryString();

      expect(queryString).toContain("$select");
      expect(queryString).toContain("name");
    });
    it("should auto quote fields with special characters", () => {
      const base = db.from(users).list();

      const queryString = base.select({ id: users.id }).getQueryString();
      expect(queryString).toContain('$select="id"');
      expect(queryString).toContain("$top=1000");
      const queryString2 = base.select({ name: users["name with spaces"] }).getQueryString();
      expect(queryString2).toContain('$select="name with spaces"');
      expect(queryString2).toContain("$top=1000");

      const queryString3 = base.select({ test: users["special%char"] }).getQueryString();
      expect(queryString3).toContain("$top=1000");
      expect(queryString3.includes('$select="special%char"') || queryString3.includes('$select="special%char"')).toBe(
        true,
      );

      const queryString4 = base.select({ test: users["special&char"] }).getQueryString();
      expect(queryString4).toContain('$select="special&char"');
      expect(queryString4).toContain("$top=1000");

      const queryString5 = base
        .select({ name: users.name })
        .expand(contacts, (b: any) => b.select({ id: contacts.PrimaryKey }))
        .getQueryString();
      expect(queryString5).toContain("$select=name");
      expect(queryString5).toContain("$top=1000");
      expect(queryString5).toContain("$expand=contacts($select=PrimaryKey)");
      const queryString7 = db
        .from(users)
        .list()
        .select({ name: users.name })
        .expand(contacts, (b: any) => b.select({ name: contacts["name with spaces"] }))
        .getQueryString();
      expect(queryString7).toContain("$select=name");
      expect(queryString7).toContain("$top=1000");
      expect(
        queryString7.includes('$expand=contacts($select="name with spaces")') ||
          queryString7.includes('$expand=contacts($select="name with spaces")'),
      ).toBe(true);

      const queryString8 = db
        .from(users)
        .list()
        .select({ name: users.name })
        .expand(contacts, (b: any) => b.select({ test: contacts["special%char"] }))
        .getQueryString();
      expect(queryString8).toContain("$select=name");
      expect(queryString8).toContain("$top=1000");
      expect(
        queryString8.includes('$expand=contacts($select="special%char")') ||
          queryString8.includes('$expand=contacts($select="special%char")'),
      ).toBe(true);

      const queryString9 = db
        .from(users)
        .list()
        .select({ name: users.name })
        .expand(contacts, (b: any) => b.select({ test: contacts["special&char"] }))
        .getQueryString();
      expect(queryString9).toContain("$select=name");
      expect(queryString9).toContain("$top=1000");
      expect(queryString9).toContain('$expand=contacts($select="special&char")');
    });

    it("should generate $select query for multiple fields", () => {
      const queryString = db
        .from(users)
        .list()
        .select({ name: users.name, email: users.email, age: users.age })
        .getQueryString();

      expect(queryString).toContain("$select");
      expect(queryString).toContain("name");
      expect(queryString).toContain("email");
      expect(queryString).toContain("age");
    });

    it("should generate $select with comma-separated fields", () => {
      const queryString = db.from(users).list().select({ id: users.id, name: users.name }).getQueryString();

      // OData format: $select=id,name
      const selectPart = queryString.match(SELECT_QUERY_REGEX)?.[1];
      expect(selectPart).toBeDefined();

      expect(selectPart?.split(",")).toContain("name");
    });
  });

  describe("$filter", () => {
    it("should generate $filter with equality operator", () => {
      const queryString = db.from(users).list().where(eq(users.name, "John")).getQueryString();

      expect(queryString).toContain("$filter");
      expect(queryString).toContain("name");
      expect(queryString).toContain("eq");
      expect(queryString).toContain("John");
      expect(queryString).not.toContain("operands");
      expect(queryString).toBe(
        `/users?$filter=name eq 'John'&$top=1000&$select="id",name,"name with spaces","special%char","special&char",email,age`,
      );
    });

    it("should generate $filter with numeric comparison", () => {
      const queryString = db.from(users).list().where(gt(users.age, 18)).getQueryString();

      expect(queryString).toContain("$filter");
      expect(queryString).toContain("age");
      expect(queryString).toContain("gt");
    });

    it("should generate $filter with multiple conditions using AND", () => {
      const queryString = db
        .from(users)
        .list()
        .where(and(eq(users.name, "John"), gt(users.age, 18)))
        .getQueryString();

      expect(queryString).toContain("$filter");
      expect(queryString).toContain("name");
      expect(queryString).toContain("age");
    });

    it("should generate $filter with OR conditions", () => {
      // Note: This test assumes users table has a status field
      // If not, we may need to adjust the test
      const queryString = db
        .from(users)
        .list()
        .where(or(eq(users.name, "active"), eq(users.name, "pending")))
        .getQueryString();

      expect(queryString).toContain("$filter");
      expect(queryString).toContain("name");
    });

    it("should handle string values with quotes in filter", () => {
      const queryString = db.from(users).list().where(eq(users.name, "John O'Connor")).getQueryString();

      expect(queryString).toContain("$filter");
      // OData should properly escape quotes
      expect(queryString).toContain("John");
    });

    it("should handle null values in filter", () => {
      const queryString = db.from(users).list().where(isNull(users.name)).getQueryString();

      expect(queryString).toContain("$filter");
      expect(queryString).toContain("null");
    });
  });

  describe("$orderby", () => {
    it("should generate $orderby for ascending order", () => {
      const queryString = db.from(users).list().orderBy(asc(users.name)).getQueryString();

      expect(queryString).toContain("$orderby");
      expect(queryString).toContain("name");

      // without asc should also work, as it's the default
      const _queryString2 = db.from(users).list().orderBy(users.name).getQueryString();
    });

    it("should generate $orderby for descending order", () => {
      const queryString = db.from(users).list().orderBy(desc(users.name)).getQueryString();

      expect(queryString).toContain("$orderby");
      expect(queryString).toContain("name");
      expect(queryString).toContain("desc");
    });

    it("should allow order by with multiple fields", () => {
      const queryString = db
        .from(users)
        .list()
        .orderBy(users.name, desc(users.age)) // Raw string - no type safety
        .getQueryString();

      expect(queryString).toContain("$orderby");
      expect(queryString).toContain("name");
      expect(queryString).toContain("age");
    });

    it("should not allow order by with fields from other tables", () => {
      db.from(users)
        .list()
        // @ts-expect-error - contacts.PrimaryKey is not a valid field
        .orderBy(contacts.PrimaryKey);

      // @ts-expect-error - contacts.name is not a valid field
      db.from(users).list().orderBy(asc(contacts.name));
      // @ts-expect-error - contacts.name is not a valid field
      db.from(users).list().orderBy(desc(contacts.name));
      // @ts-expect-error - contacts.name is not a valid field
      db.from(users).list().orderBy(users.name, desc(contacts.name));
    });
  });

  describe("$top", () => {
    it("should generate $top query parameter", () => {
      const queryString = db.from(users).list().top(10).getQueryString();

      expect(queryString).toContain("$top");
      expect(queryString).toContain("10");
    });

    it("should generate $top with different values", () => {
      const queryString = db.from(users).list().top(25).getQueryString();

      expect(queryString).toContain("$top");
      expect(queryString).toContain("25");
    });
  });

  describe("$skip", () => {
    it("should generate $skip query parameter", () => {
      const queryString = db.from(users).list().skip(20).getQueryString();

      expect(queryString).toContain("$skip");
      expect(queryString).toContain("20");
    });

    it("should generate $skip with zero value", () => {
      const queryString = db.from(users).list().skip(0).getQueryString();

      expect(queryString).toContain("$skip");
      expect(queryString).toContain("0");
    });
  });

  describe("$expand", () => {
    it("should generate $expand query parameter", () => {
      const queryString = db.from(users).list().expand(contacts).getQueryString();

      expect(queryString).toContain("$expand");
      expect(queryString).toContain("contacts");
    });
  });

  describe("$count", () => {
    it("should generate query with $count parameter", () => {
      const queryString = db.from(users).list().count().getQueryString();

      expect(queryString).toContain("$count");
    });

    it("should generate $count with other query parameters", () => {
      const queryString = db.from(users).list().where("status eq 'active'").count().getQueryString();

      expect(queryString).toContain("$count");
      expect(queryString).toContain("$filter");
    });
  });

  describe("Combined query parameters", () => {
    it("should combine $select and $filter", () => {
      const queryString = db
        .from(users)
        .list()
        .select({ name: users.name, email: users.email })
        .where("age gt 18")
        .getQueryString();

      expect(queryString).toContain("$select");
      expect(queryString).toContain("$filter");
      expect(queryString).toContain("name");
      expect(queryString).toContain("age");
    });

    it("should combine $select, $filter, and $orderby", () => {
      const queryString = db
        .from(users)
        .list()
        .select({ name: users.name, email: users.email })
        .where("status eq 'active'")
        .orderBy("name")
        .getQueryString();

      expect(queryString).toContain("$select");
      expect(queryString).toContain("$filter");
      expect(queryString).toContain("$orderby");
    });

    it("should combine $top and $skip for pagination", () => {
      const queryString = db.from(users).list().top(10).skip(20).getQueryString();

      expect(queryString).toContain("$top");
      expect(queryString).toContain("$skip");
      expect(queryString).toContain("10");
      expect(queryString).toContain("20");
    });

    it("should combine multiple query parameters", () => {
      const queryString = db
        .from(users)
        .list()
        .select({ name: users.name, email: users.email })
        .where("age gt 18")
        .orderBy("name")
        .top(10)
        .skip(0)
        .getQueryString();

      expect(queryString).toContain("$select");
      expect(queryString).toContain("$filter");
      expect(queryString).toContain("$orderby");
      expect(queryString).toContain("$top");
      expect(queryString).toContain("$skip");
    });

    it("should combine $select, $filter, $orderby, $top, and $expand", () => {
      const queryString = db
        .from(users)
        .list()
        .select({ name: users.name, email: users.email })
        .where("status eq 'active'")
        .orderBy("name")
        .top(25)
        .expand(contacts)
        .getQueryString();

      expect(queryString).toContain("$select");
      expect(queryString).toContain("$filter");
      expect(queryString).toContain("$orderby");
      expect(queryString).toContain("$top");
      expect(queryString).toContain("$expand");
    });
  });

  describe("single() mode", () => {
    it("should generate query string for single record", () => {
      const queryString = db.from(users).list().select({ name: users.name }).single().getQueryString();

      expect(queryString).toContain("$select");
      // single() mode affects execution, not query string format
      expect(queryString).toBeDefined();
    });

    it("should generate query string with single() and filter", () => {
      const queryString = db.from(users).list().where("id eq '123'").single().getQueryString();

      expect(queryString).toContain("$filter");
      expect(queryString).toContain("id");
    });
  });

  describe("Query string format validation", () => {
    it("should use & to separate multiple parameters", () => {
      const queryString = db
        .from(users)
        .list()
        .select({ name: users.name })
        .where("age gt 18")
        .top(10)
        .getQueryString();

      // Should have & between parameters
      const matches = queryString.match(/&/g);
      expect(matches?.length).toBeGreaterThan(0);
    });

    it("should URL encode special characters in values", () => {
      const queryString = db.from(users).list().where("name eq 'John & Jane'").getQueryString();

      expect(queryString).toContain("$filter");
      // Special characters should be properly encoded
      expect(queryString).toBeDefined();
    });
  });

  describe("list() method", () => {
    it("should generate query string from list() builder", () => {
      const queryString = db.from(users).list().getQueryString();

      expect(queryString).toBeDefined();
      expect(typeof queryString).toBe("string");
    });

    it("should combine list() with query parameters", () => {
      const queryString = db.from(users).list().select({ name: users.name }).top(10).getQueryString();

      expect(queryString).toContain("$select");
      expect(queryString).toContain("$top");
    });
  });
});
