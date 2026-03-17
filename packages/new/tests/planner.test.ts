import { describe, expect, it } from "vitest";
import { planInit } from "~/core/planInit.js";
import { makeInitRequest } from "./init-fixtures.js";

describe("planInit", () => {
  it("plans a browser scaffold", () => {
    const plan = planInit(makeInitRequest(), {
      templateDir: "/templates/browser",
      packageManagerVersion: "10.0.0",
    });

    expect(plan.targetDir).toBe("/tmp/workspace/demo-app");
    expect(plan.templateDir).toBe("/templates/browser");
    expect(plan.packageJson.name).toBe("demo-app");
    expect(plan.settings.appType).toBe("browser");
    expect(plan.tasks.runInstall).toBe(true);
    expect(plan.tasks.initializeGit).toBe(true);
    expect(plan.tasks.bootstrapFileMaker).toBe(false);
  });

  it("plans a webviewer scaffold with no install and no git", () => {
    const plan = planInit(
      makeInitRequest({
        appType: "webviewer",
        dataSource: "none",
        noInstall: true,
        noGit: true,
      }),
      {
        templateDir: "/templates/webviewer",
      },
    );

    expect(plan.packageJson.dependencies["@proofkit/webviewer"]).toBe("beta");
    expect(plan.packageJson.devDependencies["@proofkit/typegen"]).toBe("beta");
    expect(plan.tasks.runInstall).toBe(false);
    expect(plan.tasks.initializeGit).toBe(false);
  });

  it("plans filemaker bootstrap and initial codegen when inputs are explicit", () => {
    const plan = planInit(
      makeInitRequest({
        appType: "webviewer",
        dataSource: "filemaker",
        hasExplicitFileMakerInputs: true,
        fileMaker: {
          mode: "hosted-otto",
          dataSourceName: "filemaker",
          envNames: {
            database: "FM_DATABASE",
            server: "FM_SERVER",
            apiKey: "OTTO_API_KEY",
          },
          server: "https://example.com",
          fileName: "Contacts.fmp12",
          dataApiKey: "dk_123",
          layoutName: "API_Contacts",
          schemaName: "Contacts",
        },
      }),
      {
        templateDir: "/templates/webviewer",
      },
    );

    expect(plan.tasks.bootstrapFileMaker).toBe(true);
    expect(plan.tasks.runInitialCodegen).toBe(true);
  });

  it("skips initial codegen for non-interactive webviewer runs without explicit inputs", () => {
    const plan = planInit(
      makeInitRequest({
        appType: "webviewer",
        dataSource: "filemaker",
      }),
      {
        templateDir: "/templates/webviewer",
      },
    );

    expect(plan.tasks.bootstrapFileMaker).toBe(true);
    expect(plan.tasks.runInitialCodegen).toBe(false);
  });
});
