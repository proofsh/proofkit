import { Project, ScriptKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import { type BuildSchemaArgs, buildSchema } from "../src/index";

describe("typegen public api", () => {
  it("exports buildSchema from the root entrypoint", () => {
    const project = new Project();
    const schemaFile = project.createSourceFile("customer.ts", "", {
      overwrite: true,
      scriptKind: ScriptKind.TS,
    });

    const args: BuildSchemaArgs = {
      schemaName: "customer",
      schema: [
        { name: "recordId", type: "string" },
        { name: "balance", type: "fmnumber" },
      ],
      type: "ts",
      layoutName: "Customer",
      envNames: {
        server: "FM_SERVER",
        db: "FM_DATABASE",
        auth: {
          apiKey: "OTTO_API_KEY",
          username: undefined,
          password: undefined,
        },
      },
    };

    buildSchema(schemaFile, args);

    const content = schemaFile.getFullText();
    expect(content).toContain("export type Tcustomer");
    expect(content).toContain('"recordId": string');
    expect(content).toContain('"balance": string | number');
    expect(content).toContain('export const layoutName = "Customer"');
  });
});
