import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { DirectoryConflictError, ExternalCommandError, UserCancelledError } from "~/core/errors.js";
import { executeInitPlan } from "~/core/executeInitPlan.js";
import { planInit } from "~/core/planInit.js";
import { getFailure } from "./effect-test-utils.js";
import { getSharedTemplateDir, makeInitRequest, readScaffoldArtifacts } from "./init-fixtures.js";
import { makeTestLayer } from "./test-layer.js";

describe("executeInitPlan command paths", () => {
  it("runs install, git, codegen, and filemaker bootstrap through services", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-exec-"));
    const tracker = {
      commands: [] as string[],
      gitInits: 0,
      codegens: 0,
      filemakerBootstraps: 0,
    };

    const plan = planInit(
      makeInitRequest({
        projectName: "fm-app",
        scopedAppName: "fm-app",
        appDir: "fm-app",
        appType: "webviewer",
        ui: "shadcn",
        dataSource: "filemaker",
        packageManager: "pnpm",
        noInstall: false,
        noGit: false,
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
        templateDir: getSharedTemplateDir("vite-wv"),
        packageManagerVersion: "11.0.0",
      },
    );

    await Effect.runPromise(executeInitPlan(plan).pipe(makeTestLayer({ cwd, packageManager: "pnpm", tracker })));

    expect(tracker.commands).toEqual(["pnpm self-update 11", "pnpm install"]);
    expect(tracker.filemakerBootstraps).toBe(1);
    expect(tracker.codegens).toBe(1);
    expect(tracker.gitInits).toBe(1);

    const { proofkitJson, envFile, typegenConfig, pnpmWorkspaceFile } = await readScaffoldArtifacts(
      path.join(cwd, "fm-app"),
    );
    expect(proofkitJson.dataSources).toHaveLength(1);
    expect(envFile).toContain("FM_DATABASE=Contacts.fmp12");
    expect(typegenConfig).toContain("API_Contacts");
    expect(typegenConfig).toContain("Contacts");
    expect(pnpmWorkspaceFile).toContain("trustPolicy: no-downgrade");
    expect(pnpmWorkspaceFile).toContain("trustPolicyIgnoreAfter: 43200");
    expect(pnpmWorkspaceFile).toContain("blockExoticSubdeps: true");
  });

  it("supports force overwrite for an existing directory", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-force-"));
    const projectDir = path.join(cwd, "force-app");
    await fs.ensureDir(projectDir);
    await fs.writeFile(path.join(projectDir, "README.md"), "old content");

    const plan = planInit(
      makeInitRequest({
        projectName: "force-app",
        scopedAppName: "force-app",
        appDir: "force-app",
        appType: "browser",
        ui: "shadcn",
        dataSource: "none",
        packageManager: "pnpm",
        noInstall: true,
        noGit: true,
        force: true,
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

    await Effect.runPromise(executeInitPlan(plan).pipe(makeTestLayer({ cwd, packageManager: "pnpm" })));

    expect(await fs.pathExists(path.join(projectDir, "README.md"))).toBe(true);
    expect(await fs.readFile(path.join(projectDir, "README.md"), "utf8")).not.toBe("old content");
  });

  it("persists selected local MCP file into typegen config", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-local-mcp-explicit-"));

    const plan = planInit(
      makeInitRequest({
        projectName: "local-mcp-app",
        scopedAppName: "local-mcp-app",
        appDir: "local-mcp-app",
        appType: "webviewer",
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
          mode: "local-fm-mcp",
          dataSourceName: "filemaker",
          envNames: {
            database: "FM_DATABASE",
            server: "FM_SERVER",
            apiKey: "OTTO_API_KEY",
          },
          fmMcpBaseUrl: "http://127.0.0.1:1365",
          fileName: "Selected.fmp12",
        },
      }),
      {
        templateDir: getSharedTemplateDir("vite-wv"),
      },
    );

    await Effect.runPromise(executeInitPlan(plan).pipe(makeTestLayer({ cwd, packageManager: "pnpm" })));

    const { typegenConfig } = await readScaffoldArtifacts(path.join(cwd, "local-mcp-app"));
    expect(typegenConfig).toContain('"connectedFileName": "Selected.fmp12"');
  });

  it("persists the single auto-selected local MCP file into typegen config", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-local-mcp-single-"));

    const plan = planInit(
      makeInitRequest({
        projectName: "single-local-mcp-app",
        scopedAppName: "single-local-mcp-app",
        appDir: "single-local-mcp-app",
        appType: "webviewer",
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
        hasExplicitFileMakerInputs: false,
        fileMaker: {
          mode: "local-fm-mcp",
          dataSourceName: "filemaker",
          envNames: {
            database: "FM_DATABASE",
            server: "FM_SERVER",
            apiKey: "OTTO_API_KEY",
          },
          fmMcpBaseUrl: "http://127.0.0.1:1365",
          fileName: "OnlyOpen.fmp12",
        },
      }),
      {
        templateDir: getSharedTemplateDir("vite-wv"),
      },
    );

    await Effect.runPromise(executeInitPlan(plan).pipe(makeTestLayer({ cwd, packageManager: "pnpm" })));

    const { typegenConfig } = await readScaffoldArtifacts(path.join(cwd, "single-local-mcp-app"));
    expect(typegenConfig).toContain('"connectedFileName": "OnlyOpen.fmp12"');
  });

  it("persists detected local MCP file into typegen config when webviewer setup skips filemaker bootstrap", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-local-mcp-skip-bootstrap-"));

    const plan = planInit(
      makeInitRequest({
        projectName: "skip-bootstrap-local-mcp-app",
        scopedAppName: "skip-bootstrap-local-mcp-app",
        appDir: "skip-bootstrap-local-mcp-app",
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

    await Effect.runPromise(
      executeInitPlan(plan).pipe(
        makeTestLayer({
          cwd,
          packageManager: "pnpm",
          fileMaker: {
            localFmMcp: {
              healthy: true,
              baseUrl: "http://127.0.0.1:1365",
              connectedFiles: ["Autodetected.fmp12"],
            },
          },
        }),
      ),
    );

    const { typegenConfig } = await readScaffoldArtifacts(path.join(cwd, "skip-bootstrap-local-mcp-app"));
    expect(typegenConfig).toContain('"connectedFileName": "Autodetected.fmp12"');
  });

  it("fails with a typed directory conflict in non-interactive mode", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-conflict-"));
    const projectDir = path.join(cwd, "conflict-app");
    await fs.ensureDir(projectDir);
    await fs.writeFile(path.join(projectDir, "README.md"), "existing");

    const plan = planInit(
      makeInitRequest({
        projectName: "conflict-app",
        scopedAppName: "conflict-app",
        appDir: "conflict-app",
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

    expect(await getFailure(executeInitPlan(plan).pipe(makeTestLayer({ cwd, packageManager: "pnpm" })))).toMatchObject(
      new DirectoryConflictError({
        message:
          "conflict-app already exists and isn't empty. Remove the existing files or choose a different directory.",
        path: projectDir,
      }),
    );
  });

  it("fails with a typed cancelation error when overwrite is aborted", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-abort-"));
    const projectDir = path.join(cwd, "abort-app");
    await fs.ensureDir(projectDir);
    await fs.writeFile(path.join(projectDir, "README.md"), "existing");

    const plan = planInit(
      makeInitRequest({
        projectName: "abort-app",
        scopedAppName: "abort-app",
        appDir: "abort-app",
        appType: "browser",
        ui: "shadcn",
        dataSource: "none",
        packageManager: "pnpm",
        noInstall: true,
        noGit: true,
        force: false,
        cwd,
        importAlias: "~/",
        nonInteractive: false,
        debug: false,
        skipFileMakerSetup: false,
        hasExplicitFileMakerInputs: false,
      }),
      {
        templateDir: getSharedTemplateDir("nextjs-shadcn"),
      },
    );

    expect(
      await getFailure(
        executeInitPlan(plan).pipe(
          makeTestLayer({
            cwd,
            packageManager: "pnpm",
            nonInteractive: false,
            prompts: {
              select: ["abort"],
            },
          }),
        ),
      ),
    ).toMatchObject(
      new UserCancelledError({
        message: "User aborted the operation",
      }),
    );
  });

  it("prints pnpm warning in npm next steps", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-npm-warning-"));
    const console = {
      info: [] as string[],
      warn: [] as string[],
      error: [] as string[],
      success: [] as string[],
      note: [] as Array<{ message: string; title?: string }>,
    };
    const plan = planInit(
      makeInitRequest({
        projectName: "npm-app",
        scopedAppName: "npm-app",
        appDir: "npm-app",
        packageManager: "npm",
        noInstall: true,
        noGit: true,
        cwd,
      }),
      {
        templateDir: getSharedTemplateDir("nextjs-shadcn"),
        packageManagerVersion: "10.0.0",
      },
    );

    await Effect.runPromise(executeInitPlan(plan).pipe(makeTestLayer({ cwd, packageManager: "npm", console })));

    expect(console.info.join("\n")).toContain(
      "Warning: We strongly suggest using PNPM 11 or greater as your package manager to better protect your computer and your app.",
    );
  });

  it("fails with a typed external command error when install fails", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-install-fail-"));
    const plan = planInit(
      makeInitRequest({
        projectName: "install-fail",
        scopedAppName: "install-fail",
        appDir: "install-fail",
        appType: "browser",
        ui: "shadcn",
        dataSource: "none",
        packageManager: "npm",
        noInstall: false,
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

    expect(
      await getFailure(
        executeInitPlan(plan).pipe(
          makeTestLayer({
            cwd,
            packageManager: "npm",
            failures: {
              processRun: new ExternalCommandError({
                message: "install failed",
                command: "npm",
                args: ["install"],
                cwd,
              }),
            },
          }),
        ),
      ),
    ).toMatchObject(
      new ExternalCommandError({
        message: "install failed",
        command: "npm",
        args: ["install"],
        cwd,
      }),
    );
  });

  it("fails with a typed codegen error when initial codegen fails", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-codegen-fail-"));
    const plan = planInit(
      makeInitRequest({
        projectName: "codegen-fail",
        scopedAppName: "codegen-fail",
        appDir: "codegen-fail",
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
    plan.tasks.runInitialCodegen = true;

    expect(
      await getFailure(
        executeInitPlan(plan).pipe(
          makeTestLayer({
            cwd,
            packageManager: "pnpm",
            failures: {
              codegenRun: new ExternalCommandError({
                message: "Initial codegen failed",
                command: "pnpm",
                args: ["typegen"],
                cwd: path.join(cwd, "codegen-fail"),
              }),
            },
          }),
        ),
      ),
    ).toMatchObject(
      new ExternalCommandError({
        message: "Initial codegen failed",
        command: "pnpm",
        args: ["typegen"],
        cwd: path.join(cwd, "codegen-fail"),
      }),
    );
  });
});
