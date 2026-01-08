import { describe, expect, it } from "vitest";
import { createSelfHealingFetch } from "../../fmodata/tests/utils/self-healing-fetch";
import { getMetadata } from "../src/migrate";
import { createRawFetch } from "../src/odata";

function getTestEnv() {
  const fmServer = process.env.FM_SERVER;
  const fmDatabase = process.env.FM_DATABASE;
  const ottoApiKey = process.env.OTTO_API_KEY;

  if (!fmServer) {
    throw new Error("FM_SERVER is not set");
  }
  if (!fmDatabase) {
    throw new Error("FM_DATABASE is not set");
  }
  if (!ottoApiKey) {
    throw new Error("OTTO_API_KEY is not set");
  }

  return { fmServer, fmDatabase, ottoApiKey };
}

const { fmServer, fmDatabase, ottoApiKey } = getTestEnv();

// Create self-healing fetch handler for CI environments
const selfHealingFetchHandler = process.env.CI
  ? createSelfHealingFetch({
      serverUrl: fmServer,
      apiKey: ottoApiKey,
    })
  : undefined;

const { fetch } = createRawFetch({
  serverUrl: fmServer,
  auth: {
    apiKey: ottoApiKey,
  },
  database: fmDatabase,
  logging: "verbose",
  fetchHandler: selfHealingFetchHandler,
});

describe("migrate", () => {
  it("should get back metadata in JSON format", async () => {
    const metadata = await getMetadata(fetch, fmDatabase);
    expect(metadata).toBeDefined();
    expect(typeof metadata).toBe("object");
  });

  it("can create/update/delete a table", async () => {
    const tableName = "test_table";

    // Delete table if it exists (cleanup)
    const _deleteResult = await fetch(`/FileMaker_Tables/${tableName}`, {
      method: "DELETE",
    });
    // Don't throw on delete errors as table might not exist

    // Create table
    const createResult = await fetch("/FileMaker_Tables", {
      method: "POST",
      body: {
        tableName,
        fields: [
          {
            name: "Company ID",
            type: "varchar",
            primary: true,
          },
        ],
      },
    });

    if (createResult.error) {
      throw new Error(`Failed to create table: ${createResult.error}`);
    }

    // Add field to table
    const updateResult = await fetch(`/FileMaker_Tables/${tableName}`, {
      method: "PATCH",
      body: {
        fields: [
          {
            name: "Phone",
            type: "varchar",
          },
        ],
      },
    });

    if (updateResult.error) {
      throw new Error(`Failed to update table: ${updateResult.error}`);
    }

    // Delete field from table
    const deleteFieldResult = await fetch(`/FileMaker_Tables/${tableName}/Phone`, {
      method: "DELETE",
    });

    if (deleteFieldResult.error) {
      throw new Error(`Failed to delete field: ${deleteFieldResult.error}`);
    }

    // Delete table
    const deleteTableResult = await fetch(`/FileMaker_Tables/${tableName}`, {
      method: "DELETE",
    });

    if (deleteTableResult.error) {
      throw new Error(`Failed to delete table: ${deleteTableResult.error}`);
    }
  });
});
