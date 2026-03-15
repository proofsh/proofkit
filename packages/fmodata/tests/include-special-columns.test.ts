/**
 * Tests for includeSpecialColumns feature
 *
 * These tests verify that the includeSpecialColumns option can be set at the database level
 * and overridden at the request level, and that special columns (ROWID and ROWMODID) are
 * included in responses when the header is set and no $select query is applied.
 */

import { fmTableOccurrence, textField } from "@proofkit/fmodata";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { assert, describe, expect, expectTypeOf, it } from "vitest";

// Create a simple table occurrence for testing
const contactsTO = fmTableOccurrence("contacts", {
  id: textField().primaryKey(),
  name: textField(),
});

describe("includeSpecialColumns feature", () => {
  it("should include special columns header when enabled at database level", async () => {
    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/TestDB/contacts",
      response: {
        value: [{ id: "1", name: "John", ROWID: 123, ROWMODID: 456 }],
      },
      status: 200,
    });
    const db = mock.database("TestDB", {
      includeSpecialColumns: true,
    });

    let preferHeader: string | null = null;
    let reqUrl: string | null = null;
    const { data } = await db
      .from(contactsTO)
      .list()
      .execute({
        hooks: {
          before: (req) => {
            const headers = req.headers;
            reqUrl = req.url;
            preferHeader = headers.get("Prefer");
          },
        },
      });
    expect(preferHeader).toBe("fmodata.include-specialcolumns");
    if (!reqUrl) {
      throw new Error("Expected reqUrl to be defined");
    }
    const parsedUrl = new URL(reqUrl);
    const selectParam = parsedUrl.searchParams.get("$select");
    // since we're automatically adding a $select parameter (defaultSelect: "schema"), we need to include the special columns in the select parameter
    expect(selectParam).toContain("ROWID");
    expect(selectParam).toContain("ROWMODID");

    if (!data || data.length === 0) {
      throw new Error("Expected data to be defined and non-empty");
    }
    const firstRecord = data[0];
    if (!firstRecord) {
      throw new Error("Expected firstRecord to be defined");
    }

    // type checks
    expectTypeOf(firstRecord).toHaveProperty("ROWID");
    expectTypeOf(firstRecord).toHaveProperty("ROWMODID");
    firstRecord.ROWID;
    firstRecord.ROWMODID;

    // runtime check
    expect(firstRecord).toHaveProperty("ROWID");
    expect(firstRecord).toHaveProperty("ROWMODID");
  });

  it("should not add $select parameter when defaultSelect is not 'schema'", async () => {
    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/TestDB/contacts",
      response: {
        value: [{ id: "1", name: "John", ROWID: 123, ROWMODID: 456 }],
      },
      status: 200,
    });
    const db = mock.database("TestDB", { includeSpecialColumns: true });

    const contactsAll = fmTableOccurrence(
      "contacts",
      {
        id: textField().primaryKey(),
        name: textField(),
      },
      { defaultSelect: "all" },
    );

    let _preferHeader: string | null = null;
    let reqUrl: string | null = null;
    const { data } = await db
      .from(contactsAll)
      .list()
      .execute({
        hooks: {
          before: (req) => {
            const headers = req.headers;
            _preferHeader = headers.get("Prefer");
            reqUrl = req.url;
          },
        },
      });
    if (!reqUrl) {
      throw new Error("Expected reqUrl to be defined");
    }
    const parsedUrl = new URL(reqUrl);
    const selectParam = parsedUrl.searchParams.get("$select");
    // don't add $select parameter when defaultSelect is not 'schema'
    expect(selectParam).toBeNull();

    if (!data || data.length === 0) {
      throw new Error("Expected data to be defined and non-empty");
    }
    const firstRecord = data[0];
    if (!firstRecord) {
      throw new Error("Expected firstRecord to be defined");
    }

    // type checks
    expectTypeOf(firstRecord).toHaveProperty("ROWID");
    expectTypeOf(firstRecord).toHaveProperty("ROWMODID");
    firstRecord.ROWID;
    firstRecord.ROWMODID;

    // runtime check
    expect(firstRecord).toHaveProperty("ROWID");
    expect(firstRecord).toHaveProperty("ROWMODID");
  });

  it("should not include special columns header when disabled at database level", async () => {
    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/TestDB/contacts",
      response: { value: [{ id: "1", name: "John" }] },
      status: 200,
    });
    const db = mock.database("TestDB", {
      includeSpecialColumns: false,
    });

    let preferHeader: string | null = null;
    const { data } = await db
      .from(contactsTO)
      .list()
      .execute({
        hooks: {
          before: (req) => {
            const headers = req.headers;
            preferHeader = headers.get("Prefer");
          },
        },
      });
    expect(preferHeader).toBeNull();

    if (!data || data.length === 0) {
      throw new Error("Expected data to be defined and non-empty");
    }
    const firstRecord = data[0];
    if (!firstRecord) {
      throw new Error("Expected firstRecord to be defined");
    }

    // type checks
    expectTypeOf(firstRecord).not.toHaveProperty("ROWID");
    expectTypeOf(firstRecord).not.toHaveProperty("ROWMODID");
    // @ts-expect-error
    firstRecord.ROWID;
    // @ts-expect-error
    firstRecord.ROWMODID;

    // runtime check
    expect(firstRecord).not.toHaveProperty("ROWID");
    expect(firstRecord).not.toHaveProperty("ROWMODID");
  });

  it("should be disabled by default at database level", async () => {
    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/TestDB/contacts",
      response: { value: [{ id: "1", name: "John" }] },
      status: 200,
    });
    const db = mock.database("TestDB");

    let preferHeader: string | null = null;
    const { data } = await db
      .from(contactsTO)
      .list()
      .execute({
        hooks: {
          before: (req) => {
            const headers = req.headers;
            preferHeader = headers.get("Prefer");
          },
        },
      });
    expect(preferHeader).toBeNull();

    if (!data || data.length === 0) {
      throw new Error("Expected data to be defined and non-empty");
    }
    const firstRecord = data[0];
    if (!firstRecord) {
      throw new Error("Expected firstRecord to be defined");
    }

    // type checks
    expectTypeOf(firstRecord).not.toHaveProperty("ROWID");
    expectTypeOf(firstRecord).not.toHaveProperty("ROWMODID");
    // @ts-expect-error
    firstRecord.ROWID;
    // @ts-expect-error
    firstRecord.ROWMODID;

    // runtime check
    expect(firstRecord).not.toHaveProperty("ROWID");
    expect(firstRecord).not.toHaveProperty("ROWMODID");
  });

  it("should allow overriding includeSpecialColumns at request level", async () => {
    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/TestDB/contacts",
      response: { value: [{ id: "1", name: "John" }] },
      status: 200,
    });
    const db = mock.database("TestDB", {
      includeSpecialColumns: false,
    });

    // First request: use default (should NOT have header)
    let preferHeader1: string | null = null;
    const { data: data1 } = await db
      .from(contactsTO)
      .list()
      .execute({
        hooks: {
          before: (req) => {
            const headers = req.headers;
            preferHeader1 = headers.get("Prefer");
          },
        },
      });

    if (!data1 || data1.length === 0) {
      throw new Error("Expected data1 to be defined and non-empty");
    }
    const firstRecord1 = data1[0];
    if (!firstRecord1) {
      throw new Error("Expected firstRecord1 to be defined");
    }

    // type checks
    expectTypeOf(firstRecord1).not.toHaveProperty("ROWID");
    expectTypeOf(firstRecord1).not.toHaveProperty("ROWMODID");
    // @ts-expect-error
    firstRecord1.ROWID;
    // @ts-expect-error
    firstRecord1.ROWMODID;

    // runtime check
    expect(firstRecord1).not.toHaveProperty("ROWID");
    expect(firstRecord1).not.toHaveProperty("ROWMODID");

    // Second request: explicitly enable for this request only
    const mock2 = new MockFMServerConnection();
    mock2.addRoute({
      urlPattern: "/TestDB/contacts",
      response: {
        value: [{ id: "1", name: "John", ROWID: 123, ROWMODID: 456 }],
      },
      status: 200,
    });
    const db2 = mock2.database("TestDB", {
      includeSpecialColumns: false,
    });

    let preferHeader2: string | null = null;
    const { data: data2 } = await db2
      .from(contactsTO)
      .list()
      .execute({
        includeSpecialColumns: true,
        hooks: {
          before: (req) => {
            const headers = req.headers;
            preferHeader2 = headers.get("Prefer");
          },
        },
      });

    if (!data2 || data2.length === 0) {
      throw new Error("Expected data2 to be defined and non-empty");
    }
    const firstRecord2 = data2[0];
    if (!firstRecord2) {
      throw new Error("Expected firstRecord2 to be defined");
    }

    // type checks
    expectTypeOf(firstRecord2).toHaveProperty("ROWID");
    expectTypeOf(firstRecord2).toHaveProperty("ROWMODID");
    firstRecord2.ROWID;
    firstRecord2.ROWMODID;

    // runtime check
    expect(firstRecord2).toHaveProperty("ROWID");
    expect(firstRecord2).toHaveProperty("ROWMODID");

    // Third request: explicitly disable for this request
    const mock3 = new MockFMServerConnection();
    mock3.addRoute({
      urlPattern: "/TestDB/contacts",
      response: { value: [] },
      status: 200,
    });
    const db3 = mock3.database("TestDB", {
      includeSpecialColumns: false,
    });

    let preferHeader3: string | null = null;
    await db3
      .from(contactsTO)
      .list()
      .execute({
        includeSpecialColumns: false,
        hooks: {
          before: (req) => {
            const headers = req.headers;
            preferHeader3 = headers.get("Prefer");
          },
        },
      });

    expect(preferHeader1).toBeNull();
    expect(preferHeader2).toBe("fmodata.include-specialcolumns");
    expect(preferHeader3).toBeNull();
  });

  it("should combine includeSpecialColumns with useEntityIds in Prefer header", async () => {
    const contactsTOWithEntityIds = fmTableOccurrence(
      "contacts",
      {
        id: textField().primaryKey().entityId("FMFID:1"),
        name: textField().entityId("FMFID:2"),
      },
      {
        entityId: "FMTID:100",
      },
    );

    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/TestDB/",
      response: {
        value: [{ id: "1", name: "John", ROWID: 123, ROWMODID: 456 }],
      },
      status: 200,
    });
    const db = mock.database("TestDB", {
      useEntityIds: true,
      includeSpecialColumns: true,
    });

    let preferHeader: string | null = null;
    const { data } = await db
      .from(contactsTOWithEntityIds)
      .list()
      .execute({
        hooks: {
          before: (req) => {
            const headers = req.headers;
            preferHeader = headers.get("Prefer");
          },
        },
      });
    // Should be comma-separated
    expect(preferHeader).not.toBeNull();
    if (!preferHeader) {
      throw new Error("Expected preferHeader to be defined");
    }
    // Type assertion needed because preferHeader is mutated in async callback
    const headerValue = preferHeader as string;
    expect(headerValue).toContain("fmodata.entity-ids");
    expect(headerValue).toContain("fmodata.include-specialcolumns");
    const preferValues = headerValue.split(", ");
    expect(preferValues.length).toBe(2);
    expect(preferValues).toContain("fmodata.entity-ids");
    expect(preferValues).toContain("fmodata.include-specialcolumns");

    if (!data || data.length === 0) {
      throw new Error("Expected data to be defined and non-empty");
    }
    const firstRecord = data[0];
    if (!firstRecord) {
      throw new Error("Expected firstRecord to be defined");
    }

    // type checks
    expectTypeOf(firstRecord).toHaveProperty("ROWID");
    expectTypeOf(firstRecord).toHaveProperty("ROWMODID");
    firstRecord.ROWID;
    firstRecord.ROWMODID;

    // runtime check
    expect(firstRecord).toHaveProperty("ROWID");
    expect(firstRecord).toHaveProperty("ROWMODID");
  });

  it("should work with get() method for single records", async () => {
    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/TestDB/contacts",
      response: {
        id: "123",
        name: "John",
        ROWID: 123,
        ROWMODID: 456,
      },
      status: 200,
    });
    const db = mock.database("TestDB", {
      includeSpecialColumns: true,
    });

    let preferHeader: string | null = null;
    const { data } = await db
      .from(contactsTO)
      .get("123")
      .execute({
        hooks: {
          before: (req) => {
            const headers = req.headers;
            preferHeader = headers.get("Prefer");
          },
        },
      });
    expect(preferHeader).toBe("fmodata.include-specialcolumns");

    assert(data, "data is undefined");

    // type checks
    expectTypeOf(data).toHaveProperty("ROWID");
    expectTypeOf(data).toHaveProperty("ROWMODID");
    data.ROWID;
    data.ROWMODID;

    // runtime check
    expect(data).toHaveProperty("ROWID");
    expect(data).toHaveProperty("ROWMODID");
  });

  it("should not include special columns when $select is applied", async () => {
    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/TestDB/contacts",
      response: {
        value: [{ name: "John" }], // No ROWID or ROWMODID
      },
      status: 200,
    });
    const db = mock.database("TestDB", {
      includeSpecialColumns: true,
    });

    // FileMaker OData requires ROWID/ROWMODID to be explicitly listed in $select
    // to be returned (they are only included when explicitly requested or when header is set and no $select is applied)
    let preferHeader: string | null = null;
    const { data } = await db
      .from(contactsTO)
      .list()
      .select({ name: contactsTO.name })
      .execute({
        hooks: {
          before: (req) => {
            const headers = req.headers;
            // Header should still be sent, but server won't return special columns
            preferHeader = headers.get("Prefer");
          },
        },
      });
    expect(preferHeader).toBe("fmodata.include-specialcolumns");

    if (!data || data.length === 0) {
      throw new Error("Expected data to be defined and non-empty");
    }
    const firstRecord = data[0];
    if (!firstRecord) {
      throw new Error("Expected firstRecord to be defined");
    }

    // type checks
    expectTypeOf(firstRecord).not.toHaveProperty("ROWID");
    expectTypeOf(firstRecord).not.toHaveProperty("ROWMODID");
    // @ts-expect-error
    firstRecord.ROWID;
    // @ts-expect-error
    firstRecord.ROWMODID;

    // runtime check
    expect(firstRecord).not.toHaveProperty("ROWID");
    expect(firstRecord).not.toHaveProperty("ROWMODID");
  });

  it("should not append ROWID/ROWMODID to explicit $select unless requested via systemColumns", () => {
    const mock = new MockFMServerConnection();
    const db = mock.database("TestDB", {
      includeSpecialColumns: true,
    });

    // Explicit select() should remain exact (no implicit system columns)
    const queryString = db.from(contactsTO).list().select({ name: contactsTO.name }).getQueryString();

    expect(queryString).toContain("$select=");
    expect(queryString).toContain("name");
    expect(queryString).not.toContain("ROWID");
    expect(queryString).not.toContain("ROWMODID");

    // But system columns should still be selectable when explicitly requested
    const queryStringWithSystemCols = db
      .from(contactsTO)
      .list()
      .select({ name: contactsTO.name }, { ROWID: true, ROWMODID: true })
      .getQueryString();

    expect(queryStringWithSystemCols).toContain("ROWID");
    expect(queryStringWithSystemCols).toContain("ROWMODID");
  });

  it("should work with single() method", async () => {
    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/TestDB/contacts",
      response: {
        id: "123",
        name: "John",
        ROWID: 123,
        ROWMODID: 456,
      },
      status: 200,
    });
    const db = mock.database("TestDB", {
      includeSpecialColumns: true,
    });

    let preferHeader: string | null = null;
    const { data } = await db
      .from(contactsTO)
      .list()
      .single()
      .execute({
        hooks: {
          before: (req) => {
            const headers = req.headers;
            preferHeader = headers.get("Prefer");
          },
        },
      });
    expect(preferHeader).toBe("fmodata.include-specialcolumns");

    assert(data, "data is undefined");

    // type checks
    expectTypeOf(data).toHaveProperty("ROWID");
    expectTypeOf(data).toHaveProperty("ROWMODID");
    data.ROWID;
    data.ROWMODID;

    // runtime check
    expect(data).toHaveProperty("ROWID");
    expect(data).toHaveProperty("ROWMODID");
  });

  it("should not include special columns if getSingleField() is used", async () => {
    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/TestDB/contacts",
      response: { value: "John" },
      status: 200,
    });
    const db = mock.database("TestDB", {
      includeSpecialColumns: true,
    });

    let preferHeader: string | null = null;
    const { data } = await db
      .from(contactsTO)
      .get("123")
      .getSingleField(contactsTO.name)
      .execute({
        hooks: {
          before: (req) => {
            const headers = req.headers;
            preferHeader = headers.get("Prefer");
          },
        },
      });
    expect(preferHeader).toBe("fmodata.include-specialcolumns");

    expectTypeOf(data).not.toHaveProperty("ROWID");
    expectTypeOf(data).not.toHaveProperty("ROWMODID");
    // @ts-expect-error
    data.ROWID;
    // @ts-expect-error
    data.ROWMODID;
  });

  it("should still allow you to select ROWID or ROWMODID in select()", async () => {
    const mock = new MockFMServerConnection();
    mock.addRoute({
      urlPattern: "/TestDB/contacts",
      response: {
        value: [{ id: "1", ROWID: 123, ROWMODID: 456 }],
      },
      status: 200,
    });
    const db = mock.database("TestDB");

    const { data } = await db
      .from(contactsTO)
      .list()
      .select(
        {
          id: contactsTO.id,
        },
        { ROWID: true, ROWMODID: true },
      )
      .execute();
    if (!data || data.length === 0) {
      throw new Error("Expected data to be defined and non-empty");
    }
    const firstRecord = data[0];
    if (!firstRecord) {
      throw new Error("Expected firstRecord to be defined");
    }

    expectTypeOf(firstRecord).toHaveProperty("ROWID");
    expectTypeOf(firstRecord).toHaveProperty("ROWMODID");
    firstRecord.ROWID;
    firstRecord.ROWMODID;

    // runtime check
    expect(firstRecord).toHaveProperty("ROWID");
    expect(firstRecord).toHaveProperty("ROWMODID");
  });
});
