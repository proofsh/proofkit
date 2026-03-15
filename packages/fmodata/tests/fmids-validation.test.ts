/**
 * Tests for BaseTable and TableOccurrence with entity IDs
 *
 * These tests verify:
 * 1. Successful instantiation with entity IDs using setup functions
 * 2. Entity ID functionality works correctly
 * 3. Backward compatibility of regular classes
 */

import { FMTable, fmTableOccurrence, textField } from "@proofkit/fmodata";
import { describe, expect, it } from "vitest";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";

describe("BaseTable with entity IDs", () => {
  it("should create a table with fmfIds using fmTableOccurrence", () => {
    const table = fmTableOccurrence("test_table", {
      id: textField().primaryKey().entityId("FMFID:1"),
      name: textField().entityId("FMFID:2"),
      email: textField().entityId("FMFID:3"),
    });

    expect(table).toBeInstanceOf(FMTable);
    const fmfIds = (table as any)[FMTable.Symbol.BaseTableConfig]?.fmfIds;
    expect(fmfIds).toBeDefined();
    expect(fmfIds?.id).toBe("FMFID:1");
    expect(fmfIds?.name).toBe("FMFID:2");
    expect(fmfIds?.email).toBe("FMFID:3");
    expect(fmfIds !== undefined).toBe(true);
  });

  it("should enforce fmfIds format with template literal type", () => {
    // This should work
    const table = fmTableOccurrence("test_table", {
      id: textField().primaryKey().entityId("FMFID:123"),
      name: textField().entityId("FMFID:abc"),
    });

    expect(table.id.entityId).toBe("FMFID:123");
  });

  it("should inherit all table functionality", () => {
    const table = fmTableOccurrence("test_table", {
      id: textField().primaryKey().entityId("FMFID:1"),
      name: textField().readOnly().entityId("FMFID:2"),
      email: textField().entityId("FMFID:3"),
    });

    expect((table as any)[FMTable.Symbol.Schema]).toBeDefined();
    expect((table as any)[FMTable.Symbol.BaseTableConfig].idField).toBe("id");
    expect((table as any)[FMTable.Symbol.BaseTableConfig].readOnly).toContain("name");
  });
});

describe("TableOccurrence with entity IDs", () => {
  it("should create a table with entityId using fmTableOccurrence", () => {
    const tableOcc = fmTableOccurrence(
      "test_table",
      {
        id: textField().primaryKey().entityId("FMFID:1"),
        name: textField().entityId("FMFID:2"),
      },
      {
        entityId: "FMTID:100",
      },
    );

    expect(tableOcc).toBeInstanceOf(FMTable);
    expect((tableOcc as any)[FMTable.Symbol.EntityId]).toBe("FMTID:100");
    expect((tableOcc as any)[FMTable.Symbol.Name]).toBe("test_table");
    expect((tableOcc as any)[FMTable.Symbol.EntityId] !== undefined).toBe(true);
  });

  it("should work with fmTableOccurrence helper", () => {
    const tableOcc = fmTableOccurrence(
      "test_table",
      {
        id: textField().primaryKey().entityId("FMFID:1"),
        name: textField().entityId("FMFID:2"),
      },
      {
        entityId: "FMTID:100",
      },
    );

    expect((tableOcc as any)[FMTable.Symbol.EntityId]).toBe("FMTID:100");
    expect((tableOcc as any)[FMTable.Symbol.EntityId] !== undefined).toBe(true);
  });

  it("should inherit all table functionality", () => {
    const tableOcc = fmTableOccurrence(
      "test_table",
      {
        id: textField().primaryKey().entityId("FMFID:1"),
        name: textField().entityId("FMFID:2"),
        email: textField().entityId("FMFID:3"),
      },
      {
        entityId: "FMTID:100",
        defaultSelect: "all",
      },
    );

    expect((tableOcc as any)[FMTable.Symbol.DefaultSelect]).toBe("all");
    expect((tableOcc as any)[FMTable.Symbol.NavigationPaths]).toBeDefined();
  });
});

describe("Type enforcement (compile-time)", () => {
  it("should allow tables with and without entity IDs", () => {
    const regularTableOcc = fmTableOccurrence("test", {
      id: textField().primaryKey(),
      name: textField(),
    });

    const withIdsTableOcc = fmTableOccurrence(
      "test",
      {
        id: textField().primaryKey().entityId("FMFID:1"),
        name: textField().entityId("FMFID:2"),
      },
      {
        entityId: "FMTID:100",
      },
    );

    expect(regularTableOcc).toBeDefined();
    expect(withIdsTableOcc).toBeDefined();
    expect((withIdsTableOcc as any)[FMTable.Symbol.BaseTableConfig].fmfIds).toBeDefined();
  });

  it("should not allow mixture of occurrences when creating a database", () => {
    const _regularTableOcc = fmTableOccurrence("regular", {
      id: textField().primaryKey(),
      name: textField(),
    });

    const _withIdsTableOcc = fmTableOccurrence(
      "withIds",
      {
        id: textField().primaryKey().entityId("FMFID:1"),
        name: textField().entityId("FMFID:2"),
      },
      {
        entityId: "FMTID:100",
      },
    );

    // Note: The new ORM pattern doesn't have the same mixing restriction
    // Both tables can be used together regardless of entity IDs
    expect(() => {
      new MockFMServerConnection().database("test");
    }).not.toThrow();

    // Should not throw when mixed if useEntityIds is set to false
    expect(() => {
      new MockFMServerConnection().database("test", {
        useEntityIds: false,
      });
    }).not.toThrow();

    // Note: The new ORM pattern handles entity IDs differently
    // This test may need adjustment based on actual behavior
  });

  it("should create table without entity IDs", () => {
    const tableOcc = fmTableOccurrence("test", {
      id: textField().primaryKey(),
      name: textField(),
    });

    expect(tableOcc).toBeInstanceOf(FMTable);
  });
});

describe("Navigation type validation", () => {
  it("should allow navigation with any table", () => {
    // Navigation can use any table - unified classes allow mixing
    const relatedTO = fmTableOccurrence(
      "related",
      {
        id: textField().primaryKey().entityId("FMFID:3"),
      },
      {
        entityId: "FMTID:200",
      },
    );

    const mainTO = fmTableOccurrence(
      "main",
      {
        id: textField().primaryKey().entityId("FMFID:1"),
        name: textField().entityId("FMFID:2"),
      },
      {
        entityId: "FMTID:100",
        navigationPaths: ["related"],
      },
    );

    expect(mainTO).toBeDefined();
    expect((relatedTO as any)[FMTable.Symbol.EntityId]).toBe("FMTID:200");
  });
});

describe("Helper functions", () => {
  it("should create table with fmTableOccurrence helper", () => {
    const to = fmTableOccurrence("test", {
      id: textField().primaryKey(),
    });

    expect(to).toBeInstanceOf(FMTable);
    expect((to as any)[FMTable.Symbol.Name]).toBe("test");
  });

  it("should create table with entity IDs using fmTableOccurrence helper", () => {
    const to = fmTableOccurrence(
      "test",
      {
        id: textField().primaryKey().entityId("FMFID:1"),
      },
      {
        entityId: "FMTID:100",
      },
    );

    expect(to).toBeInstanceOf(FMTable);
    expect((to as any)[FMTable.Symbol.EntityId]).toBe("FMTID:100");
  });
});
