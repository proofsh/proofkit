import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { FileMakerOData } from "../src/index";

describe("fmodata", () => {
  it("should be defined", () => {
    expect(true).toBe(true);
  });

  it("should setup server instance", () => {
    const server = new FileMakerOData({
      serverUrl: "https://api.proofkit.dev",
      auth: {
        username: "test",
        password: "test",
      },
    });

    const db = server.database("Contacts");

    const table = db.table("Contacts", {
      schema: z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
        phone: z.string(),
        address: z.string(),
        city: z.string(),
        state: z.string(),
      }),
    });

    table.get("", { getSingleField: "address" });
    table.query().select("email", "address", "ROWID", "ROWMODID").execute();
  });
});
