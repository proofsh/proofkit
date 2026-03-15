/**
 * Metadata Key Lookup Tests
 *
 * Covers the behavior of Database.getMetadata() when the OData server
 * returns metadata keys without the .fmp12 extension.
 *
 * FileMaker Server returns the database name as the key in the metadata
 * response WITHOUT the .fmp12 extension (e.g. "GMT_Web" not "GMT_Web.fmp12"),
 * but the Database instance is constructed with the full filename including
 * the extension.
 */

import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { describe, expect, it } from "vitest";

const SAMPLE_METADATA = {
  "@SchemaVersion": "1.0",
  someTable: { $Kind: "EntityType" },
};

describe("Database.getMetadata() key lookup", () => {
  it("resolves metadata when server returns key without .fmp12 extension", async () => {
    const responseBody = {
      $Version: "4.01",
      GMT_Web: SAMPLE_METADATA,
    };

    const mock = new MockFMServerConnection();
    mock.addRoute({ urlPattern: "/$metadata", response: responseBody });

    const db = mock.database("GMT_Web.fmp12");
    const metadata = await db.getMetadata();

    expect(metadata).toEqual(SAMPLE_METADATA);
  });

  it("resolves metadata when server returns key with .fmp12 extension (legacy/future servers)", async () => {
    const responseBody = {
      $Version: "4.01",
      "GMT_Web.fmp12": SAMPLE_METADATA,
    };

    const mock = new MockFMServerConnection();
    mock.addRoute({ urlPattern: "/$metadata", response: responseBody });

    const db = mock.database("GMT_Web.fmp12");
    const metadata = await db.getMetadata();

    expect(metadata).toEqual(SAMPLE_METADATA);
  });

  it("prefers the full name (with .fmp12) over the stripped name when both are present", async () => {
    const metadataWithExt = { note: "full name match" };
    const metadataWithoutExt = { note: "stripped name match" };

    const responseBody = {
      "GMT_Web.fmp12": metadataWithExt,
      GMT_Web: metadataWithoutExt,
    };

    const mock = new MockFMServerConnection();
    mock.addRoute({ urlPattern: "/$metadata", response: responseBody });

    const db = mock.database("GMT_Web.fmp12");
    const metadata = await db.getMetadata();

    expect(metadata).toEqual(metadataWithExt);
  });

  it("throws when neither the full name nor the stripped name is present", async () => {
    const responseBody = {
      $Version: "4.01",
      some_other_db: SAMPLE_METADATA,
    };

    const mock = new MockFMServerConnection();
    mock.addRoute({ urlPattern: "/$metadata", response: responseBody });

    const db = mock.database("GMT_Web.fmp12");
    await expect(db.getMetadata()).rejects.toThrow('Metadata for database "GMT_Web.fmp12" not found in response');
  });

  it("works with { format: 'json' } explicit argument as well", async () => {
    const responseBody = {
      $Version: "4.01",
      GMT_Web: SAMPLE_METADATA,
    };

    const mock = new MockFMServerConnection();
    mock.addRoute({ urlPattern: "/$metadata", response: responseBody });

    const db = mock.database("GMT_Web.fmp12");
    const metadata = await db.getMetadata({ format: "json" });

    expect(metadata).toEqual(SAMPLE_METADATA);
  });
});
