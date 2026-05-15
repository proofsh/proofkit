import path from "node:path";
import { describe, expect, it } from "vitest";
import { NODE_RUNTIME_VERSION } from "~/consts.js";
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
const pnpm11WarningPattern = /pnpm.*11/i;

describe("planInit", () => {
  it("plans a browser scaffold", () => {
    const plan = planInit(makeInitRequest(), {
      templateDir: "/templates/browser",
      packageManagerVersion: "11.0.0",
    });

    expect(plan.targetDir).toBe(path.resolve("/tmp/workspace", "demo-app"));
    expect(plan.templateDir).toBe("/templates/browser");
    expect(plan.packageJson.name).toBe("demo-app");
    expect(plan.packageJson.devEngines?.packageManager).toEqual({
      name: "pnpm",
      version: "11.0.0",
      onFail: "download",
    });
    expect(plan.packageJson.devEngines?.runtime).toEqual({
      name: "node",
      version: NODE_RUNTIME_VERSION,
      onFail: "download",
    });
    expect(plan.packageJson.engines).toEqual({
      node: NODE_RUNTIME_VERSION,
    });
    expect(plan.settings.appType).toBe("browser");
    expect(plan.packageJson.devDependencies["@proofkit/cli"]).toBe(proofkitCliVersion);
    expect(plan.packageJson.devDependencies["@proofkit/typegen"]).toBe(proofkitTypegenVersion);
    expect(plan.tasks.runInstall).toBe(true);
    expect(plan.tasks.runUltraciteInit).toBe(true);
    expect(plan.tasks.runIntentInstall).toBe(true);
    expect(plan.tasks.runFix).toBe(true);
    expect(plan.tasks.runLint).toBe(true);
    expect(plan.tasks.initializeGit).toBe(true);
    expect(plan.tasks.bootstrapFileMaker).toBe(false);
    expect(plan.tasks.checkWebViewerAddon).toBe(false);
    expect(plan.writes).toContainEqual({
      path: path.resolve("/tmp/workspace", "demo-app", "pnpm-workspace.yaml"),
      content: [
        "# This setting defines where in the repo your apps/packages that need installed dependancies exist. This of this as a list of paths to your package.json files. ",
        "packages:",
        '  - "."',
        "",
        "allowBuilds:",
        '  "@parcel/watcher": true',
        '  "esbuild": true',
        '  "msgpackr-extract": true',
        '  "msw": true',
        '  "sharp": true',
        "",
        "trustPolicy: no-downgrade",
        "",
        "trustPolicyIgnoreAfter: 43200",
        "",
        "blockExoticSubdeps: true",
        "",
      ].join("\n"),
    });
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
    expect(plan.tasks.runUltraciteInit).toBe(true);
    expect(plan.tasks.runIntentInstall).toBe(true);
    expect(plan.tasks.runFix).toBe(false);
    expect(plan.tasks.runLint).toBe(false);
    expect(plan.tasks.initializeGit).toBe(false);
    expect(plan.tasks.checkWebViewerAddon).toBe(true);
    expect(plan.writes).toContainEqual({
      path: path.resolve("/tmp/workspace", "demo-app", "pnpm-workspace.yaml"),
      content: [
        "# This setting defines where in the repo your apps/packages that need installed dependancies exist. This of this as a list of paths to your package.json files. ",
        "packages:",
        '  - "."',
        "",
        "allowBuilds:",
        '  "@parcel/watcher": true',
        '  "esbuild": true',
        '  "msgpackr-extract": true',
        '  "msw": true',
        '  "sharp": false',
        "",
        "trustPolicy: no-downgrade",
        "",
        "trustPolicyIgnoreAfter: 43200",
        "",
        "blockExoticSubdeps: true",
        "",
      ].join("\n"),
    });
  });

  it("adds pnpm build approvals for pnpm 10", () => {
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

    expect(plan.writes).toContainEqual(
      expect.objectContaining({
        path: path.resolve("/tmp/workspace", "demo-app", "pnpm-workspace.yaml"),
        content: expect.stringContaining('  "sharp": false'),
      }),
    );
  });

  it("warns npm users to use pnpm 11 or greater", () => {
    const plan = planInit(
      makeInitRequest({
        packageManager: "npm",
      }),
      {
        templateDir: "/templates/browser",
        packageManagerVersion: "10.0.0",
      },
    );

    expect(plan.nextSteps).toEqual(expect.arrayContaining([expect.stringMatching(pnpm11WarningPattern)]));
  });

  it("writes npm minimum release age config for npm scaffolds", () => {
    const plan = planInit(
      makeInitRequest({
        packageManager: "npm",
      }),
      {
        templateDir: "/templates/browser",
        packageManagerVersion: "11.10.0",
      },
    );

    expect(plan.writes).toContainEqual({
      path: path.resolve("/tmp/workspace", "demo-app", ".npmrc"),
      content: [
        "# Require npm package releases to be at least 24 hours old before install.",
        "min-release-age=1",
        "",
      ].join("\n"),
    });
  });

  it("uses package manager execute command for agent setup next step", () => {
    const cases = [
      ["npm", "npx @tanstack/intent@latest install"],
      ["pnpm", "pnpx @tanstack/intent@latest install"],
      ["yarn", "yarn dlx @tanstack/intent@latest install"],
      ["bun", "bunx @tanstack/intent@latest install"],
    ] as const;

    for (const [packageManager, nextStep] of cases) {
      const plan = planInit(makeInitRequest({ packageManager }), {
        templateDir: "/templates/browser",
      });

      expect(plan.nextSteps).toContain(nextStep);
    }
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
