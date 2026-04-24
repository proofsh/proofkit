import { fmTableOccurrence, textField } from "@proofkit/fmodata";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { describe, expect, it, vi } from "vitest";

const contacts = fmTableOccurrence("contacts", {
  id: textField().primaryKey(),
  name: textField(),
});

describe("normalizeDatabaseName", () => {
  it("strips .fmp12 by default for normal requests", async () => {
    const mock = new MockFMServerConnection({ enableSpy: true });
    mock.addRoute({
      urlPattern: "/TestDB/contacts",
      response: { value: [{ id: "1", name: "John" }] },
    });

    const db = mock.database("TestDB.fmp12");
    await db.from(contacts).list().execute();

    expect(mock.spy?.calls[0]?.url).toContain("/TestDB/contacts");
    expect(mock.spy?.calls[0]?.url).not.toContain("/TestDB.fmp12/contacts");
  });

  it("preserves the provided database name when disabled at database level", async () => {
    const mock = new MockFMServerConnection({ enableSpy: true });
    mock.addRoute({
      urlPattern: "/TestDB.fmp12/contacts",
      response: { value: [{ id: "1", name: "John" }] },
    });

    const db = mock.database("TestDB.fmp12", { normalizeDatabaseName: false });
    await db.from(contacts).list().execute();

    expect(mock.spy?.calls[0]?.url).toContain("/TestDB.fmp12/contacts");
  });

  it("supports per-request override for normal requests", async () => {
    const mock = new MockFMServerConnection({ enableSpy: true });
    mock.addRoute({
      urlPattern: "/TestDB.fmp12/contacts",
      response: { value: [{ id: "1", name: "John" }] },
    });

    const db = mock.database("TestDB.fmp12");
    await db.from(contacts).list().execute({ normalizeDatabaseName: false });

    expect(mock.spy?.calls[0]?.url).toContain("/TestDB.fmp12/contacts");
  });

  it("adds .fmp12 for webhook list by default", async () => {
    const mock = new MockFMServerConnection({ enableSpy: true });
    mock.addRoute({
      urlPattern: "/TestDB.fmp12/Webhook.GetAll",
      response: { status: "ACTIVE", webhooks: [] },
    });

    const db = mock.database("TestDB");
    await db.webhook.list();

    expect(mock.spy?.calls[0]?.url).toContain("/TestDB.fmp12/Webhook.GetAll");
  });

  it("adds .fmp12 for webhook add and remove by default", async () => {
    const mock = new MockFMServerConnection({ enableSpy: true });
    mock.addRoute({
      urlPattern: "/TestDB.fmp12/Webhook.Add",
      method: "POST",
      response: { webhookResult: { webhookID: 1 } },
    });
    mock.addRoute({
      urlPattern: "/TestDB.fmp12/Webhook.Delete(1)",
      method: "POST",
      response: { webhookResult: { webhookID: 1 } },
    });

    const db = mock.database("TestDB");
    await db.webhook.add({
      webhook: "https://example.com/webhook",
      tableName: contacts,
    });
    await db.webhook.remove(1);

    expect(mock.spy?.calls[0]?.url).toContain("/TestDB.fmp12/Webhook.Add");
    expect(mock.spy?.calls[1]?.url).toContain("/TestDB.fmp12/Webhook.Delete(1)");
  });

  it("supports per-request override for webhook list", async () => {
    const mock = new MockFMServerConnection({ enableSpy: true });
    mock.addRoute({
      urlPattern: "/TestDB/Webhook.GetAll",
      response: { status: "ACTIVE", webhooks: [] },
    });

    const db = mock.database("TestDB");
    await db.webhook.list({ normalizeDatabaseName: false });

    expect(mock.spy?.calls[0]?.url).toContain("/TestDB/Webhook.GetAll");
    expect(mock.spy?.calls[0]?.url).not.toContain("/TestDB.fmp12/Webhook.GetAll");
  });

  it("warns once for Otto auth when normalizeDatabaseName=false is requested", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const mock = new MockFMServerConnection({
      enableSpy: true,
      logger: { level: "warn" },
    });
    mock.addRoute({
      urlPattern: "/TestDB.fmp12/contacts",
      response: { value: [{ id: "1", name: "John" }] },
    });

    const db = mock.database("TestDB.fmp12");
    await db.from(contacts).list().execute({ normalizeDatabaseName: false });
    await db.from(contacts).list().execute({ normalizeDatabaseName: false });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("normalizeDatabaseName=false");
    warnSpy.mockRestore();
  });
});
