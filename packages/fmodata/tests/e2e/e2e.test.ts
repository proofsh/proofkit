/**
 * End-to-End Tests
 *
 * Comprehensive E2E tests against a live FileMaker OData server.
 * Tests basic operations, entity IDs, and batch operations.
 */

import {
  contains,
  eq,
  FMServerConnection,
  fmTableOccurrence,
  isNotNull,
  type Metadata,
  textField,
} from "@proofkit/fmodata";
import { afterEach, assert, describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod/v4";
import { mockResponses } from "../fixtures/responses";
import { jsonCodec } from "../utils/helpers";
import { createMockFetch, simpleMock } from "../utils/mock-fetch";
import { apiKey, contacts, contactsTOWithIds, database, password, serverUrl, username, users } from "./setup";

if (!serverUrl) {
  throw new Error("FMODATA_SERVER_URL environment variable is required");
}

if (!database) {
  throw new Error("FMODATA_DATABASE environment variable is required");
}

// Track records created during tests for cleanup
const createdRecordIds: string[] = [];
const createdMarkers: string[] = [];

afterEach(async () => {
  if (!apiKey) {
    return; // Skip cleanup if not running basic operations tests
  }

  if (!(serverUrl && apiKey && database)) {
    throw new Error("FMODATA_SERVER_URL, FMODATA_API_KEY, and FMODATA_DATABASE environment variables are required");
  }

  const connection = new FMServerConnection({
    serverUrl,
    auth: { apiKey },
  });
  const db = connection.database(database);

  const entitySet = db.from(contacts);

  // Delete records by ID
  for (const recordId of createdRecordIds) {
    try {
      await entitySet.delete().byId(recordId).execute();
    } catch (error) {
      // Ignore errors - record may have already been deleted
      console.warn(`Failed to delete record ${recordId}:`, error);
    }
  }
  createdRecordIds.length = 0;

  // Delete records by marker/name pattern
  for (const marker of createdMarkers) {
    try {
      await entitySet
        .delete()
        .where((q) => q.where(contains(contacts.name, marker)))
        .execute();
    } catch (error) {
      // Ignore errors - records may have already been deleted
      console.warn(`Failed to delete records with marker ${marker}:`, error);
    }
  }
  createdMarkers.length = 0;
});

describe("Basic E2E Operations", () => {
  if (!apiKey) {
    it("API key required for basic operations tests", () => {
      // Test skipped - API key not available
    });
    return;
  }

  if (!(serverUrl && database)) {
    throw new Error("serverUrl and database are required");
  }
  const connection = new FMServerConnection({
    serverUrl,
    auth: { apiKey },
  });
  const db = connection.database(database);

  it("should connect to the server and list records", async () => {
    const entitySet = db.from(contacts);

    // Test basic list query (limit to 10 records to avoid timeout)
    const result = await entitySet.list().top(10).execute();
    if (!result.data) {
      console.log(result.error);
      throw new Error("Expected data to be defined");
    }

    assert(result.data, "Expected data to be defined");

    // Verify we got a response
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("should run a script and get back result", async () => {
    const { resultCode, result } = await db.runScript("return-input", {
      scriptParam: "hello world",
    });

    expect(resultCode).toBe(0);
    expect(result).toBe("hello world");

    const randomNumber = Math.floor(10_000 + Math.random() * 90_000);
    const { resultCode: resultCode2, result: result2 } = await db.runScript("return-input", {
      scriptParam: randomNumber,
    });
    expect(resultCode2).toBe(0);
    expect(result2).toBe(randomNumber.toString());
  });

  it("should transform the script result if a schema is provided", async () => {
    const { resultCode, result } = await db.runScript("return-input", {
      scriptParam: { hello: "world" },
      resultSchema: jsonCodec(z.object({ hello: z.string() }).transform((data) => ({ ...data, world: "world" }))),
    });
    expect(resultCode).toBe(0);
    expect(result).toStrictEqual({ hello: "world", world: "world" });
  });

  it("should insert a record and verify count increased", async () => {
    const entitySet = db.from(contacts);

    // Get initial count
    const initialCountResult = await entitySet.count().execute();
    assert(initialCountResult.data, "Expected data to be defined");
    const initialCount = initialCountResult.data;

    // Insert a new record with unique name to avoid conflicts
    const uniqueName = `Test User ${Date.now()}`;
    const insertResult = await entitySet
      .insert({
        name: uniqueName,
      })
      .execute();

    assert(insertResult.data, "Expected data to be defined");

    const insertedRecord = insertResult.data;

    // Track record ID for cleanup (use PrimaryKey from the schema)
    const recordId = insertedRecord.PrimaryKey;
    if (recordId) {
      createdRecordIds.push(recordId);
    }

    // Verify the record was inserted with correct data
    expect(insertedRecord.name).toBe(uniqueName);

    // Get count after insert
    const newCountResult = await entitySet.count().execute();
    assert(newCountResult.data, "Expected data to be defined");
    const newCount = newCountResult.data;

    // Verify count increased by 1
    expect(newCount).toBe(initialCount + 1);
  });

  it("should update a record by ID and return count", async () => {
    const entitySet = db.from(contacts);

    // First, insert a record to update
    const uniqueName = `Update Test ${Date.now()}`;
    const insertResult = await entitySet
      .insert({
        name: uniqueName,
      })
      .execute();

    assert(insertResult.data, "Expected insert data to be defined");
    const primaryKey = insertResult.data.PrimaryKey;
    assert(primaryKey, "Expected PrimaryKey to be defined");

    // Track record ID for cleanup
    createdRecordIds.push(primaryKey);

    // Update the record
    const updatedName = `${uniqueName} Updated`;
    const updateResult = await entitySet.update({ name: updatedName }).byId(primaryKey).execute();

    assert(updateResult.data, "Expected update data to be defined");
    expect(updateResult.error).toBeUndefined();
    expect(updateResult.data.updatedCount).toBe(1);
  });

  it("should update multiple records by filter and return count", async () => {
    const entitySet = db.from(contacts);

    // Insert multiple records with a unique marker
    const marker = `Bulk Update ${Date.now()}`;
    await entitySet.insert({ name: `${marker} - 1` }).execute();
    await entitySet.insert({ name: `${marker} - 2` }).execute();
    await entitySet.insert({ name: `${marker} - 3` }).execute();

    // Track marker for cleanup
    createdMarkers.push(marker);

    // Update all records with the marker
    const updateResult = await entitySet
      .update({ hobby: "Updated Hobby" })
      .where((q) => q.where(contains(contacts.name, marker)))
      .execute();

    assert(updateResult.data, "Expected update data to be defined");
    expect(updateResult.error).toBeUndefined();
    expect(updateResult.data.updatedCount).toBeGreaterThanOrEqual(3);
  });

  it("should delete a record by ID and return count", async () => {
    const entitySet = db.from(contacts);

    // First, insert a record to delete
    const uniqueName = `Delete Test ${Date.now()}`;
    const insertResult = await entitySet
      .insert({
        name: uniqueName,
      })
      .execute();

    assert(insertResult.data, "Expected insert data to be defined");
    const recordId = insertResult.data.PrimaryKey;
    assert(recordId, "Expected PrimaryKey to be defined");

    // Get count before delete
    const beforeCount = await entitySet.count().execute();
    assert(beforeCount.data, "Expected count data to be defined");

    // Delete the record
    const deleteQuery = entitySet.delete().byId(recordId);
    const deleteResult = await deleteQuery.execute();

    assert(deleteResult.data, "Expected delete data to be defined");
    expect(deleteResult.error).toBeUndefined();
    expect(deleteResult.data.deletedCount).toBe(1);

    // Verify count decreased
    const afterCount = await entitySet.count().execute();
    assert(afterCount.data, "Expected count data to be defined");
    expect(afterCount.data).toBe(beforeCount.data - 1);
  });

  it("should delete multiple records by filter and return count", async () => {
    const entitySet = db.from(contacts);

    // Insert multiple records with a unique marker
    const marker = `Bulk Delete ${Date.now()}`;
    await entitySet.insert({ name: `${marker} - 1` }).execute();
    await entitySet.insert({ name: `${marker} - 2` }).execute();
    await entitySet.insert({ name: `${marker} - 3` }).execute();

    // Get count before delete
    const beforeCount = await entitySet.count().execute();
    assert(beforeCount.data, "Expected count data to be defined");

    // Delete all records with the marker
    const deleteResult = await entitySet
      .delete()
      .where((q) => q.where(contains(contacts.name, marker)))
      .execute();

    assert(deleteResult.data, "Expected delete data to be defined");
    expect(deleteResult.error).toBeUndefined();
    expect(deleteResult.data.deletedCount).toBeGreaterThanOrEqual(3);

    // Verify count decreased
    const afterCount = await entitySet.count().execute();
    assert(afterCount.data, "Expected count data to be defined");
    expect(afterCount.data).toBeLessThanOrEqual(beforeCount.data - deleteResult.data.deletedCount);
  });

  it("should return records and count from list().count()", async () => {
    const entitySet = db.from(contacts);

    const result = await entitySet.list().top(2).count().execute();

    expect(result.error).toBeUndefined();
    assert(result.data, "Expected data to be defined");
    expect(Array.isArray(result.data.records)).toBe(true);
    expect(result.data.records.length).toBeLessThanOrEqual(2);
    expect(result.data.count).toBeGreaterThanOrEqual(result.data.records.length);
  });

  it("should properly type and validate expanded properties", async () => {
    const entitySet = db.from(contacts);

    // Test expand with type safety
    const result = await entitySet
      .list()
      .expand(users, (b: any) => b.select({ name: users.name }))
      .execute();

    // Verify we got a response
    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    if (!result.data) {
      throw new Error("Expected result.data to be defined");
    }
    expect(Array.isArray(result.data)).toBe(true);

    const firstRecord = result.data[0];
    assert(firstRecord, "Should have a first record");

    expect(firstRecord.users).toBeDefined();
    expect(firstRecord.users.length).toBeGreaterThan(0);
  });

  it("the server should validate all fields in the expand are valid", async () => {
    const notRealUsers = fmTableOccurrence("users", {
      not_real_field: textField(),
    });
    const result = await db
      .from(contacts)
      .list()
      .expand(users, (b: any) => {
        return b.select({ notReal: notRealUsers.not_real_field });
      })
      .execute({
        fetchHandler: createMockFetch(mockResponses["list with invalid expand"]),
      });

    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain("not_real_field");
  });

  describe("Metadata", () => {
    it("should retrieve database metadata in JSON format by default", async () => {
      const metadata = await db.getMetadata();

      // Type checks: default is JSON (Metadata type)
      expectTypeOf(metadata).not.toBeString();
      expectTypeOf(metadata).not.toBeUnknown();
      expectTypeOf(metadata).not.toBeAny();
      expectTypeOf(metadata).toEqualTypeOf<Metadata>();

      // Runtime checks
      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe("object");
    });

    it("should retrieve database metadata in JSON format when explicitly specified", async () => {
      const metadata = await db.getMetadata({ format: "json" });

      // Type checks: explicit JSON (Metadata type)
      expectTypeOf(metadata).not.toBeString();
      expectTypeOf(metadata).not.toBeUnknown();
      expectTypeOf(metadata).not.toBeAny();
      expectTypeOf(metadata).toEqualTypeOf<Metadata>();

      // Runtime checks
      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe("object");

      expect(metadata).toHaveProperty("contacts");
    });

    it("should retrieve database metadata in XML format", async () => {
      const metadata = await db.getMetadata({ format: "xml" });

      // Type checks: XML format returns string
      expectTypeOf(metadata).not.toBeUnknown();
      expectTypeOf(metadata).not.toBeAny();
      expectTypeOf(metadata).toEqualTypeOf<string>();

      // Runtime checks
      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe("string");
      expect(metadata).toContain("<?xml");
      expect(metadata).toContain("edmx:Edmx");
    });
  });
});

describe("Entity IDs", () => {
  if (!(username && password)) {
    it("Username and password required for entity IDs tests", () => {
      // Test skipped - username/password not available
    });
    return;
  }

  if (!(serverUrl && database)) {
    throw new Error("serverUrl and database are required");
  }
  const connection = new FMServerConnection({
    serverUrl,
    auth: { username, password },
  });

  const db = connection.database(database, { useEntityIds: true });

  const dbWithoutIds = connection.database(database, {
    useEntityIds: false,
  });

  it("should not use entity IDs in the queryString if useEntityIds is false", () => {
    const query = dbWithoutIds
      .from(contactsTOWithIds)
      .list()
      .select({
        name_renamed: contactsTOWithIds.name_renamed,
        hobby: contactsTOWithIds.hobby,
      })
      .expand(users)
      .where(eq(contactsTOWithIds.hobby, "Testing"))
      .top(1);
    const queryString = query.getQueryString();
    console.log(queryString);
    expect(queryString).not.toContain("FMFID");
    expect(queryString).not.toContain("FMTID");
  });

  it("should replace field names in select statements with entity IDs", () => {
    const query = db
      .from(contactsTOWithIds)
      .list()
      .select({
        name_renamed: contactsTOWithIds.name_renamed,
        hobby: contactsTOWithIds.hobby,
      })
      .top(1);

    const queryString = query.getQueryString();
    expect(queryString).toContain("25770868870");
    expect(queryString).toContain("30065836166");
    expect(queryString).not.toContain("name_renamed");
    expect(queryString).not.toContain("hobby");
  });

  it("should list records with entity IDs", async () => {
    let rawResponseData: any;

    let capturedPreferHeader: string | null = null;
    await db
      .from(contactsTOWithIds)
      .list()
      .top(1)
      .execute({
        hooks: {
          before: (req: any) => {
            const headers = req.headers;
            capturedPreferHeader = headers.get("Prefer");
          },
        },
        fetchHandler: simpleMock({ status: 200, body: { value: [{}] } }),
      });
    expect(capturedPreferHeader).toBe("fmodata.entity-ids");

    const result = await db
      .from(contactsTOWithIds)
      .list()
      .top(1)
      .execute({
        hooks: {
          after: async (_req: any, res: any) => {
            // Clone the response so we can read it without consuming the original
            const clonedRes = res.clone();
            rawResponseData = await clonedRes.json();
          },
        },
      });

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    if (!result.data) {
      throw new Error("Expected result.data to be defined");
    }
    expect(Array.isArray(result.data)).toBe(true);

    const firstRecord = result.data[0];
    assert(firstRecord, "Should have a first record");

    // Verify the raw response contains field IDs (FMFID:xxx format)
    expect(rawResponseData).toBeDefined();
    expect(rawResponseData.value).toBeDefined();
    expect(Array.isArray(rawResponseData.value)).toBe(true);

    // Check that the raw response uses field IDs (not field names)
    const rawFirstRecord = rawResponseData.value[0];
    const rawFieldKeys = Object.keys(rawFirstRecord);

    // Assert that raw response has FMFIDs and NOT field names
    expect(rawFieldKeys).toContain("FMFID:25770868870"); // should be "name"
    expect(rawFieldKeys).not.toContain("name");
    expect(rawFieldKeys).toContain("FMFID:30065836166"); // should be "hobby"
    expect(rawFieldKeys).not.toContain("hobby");
    expect(rawFieldKeys).toContain("FMFID:38655770758"); // should be "id_user"
    expect(rawFieldKeys).not.toContain("id_user");
    expect(rawFieldKeys).toContain("FMFID:4296032390"); // should be "PrimaryKey"
    expect(rawFieldKeys).not.toContain("PrimaryKey");
    expect(rawFieldKeys).toContain("FMFID:8590999686"); // should be "CreationTimestamp"
    expect(rawFieldKeys).not.toContain("CreationTimestamp");

    // Verify that the transformed data uses field names (not IDs)
    const transformedFieldKeys = Object.keys(firstRecord);
    expect(transformedFieldKeys).toContain("name_renamed");
    expect(transformedFieldKeys).toContain("hobby");
    expect(transformedFieldKeys).toContain("id_user");
    expect(transformedFieldKeys).toContain("PrimaryKey");
    expect(transformedFieldKeys).toContain("CreationTimestamp");
    expect(transformedFieldKeys).not.toContain("FMFID:25770868870");
  });

  it("should not transform if the feature is disabled (even if ids are provided)", async () => {
    let rawResponseData: any;

    const query = dbWithoutIds.from(contacts).list().select({ hobby: contacts.hobby }).top(1);

    // should not use ids when useEntityIds is false
    expect(query.getQueryString()).toContain("contacts");
    expect(query.getQueryString()).not.toContain("FMFID:");
    expect(query.getQueryString()).not.toContain("FMTID:");

    const result = await query.execute({
      hooks: {
        after: async (_req: any, res: any) => {
          // Clone the response so we can read it without consuming the original
          const clonedRes = res.clone();
          rawResponseData = await clonedRes.json();
        },
      },
    });

    if (result.error) {
      console.error(result.error);
    }

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    if (!result.data) {
      throw new Error("Expected result.data to be defined");
    }
    expect(Array.isArray(result.data)).toBe(true);

    const firstRecord = result.data[0];
    assert(firstRecord, "Should have a first record");

    // Verify the raw response contains field IDs (FMFID:xxx format)
    expect(rawResponseData).toBeDefined();
    expect(rawResponseData.value).toBeDefined();
    expect(Array.isArray(rawResponseData.value)).toBe(true);

    // Check that the raw response uses field IDs (not field names)
    const rawFirstRecord = rawResponseData.value[0];
    const rawFieldKeys = Object.keys(rawFirstRecord);

    // Assert that raw response has field names and NOT FMFIDs (since useEntityIds is false)
    expect(rawFieldKeys).not.toContain("FMFID:"); // should NOT have FMFIDs
    expect(rawFieldKeys).toContain("hobby");

    // Verify that the transformed data uses field names (not IDs)
    const transformedFieldKeys = Object.keys(firstRecord);
    expect(transformedFieldKeys).toContain("hobby");
    expect(transformedFieldKeys).not.toContain("FMFID:");
  });

  it("should properly type and validate expanded properties with entity IDs", async () => {
    // get the first record
    const result = await db
      .from(contactsTOWithIds)
      .list()
      .top(1)
      .select({ PrimaryKey: contactsTOWithIds.PrimaryKey })
      .execute();

    const firstRecord = result.data?.[0];
    assert(firstRecord, "Should have a first record");
    if (!firstRecord.PrimaryKey) {
      throw new Error("Expected PrimaryKey to be defined");
    }

    // now expand the users property
    const expandedResult = await db.from(contactsTOWithIds).get(firstRecord.PrimaryKey).expand(users);

    // should use the table id in the query string
    expect(expandedResult.getQueryString()).not.toContain("/contacts(");
  });
});

describe("Batch Operations", () => {
  if (!(username && password)) {
    it("Username and password required for batch operations tests", () => {
      // Test skipped - username/password not available
    });
    return;
  }

  if (!(serverUrl && database)) {
    throw new Error("serverUrl and database are required");
  }
  const connection = new FMServerConnection({
    serverUrl,
    auth: { username, password },
  });

  const db = connection.database(database);

  const batchCreatedRecordIds: string[] = [];

  afterEach(async () => {
    const entitySet = db.from(contacts);

    // Delete records by ID
    for (const recordId of batchCreatedRecordIds) {
      try {
        await entitySet.delete().byId(recordId).execute();
      } catch (error) {
        // Ignore errors - record may have already been deleted
        console.warn(`Failed to delete record ${recordId}:`, error);
      }
    }
    batchCreatedRecordIds.length = 0;
  });

  it("should execute simple batch with two GET queries", async () => {
    // Create two different query builders
    const query1 = db.from(contacts).list().top(2);
    const query2 = db.from(users).list().top(2);

    // Execute batch
    const result = await db.batch([query1, query2]).execute();

    // Verify we got results
    expect(result.results).toBeDefined();
    expect(result.results.length).toBe(2);

    // Verify first result (contacts)
    const [r1, r2] = result.results;
    expect(r1.error).toBeUndefined();
    expect(r2.error).toBeUndefined();

    const contactsResult = r1.data;
    const _usersResult = r2.data;

    if (!contactsResult) {
      throw new Error("Expected contactsResult to be defined");
    }

    // Contacts should be an array
    expect(Array.isArray(contactsResult)).toBe(true);
    const firstContact = contactsResult[0];
    if (!firstContact) {
      throw new Error("Expected firstContact to be defined");
    }
    expect(firstContact).toBeDefined();
    expect(firstContact).not.toHaveProperty("@odata.id");
    expect(firstContact).not.toHaveProperty("@odata.editLink");
    expect(firstContact.hobby).toBe("Board games");
  });

  it("should allow adding to a batch after it has been created", async () => {
    const batch = db.batch([]);
    batch.addRequest(db.from(contacts).list().top(2));
    const result = await batch.execute();

    expect(result.results).toBeDefined();
    expect(result.results.length).toBe(1);
    const r1 = (result.results as unknown as any[])[0];
    if (!r1) {
      throw new Error("Expected result at index 0");
    }
    expect(r1.error).toBeUndefined();
    expect(r1.data).toBeDefined();
  });

  it("should execute batch with mixed operations (GET + POST)", async () => {
    // Create a GET query and a POST insert
    const listQuery = db.from(contacts).list().top(2);
    const insertQuery = db.from(contacts).insert({
      name: "Batch Test User",
      hobby: "Testing",
    });

    // Execute batch with mixed operations
    const result = await db.batch([listQuery, insertQuery]).execute();

    // Verify we got results
    expect(result.results).toBeDefined();
    expect(result.results.length).toBe(2);

    const [r1, r2] = result.results;
    expect(r1.error).toBeUndefined();
    expect(r2.error).toBeUndefined();

    const listResult = r1.data;
    const insertResult = r2.data;

    if (!listResult) {
      throw new Error("Expected listResult to be defined");
    }

    // Verify list result is an array
    expect(Array.isArray(listResult)).toBe(true);
    expect(listResult.length).toBeGreaterThan(0);

    // Verify insert result
    expect(insertResult).toBeDefined();
    expect(typeof insertResult).toBe("object");
  });

  it("should execute batch with multiple POST operations in a changeset", async () => {
    // Create multiple insert operations
    const insert1 = db.from(contacts).insert({
      name: "Batch User 1",
      hobby: "Reading",
    });

    const insert2 = db.from(contacts).insert({
      name: "Batch User 2",
      hobby: "Writing",
    });

    const insert3 = db.from(contacts).insert({
      name: "Batch User 3",
      hobby: "Gaming",
    });

    // Execute batch with multiple POST operations
    const result = await db.batch([insert1, insert2, insert3]).execute();

    // Verify we got results
    expect(result.results).toBeDefined();
    expect(result.results.length).toBe(3);

    const [r1, r2, r3] = result.results;
    expect(r1.error).toBeUndefined();
    expect(r2.error).toBeUndefined();
    expect(r3.error).toBeUndefined();

    // All inserts should return empty objects (204 No Content in batch)
    expect(r1.data).toBeDefined();
    expect(typeof r1.data).toBe("object");
    expect(r2.data).toBeDefined();
    expect(typeof r2.data).toBe("object");
    expect(r3.data).toBeDefined();
    expect(typeof r3.data).toBe("object");
  });

  it("should execute complex batch with multiple operation types", async () => {
    // First, create a record we can update/delete
    const setupInsert = await db
      .from(contacts)
      .insert({
        name: "Test Record for Batch",
        hobby: "Testing",
      })
      .execute();

    expect(setupInsert.error).toBeUndefined();
    const testRecordId = setupInsert.data?.PrimaryKey;
    if (!testRecordId) {
      throw new Error("Failed to create test record");
    }
    batchCreatedRecordIds.push(testRecordId);

    // Create a complex batch with multiple operation types
    const listQuery = db.from(contacts).list().top(1);
    const insertOp = db.from(contacts).insert({
      name: "Complex Batch Insert",
      hobby: "Batch Testing",
    });
    const updateOp = db
      .from(contacts)
      .update({
        name: "Updated via Batch",
      })
      .byId(testRecordId);
    const deleteOp = db.from(contacts).delete().byId(testRecordId);

    // Execute the complex batch
    const result = await db.batch([listQuery, insertOp, updateOp, deleteOp]).execute();

    // Verify we got results
    expect(result.results).toBeDefined();
    expect(result.results.length).toBe(4);

    const [r1, r2, r3, r4] = result.results;
    expect(r1.error).toBeUndefined();
    expect(r2.error).toBeUndefined();
    expect(r3.error).toBeUndefined();
    expect(r4.error).toBeUndefined();

    const listResult = r1.data;
    const insertResult = r2.data;
    const updateResult = r3.data;
    const deleteResult = r4.data;

    if (!listResult) {
      throw new Error("Expected listResult to be defined");
    }

    // Verify list result
    expect(Array.isArray(listResult)).toBe(true);
    expect(listResult.length).toBe(1);

    // Verify insert result (204 No Content in batch)
    expect(insertResult).toBeDefined();
    expect(typeof insertResult).toBe("object");

    // Verify update result
    expect(updateResult).toBeDefined();
    expect(typeof updateResult).toBe("object");
    expect((updateResult as any).updatedCount).toBeDefined();

    // Verify delete result
    expect(deleteResult).toBeDefined();
    expect(typeof deleteResult).toBe("object");
    expect((deleteResult as any).deletedCount).toBeDefined();
  });

  it("should correctly infer tuple types for batch results", async () => {
    // Create a batch with different operation types
    const query1 = db.from(contacts).list().top(1);
    const query2 = db.from(users).list().top(1);
    const insert = db.from(contacts).insert({
      name: "Type Test User",
      hobby: "Testing Types",
    });

    const result = await db.batch([query1, query2, insert]).execute();

    expect(result.results).toBeDefined();
    expect(result.results.length).toBe(3);

    const [r1, r2, r3] = result.results;
    expect(r1.error).toBeUndefined();
    expect(r2.error).toBeUndefined();
    expect(r3.error).toBeUndefined();

    if (!(r1.data && r2.data && r3.data)) {
      throw new Error("Expected all results to have data");
    }

    expectTypeOf(result.results).not.toBeAny();

    const contactsData = r1.data;
    const usersData = r2.data;
    const insertedContact = r3.data;
    expectTypeOf(contactsData).not.toBeAny();
    expectTypeOf(usersData).not.toBeAny();
    expectTypeOf(insertedContact).not.toBeAny();

    // Verify types are correctly inferred
    expect(Array.isArray(contactsData)).toBe(true);
    expect(Array.isArray(usersData)).toBe(true);
    expect(typeof insertedContact).toBe("object");

    const firstContact = contactsData[0];
    if (!firstContact) {
      throw new Error("Expected firstContact to be defined");
    }
    expect(firstContact).toBeDefined();

    const hobby: string | null = firstContact.hobby;
    expect(typeof hobby).toBe("string");

    const firstUser = usersData[0];
    if (!firstUser) {
      throw new Error("Expected firstUser to be defined");
    }
    expect(firstUser).toBeDefined();

    expectTypeOf(firstUser.name).not.toBeAny();

    // Clean up
    if (insertedContact.PrimaryKey) {
      batchCreatedRecordIds.push(insertedContact.PrimaryKey);
    }
  });

  it("should execute batch with 3 GET operations each with a filter", async () => {
    // Create three GET queries with different filters
    const query1 = db.from(contacts).list().where(eq(contacts.hobby, "static-value"));
    const query2 = db.from(contacts).list().where(eq(contacts.id_user, "never"));
    const query3 = db.from(users).list().where(isNotNull(users.name));

    let flag = 1;
    // Execute batch
    const result = await db.batch([query1, query2, query3]).execute({
      hooks: {
        after: () => {
          flag = 2;
        },
      },
    });

    // ensure the hook was called
    expect(flag).toBe(2);

    // Verify we got results
    expect(result.results).toBeDefined();
    expect(result.results.length).toBe(3);

    const [r1, r2, r3] = result.results;
    expect(r1.error).toBeUndefined();
    expect(r2.error).toBeUndefined();
    expect(r3.error).toBeUndefined();

    const result1 = r1.data;
    const result2 = r2.data;
    const result3 = r3.data;

    // Verify first result (contacts filtered by hobby)
    expect(Array.isArray(result1)).toBe(true);
    if (result1 && result1.length > 0) {
      const firstContact = result1[0];
      if (!firstContact) {
        throw new Error("Expected firstContact to be defined");
      }
      expect(firstContact).toBeDefined();
      expect(firstContact.hobby).toBe("static-value");
    }

    // Verify second result (contacts filtered by name not null)
    expect(Array.isArray(result2)).toBe(true);

    // Verify third result (users filtered by name not null)
    expect(Array.isArray(result3)).toBe(true);
  });
});
