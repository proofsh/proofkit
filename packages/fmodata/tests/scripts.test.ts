/**
 * Script Tests
 *
 * Tests for running FileMaker scripts via the OData API.
 */

import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod/v4";
import { jsonCodec } from "./utils/helpers";

describe("scripts", () => {
  const client = new MockFMServerConnection();

  it("should handle expands", () => {
    expectTypeOf(client.asConnection.listDatabaseNames).returns.resolves.toBeArray();
    const db = client.database("test_db");

    expectTypeOf(db.listTableNames).returns.resolves.toBeArray();

    const resp = db.runScript("script name");
    // Catch the promise to prevent unhandled rejection (this is a type-only test)
    resp.catch(() => {
      // Ignore errors in type-only test
    });
    expectTypeOf(resp).resolves.toEqualTypeOf<{
      resultCode: number;
      result?: string;
    }>();
  });

  it("should allow script param", () => {
    const db = client.database("test_db");

    () => {
      // don't actual run these calls, we're just checking the types

      // optional second param.
      db.runScript("script name");

      // script param can be string, number, or object.
      db.runScript("script name", {
        scriptParam: "param",
      });

      db.runScript("script name", {
        scriptParam: 123,
      });

      db.runScript("script name", {
        scriptParam: { hello: "world" }, // will be stringified in odata request
      });
    };
  });

  it("should throw a type error if script name is invalid string", () => {
    // OData doesn't support script names with special characters (for example, @, &, /) or script names beginning with a number.

    const db = client.database("test_db");

    () => {
      // don't actual run these calls, we're just checking the types

      // these should only fail at runtime, don't enforce these at the type level

      db.runScript("123BadScriptName");
      db.runScript("@BadScriptName");
      db.runScript("/BadScriptName");
      db.runScript("BadScriptName@123");
      db.runScript("BadScriptName/123");
    };
  });

  it("should validate/transform script result if schema provided", () => {
    const db = client.database("test_db");

    () => {
      // don't actual run these calls, we're just checking the types

      const schema = jsonCodec(
        z.object({
          hello: z.string(),
          world: z.number(),
        }),
      );

      const result = db.runScript("script name", {
        resultSchema: schema,
      });

      expectTypeOf(result).resolves.toEqualTypeOf<{
        resultCode: number;
        result: z.infer<typeof schema>;
      }>();
    };
  });
});
