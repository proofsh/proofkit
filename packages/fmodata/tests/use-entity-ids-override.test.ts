/**
 * Tests for per-request useEntityIds override
 *
 * These tests verify that the useEntityIds option can be overridden at the request level
 * using ExecuteOptions, allowing users to disable entity IDs for specific requests even
 * when the database is configured to use them by default.
 *
 * Note: The spy captures headers from the Request object (via Headers API), which
 * normalizes header names to lowercase. Use lowercase keys (e.g. "prefer") when
 * checking spy headers.
 */

import { fmTableOccurrence, textField } from "@proofkit/fmodata";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { describe, expect, it } from "vitest";

// Create table occurrence with entity IDs configured
const contactsTO = fmTableOccurrence(
  "contacts",
  {
    id: textField().primaryKey().entityId("FMFID:1"),
    name: textField().entityId("FMFID:2"),
  },
  {
    entityId: "FMTID:100",
  },
);

describe("Per-request useEntityIds override", () => {
  const makeLocalContactsTO = () =>
    fmTableOccurrence(
      "contacts",
      {
        id: textField().primaryKey().entityId("FMFID:1"),
        name: textField().entityId("FMFID:2"),
      },
      {
        entityId: "FMTID:100",
      },
    );

  it("should allow disabling entity IDs for a specific request", async () => {
    const mock = new MockFMServerConnection({ enableSpy: true });
    mock.addRoute({
      urlPattern: "/TestDB",
      response: { value: [] },
      status: 200,
    });
    const db = mock.database("TestDB", { useEntityIds: true });

    // First request: use default (should have entity ID header)
    await db.from(contactsTO).list().execute();

    const call0 = mock.spy?.calls[0];
    expect(call0?.headers?.prefer).toBe("fmodata.entity-ids");

    // Second request: explicitly disable entity IDs for this request only
    await db.from(contactsTO).list().execute({ useEntityIds: false });

    const call1 = mock.spy?.calls[1];
    expect(call1?.headers?.prefer).toBeUndefined();

    // Third request: explicitly enable entity IDs for this request
    await db.from(contactsTO).list().execute({ useEntityIds: true });

    const call2 = mock.spy?.calls[2];
    expect(call2?.headers?.prefer).toBe("fmodata.entity-ids");
  });

  it("should allow enabling entity IDs for a specific request when disabled by default", async () => {
    const mock = new MockFMServerConnection({ enableSpy: true });
    mock.addRoute({
      urlPattern: "/TestDB",
      response: { value: [] },
      status: 200,
    });
    const db = mock.database("TestDB", { useEntityIds: false });

    // First request: use default (should NOT have entity ID header)
    await db.from(contactsTO).list().execute();

    const call0 = mock.spy?.calls[0];
    expect(call0?.headers?.prefer).toBeUndefined();

    // Second request: explicitly enable entity IDs for this request only
    await db.from(contactsTO).list().execute({ useEntityIds: true });

    const call1 = mock.spy?.calls[1];
    expect(call1?.headers?.prefer).toBe("fmodata.entity-ids");

    // Third request: confirm default is still disabled
    await db.from(contactsTO).list().execute();

    const call2 = mock.spy?.calls[2];
    expect(call2?.headers?.prefer).toBeUndefined();
  });

  it("should work with insert operations", async () => {
    const localContactsTO = makeLocalContactsTO();

    const mock = new MockFMServerConnection({ enableSpy: true });
    mock.addRoute({
      urlPattern: "/TestDB",
      response: { id: "1", name: "Test" },
      status: 200,
    });
    const db = mock.database("TestDB", { useEntityIds: true });

    // Insert with entity IDs enabled — verify via URL (uses FMTID)
    // Note: The insert builder sets its own Prefer header ("return=representation")
    // which overwrites the entity-ids Prefer value. Entity ID usage is verified via URL.
    await db.from(localContactsTO).insert({ name: "Test" }).execute();

    const call0 = mock.spy?.calls[0];
    expect(call0?.url).toContain("FMTID:100");

    // Insert with entity IDs disabled — URL should use table name
    await db.from(localContactsTO).insert({ name: "Test" }).execute({ useEntityIds: false });

    const call1 = mock.spy?.calls[1];
    expect(call1?.url).toContain("/contacts");
    expect(call1?.url).not.toContain("FMTID:");
  });

  it("should work with update operations", async () => {
    const localContactsTO = makeLocalContactsTO();

    const mock = new MockFMServerConnection({ enableSpy: true });
    mock.addRoute({
      urlPattern: "/TestDB",
      response: "1",
      status: 200,
      headers: { "fmodata.affected_rows": "1" },
    });
    const db = mock.database("TestDB", { useEntityIds: true });

    // Update with entity IDs disabled
    await db.from(localContactsTO).update({ name: "Updated" }).byId("123").execute({ useEntityIds: false });

    const call0 = mock.spy?.calls[0];
    expect(call0?.headers?.prefer).toBeUndefined();

    // Update with entity IDs enabled
    await db.from(localContactsTO).update({ name: "Updated" }).byId("123").execute({ useEntityIds: true });

    const call1 = mock.spy?.calls[1];
    expect(call1?.headers?.prefer).toBe("fmodata.entity-ids");
  });

  it("should work with delete operations", async () => {
    const localContactsTO = makeLocalContactsTO();

    const mock = new MockFMServerConnection({ enableSpy: true });
    mock.addRoute({
      urlPattern: "/TestDB",
      response: null,
      status: 204,
      headers: { "fmodata.affected_rows": "1" },
    });
    const db = mock.database("TestDB", { useEntityIds: true });

    // Delete with entity IDs enabled
    await db.from(localContactsTO).delete().byId("123").execute({ useEntityIds: true });

    const call0 = mock.spy?.calls[0];
    expect(call0?.headers?.prefer).toBe("fmodata.entity-ids");

    // Delete with entity IDs disabled
    await db.from(localContactsTO).delete().byId("123").execute({ useEntityIds: false });

    const call1 = mock.spy?.calls[1];
    expect(call1?.headers?.prefer).toBeUndefined();
  });
});
