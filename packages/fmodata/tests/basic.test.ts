import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { FileMakerOData, TableDefinition, Table } from "../src/index";

describe("fmodata", async () => {
  it("should be defined", () => {
    expect(true).toBe(true);
  });

  it("should setup server instance", async () => {
    const server = new FileMakerOData({
      serverUrl: "https://api.proofkit.dev",
      auth: {
        username: "test",
        password: "test",
      },
      // fetchClientOptions: { fetchHandler: fetch },
    });

    const db = server.database("Contacts");

    const table = db.table("Contacts", {
      schema: {
        id: z.number(),
        name: z.string(),
        email: z.string(),
        phone: z.string(),
        address: z.string(),
        city: z.string(),
        state: z.string(),
      },
      related: {
        relatedTableName: {
          id: z.string(),
          title: z.string(),
        },
      },
    });

    // list records from table
    await table.list().execute();

    // get a single record
    await table.get("my-uuid").execute();

    // get a single record with a single field
    await table.get("my-uuid").getSingleField("address").execute();

    // list all related records
    await table.get("my-uuid").navigate("relatedTable").execute();

    // with filter builder options
    await table.select("email", "city").execute(); // return array of records
    await table.select("email", "city").single().execute(); // return single record

    // build query string
    table.select("email", "city").getQueryString();
  });

  it("should create standalone TableDefinition", () => {
    const schema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.string(),
    });

    const tableDef = new TableDefinition({
      name: "Users",
      schema,
    });

    expect(tableDef.name).toBe("Users");
    expect(tableDef.schema).toBe(schema);
  });

  it("should use TableDefinition with Table class", () => {
    const schema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.string(),
    });

    // Create standalone table definition
    const tableDef = new TableDefinition({
      name: "Users",
      schema,
    });

    // Create client
    const client = new FileMakerOData({
      serverUrl: "https://api.proofkit.dev",
      auth: {
        username: "test",
        password: "test",
      },
    });

    // Use table definition with client
    const table = new Table({
      definition: tableDef,
      databaseName: "TestDB",
      context: client,
    });

    // Verify the table can create builders
    const queryBuilder = table.select("id", "name");
    expect(queryBuilder).toBeDefined();
    expect(queryBuilder.getQueryString()).toContain("$select");

    const recordBuilder = table.get("123");
    expect(recordBuilder).toBeDefined();
    expect(recordBuilder.getRequestConfig().url).toContain("Users");
  });

  it("should allow table definitions to be reused across different contexts", () => {
    const schema = z.object({
      id: z.number(),
      name: z.string(),
    });

    // Create a single table definition
    const tableDef = new TableDefinition({
      name: "Products",
      schema,
    });

    // Create two different clients
    const client1 = new FileMakerOData({
      serverUrl: "https://server1.example.com",
      auth: { username: "user1", password: "pass1" },
    });

    const client2 = new FileMakerOData({
      serverUrl: "https://server2.example.com",
      auth: { username: "user2", password: "pass2" },
    });

    // Use the same definition with both clients
    const table1 = new Table({
      definition: tableDef,
      databaseName: "DB1",
      context: client1,
    });

    const table2 = new Table({
      definition: tableDef,
      databaseName: "DB2",
      context: client2,
    });

    // Both tables should have the same table name from the definition
    expect(table1.get("1").getRequestConfig().url).toContain("Products");
    expect(table2.get("1").getRequestConfig().url).toContain("Products");
  });
});
