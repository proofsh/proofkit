import path from "node:path";
import { describe, expect, it } from "vitest";
import { planInit } from "~/core/planInit.js";
import {
  getFmdapiVersion,
  getProofkitDependencyVersion,
  getProofkitWebviewerVersion,
  getTypegenVersion,
  getVersion,
} from "~/utils/getProofKitVersion.js";
import { makeInitRequest } from "./init-fixtures.js";

const proofkitCliVersion = getProofkitDependencyVersion(getVersion());
const proofkitFmdapiVersion = getProofkitDependencyVersion(getFmdapiVersion());
const proofkitTypegenVersion = getProofkitDependencyVersion(getTypegenVersion());
const proofkitWebviewerVersion = getProofkitDependencyVersion(getProofkitWebviewerVersion());

describe("planInit", () => {
  it("plans a browser scaffold", () => {
    const plan = planInit(makeInitRequest(), {
      templateDir: "/templates/browser",
      packageManagerVersion: "10.0.0",
    });

    expect(plan.targetDir).toBe(path.resolve("/tmp/workspace", "demo-app"));
    expect(plan.templateDir).toBe("/templates/browser");
    expect(plan.packageJson.name).toBe("demo-app");
    expect(plan.settings.appType).toBe("browser");
    expect(plan.packageJson.devDependencies["@proofkit/cli"]).toBe(proofkitCliVersion);
    expect(plan.packageJson.devDependencies["@proofkit/typegen"]).toBe(proofkitTypegenVersion);
    expect(plan.tasks.runInstall).toBe(true);
    expect(plan.tasks.initializeGit).toBe(true);
    expect(plan.tasks.bootstrapFileMaker).toBe(false);
    expect(plan.tasks.checkWebViewerAddon).toBe(false);
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
        packageManagerVersion: "11.0.0",
      },
    );

    expect(plan.packageJson.dependencies["@proofkit/webviewer"]).toBe(proofkitWebviewerVersion);
    expect(plan.packageJson.devDependencies["@proofkit/typegen"]).toBe(proofkitTypegenVersion);
    expect(plan.tasks.runInstall).toBe(false);
    expect(plan.tasks.initializeGit).toBe(false);
    expect(plan.tasks.checkWebViewerAddon).toBe(true);
    expect(plan.writes).toContainEqual({
      path: path.resolve("/tmp/workspace", "demo-app", "pnpm-workspace.yaml"),
      content: [
        "allowBuilds:",
        '  "@parcel/watcher": false',
        '  "esbuild": true',
        '  "msgpackr-extract": false',
        '  "msw": false',
        "",
      ].join("\n"),
    });
  });

  it("does not add pnpm build approvals for pnpm 10", () => {
    const plan = planInit(
      makeInitRequest({
        appType: "webviewer",
        dataSource: "none",
      }),
      {
        templateDir: "/templates/webviewer",
        packageManagerVersion: "10.27.0",
      },
    );

    expect(plan.writes.some((write) => write.path.endsWith("pnpm-workspace.yaml"))).toBe(false);
  });

  it("adds fmdapi for browser filemaker scaffolds", () => {
    const plan = planInit(
      makeInitRequest({
        appType: "browser",
        dataSource: "filemaker",
      }),
      {
        templateDir: "/templates/browser",
      },
    );

    expect(plan.packageJson.dependencies["@proofkit/fmdapi"]).toBe(proofkitFmdapiVersion);
    expect(plan.packageJson.dependencies.zod).toBe("^4");
    expect(plan.packageJson.devDependencies["@proofkit/typegen"]).toBe(proofkitTypegenVersion);
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

  it("skips initial codegen when install is disabled", () => {
    const plan = planInit(
      makeInitRequest({
        appType: "browser",
        dataSource: "filemaker",
        noInstall: true,
        hasExplicitFileMakerInputs: true,
      }),
      {
        templateDir: "/templates/browser",
      },
    );

    expect(plan.tasks.bootstrapFileMaker).toBe(true);
    expect(plan.tasks.runInstall).toBe(false);
    expect(plan.tasks.runInitialCodegen).toBe(false);
    expect(plan.commands.some((command) => command.type === "codegen")).toBe(false);
  });
});
