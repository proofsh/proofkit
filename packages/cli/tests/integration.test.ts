import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { executeInitPlan } from "~/core/executeInitPlan.js";
import { planInit } from "~/core/planInit.js";
import { detectUserPackageManager } from "~/utils/packageManager.js";
import { getSharedTemplateDir, makeInitRequest, readScaffoldArtifacts } from "./init-fixtures.js";
import { makeTestLayer } from "./test-layer.js";

describe("integration scaffold generation", () => {
  it("creates a browser scaffold with proofkit.json and env", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-browser-"));
    const projectDir = path.join(cwd, "browser-app");
    const consoleTranscript = {
      info: [] as string[],
      warn: [] as string[],
      error: [] as string[],
      success: [] as string[],
      note: [] as Array<{ message: string; title?: string }>,
    };
    const layer = makeTestLayer({
      cwd,
      packageManager: detectUserPackageManager(),
      console: consoleTranscript,
    });

    const plan = planInit(
      makeInitRequest({
        projectName: "browser-app",
        scopedAppName: "browser-app",
        appDir: "browser-app",
        appType: "browser",
        ui: "shadcn",
        dataSource: "none",
        packageManager: "pnpm",
        noInstall: true,
        noGit: true,
        force: false,
        cwd,
        importAlias: "~/",
        nonInteractive: true,
        debug: false,
        skipFileMakerSetup: false,
        hasExplicitFileMakerInputs: false,
      }),
      {
        templateDir: getSharedTemplateDir("nextjs-shadcn"),
        packageManagerVersion: "10.27.0",
      },
    );

    await Effect.runPromise(layer(executeInitPlan(plan)));

    expect(await fs.pathExists(projectDir)).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, "package.json"))).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, "proofkit.json"))).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, ".env"))).toBe(true);

    const { packageJson, proofkitJson, envFile } = await readScaffoldArtifacts(projectDir);

    expect(packageJson.name).toBe("browser-app");
    expect(packageJson.packageManager).toBe("pnpm@10.27.0");
    expect(packageJson.proofkitMetadata).toMatchObject({
      scaffoldPackage: "@proofkit/cli",
    });
    expect(packageJson.devDependencies["@proofkit/cli"]).toBe("beta");
    expect(typeof packageJson.proofkitMetadata?.initVersion).toBe("string");
    expect(packageJson.proofkitMetadata?.initVersion).not.toBe("");
    expect(proofkitJson).toMatchObject({
      appType: "browser",
      dataSources: [],
      envFile: ".env",
    });
    expect(envFile).toContain("# When adding additional environment variables");
    expect(consoleTranscript.success.at(-1) ?? "").toContain("Created browser-app");
  });

  it("creates a webviewer scaffold without leaking state across runs", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-webviewer-"));
    const firstDir = path.join(cwd, "first");
    const secondDir = path.join(cwd, "second");
    const layer = makeTestLayer({
      cwd,
      packageManager: "pnpm",
    });

    const firstPlan = planInit(
      makeInitRequest({
        projectName: "first",
        scopedAppName: "first",
        appDir: "first",
        appType: "webviewer",
        ui: "shadcn",
        dataSource: "none",
        packageManager: "pnpm",
        noInstall: true,
        noGit: true,
        force: false,
        cwd,
        importAlias: "~/",
        nonInteractive: true,
        debug: false,
        skipFileMakerSetup: false,
        hasExplicitFileMakerInputs: false,
      }),
      {
        templateDir: getSharedTemplateDir("vite-wv"),
      },
    );

    const secondPlan = planInit(
      makeInitRequest({
        projectName: "second",
        scopedAppName: "second",
        appDir: "second",
        appType: "browser",
        ui: "shadcn",
        dataSource: "none",
        packageManager: "pnpm",
        noInstall: true,
        noGit: true,
        force: false,
        cwd,
        importAlias: "~/",
        nonInteractive: true,
        debug: false,
        skipFileMakerSetup: false,
        hasExplicitFileMakerInputs: false,
      }),
      {
        templateDir: getSharedTemplateDir("nextjs-shadcn"),
      },
    );

    await Effect.runPromise(layer(executeInitPlan(firstPlan)));
    await Effect.runPromise(layer(executeInitPlan(secondPlan)));

    const firstSettings = await fs.readJson(path.join(firstDir, "proofkit.json"));
    const secondSettings = await fs.readJson(path.join(secondDir, "proofkit.json"));
    expect(firstSettings.appType).toBe("webviewer");
    expect(secondSettings.appType).toBe("browser");
  });

  it("creates a webviewer scaffold with ultracite, tanstack wiring, and agent files", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-webviewer-template-"));
    const projectDir = path.join(cwd, "webviewer-app");
    const consoleTranscript = {
      info: [] as string[],
      warn: [] as string[],
      error: [] as string[],
      success: [] as string[],
      note: [] as Array<{ message: string; title?: string }>,
    };
    const layer = makeTestLayer({
      cwd,
      packageManager: "pnpm",
      console: consoleTranscript,
    });

    const plan = planInit(
      makeInitRequest({
        projectName: "webviewer-app",
        scopedAppName: "webviewer-app",
        appDir: "webviewer-app",
        appType: "webviewer",
        ui: "shadcn",
        dataSource: "none",
        packageManager: "pnpm",
        noInstall: true,
        noGit: true,
        force: false,
        cwd,
        importAlias: "~/",
        nonInteractive: true,
        debug: false,
        skipFileMakerSetup: false,
        hasExplicitFileMakerInputs: false,
      }),
      {
        templateDir: getSharedTemplateDir("vite-wv"),
      },
    );

    await Effect.runPromise(layer(executeInitPlan(plan)));

    const { packageJson, agentsFile, claudeFile, launchConfig } = await readScaffoldArtifacts(projectDir);
    const routerFile = await fs.readFile(path.join(projectDir, "src/router.tsx"), "utf8");
    const mainFile = await fs.readFile(path.join(projectDir, "src/main.tsx"), "utf8");
    const queryDemoFile = await fs.readFile(path.join(projectDir, "src/routes/query-demo.tsx"), "utf8");

    expect(packageJson.scripts.lint).toBe("ultracite check .");
    expect(packageJson.scripts.format).toBe("ultracite fix .");
    expect(packageJson.dependencies["@tanstack/react-query"]).toBe("^5.90.21");
    expect(packageJson.dependencies["@tanstack/react-router"]).toBe("^1.167.4");
    expect(packageJson.devDependencies.ultracite).toBe("7.0.8");
    expect(agentsFile).toContain("Use the ProofKit docs as the primary reference");
    expect(agentsFile).toContain("npx @tanstack/intent@latest install");
    expect(claudeFile?.trim()).toBe("AGENTS.md");
    expect(launchConfig).toContain('"runtimeExecutable": "pnpm"');
    expect(routerFile).toContain("createHashHistory");
    expect(mainFile).toContain("QueryClientProvider");
    expect(queryDemoFile).toContain("TanStack Query is preconfigured");
    const nextStepsMessage = consoleTranscript.info.at(-1) ?? "";
    expect(nextStepsMessage).toContain("Have your agent run this in the new project");
    expect(nextStepsMessage).toContain("complete the interactive prompt");
    expect(nextStepsMessage).toContain("\u001B[");
  });

  it("creates filemaker env and typegen config when explicit hosted inputs are provided", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-filemaker-"));
    const layer = makeTestLayer({
      cwd,
      packageManager: "pnpm",
    });

    const plan = planInit(
      makeInitRequest({
        projectName: "filemaker-app",
        scopedAppName: "filemaker-app",
        appDir: "filemaker-app",
        appType: "browser",
        ui: "shadcn",
        dataSource: "filemaker",
        packageManager: "pnpm",
        noInstall: true,
        noGit: true,
        force: false,
        cwd,
        importAlias: "~/",
        nonInteractive: true,
        debug: false,
        skipFileMakerSetup: false,
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
        templateDir: getSharedTemplateDir("nextjs-shadcn"),
      },
    );

    await Effect.runPromise(layer(executeInitPlan(plan)));

    const projectDir = path.join(cwd, "filemaker-app");
    const { proofkitJson, envFile, typegenConfig } = await readScaffoldArtifacts(projectDir);

    expect(proofkitJson.dataSources).toEqual([
      {
        type: "fm",
        name: "filemaker",
        envNames: {
          database: "FM_DATABASE",
          server: "FM_SERVER",
          apiKey: "OTTO_API_KEY",
        },
      },
    ]);
    expect(envFile).toContain("FM_DATABASE=Contacts.fmp12");
    expect(envFile).toContain("FM_SERVER=https://example.com");
    expect(envFile).toContain("OTTO_API_KEY=dk_123");
    expect(typegenConfig).toContain("API_Contacts");
    expect(typegenConfig).toContain("Contacts");
  });
});
