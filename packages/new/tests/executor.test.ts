import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { executeInitPlan } from "~/core/executeInitPlan.js";
import { planInit } from "~/core/planInit.js";
import { makeTestLayer } from "./test-layer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      {
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
        hasExplicitFileMakerInputs: true,
        fileMaker: {
          server: "https://example.com",
          fileName: "Contacts.fmp12",
          dataApiKey: "dk_123",
          layoutName: "API_Contacts",
          schemaName: "Contacts",
        },
      },
      {
        templateDir: path.resolve(__dirname, "../../cli/template/vite-wv"),
      },
    );

    await Effect.runPromise(executeInitPlan(plan).pipe(makeTestLayer({ cwd, packageManager: "pnpm", tracker })));

    expect(tracker.commands).toEqual(["pnpm install"]);
    expect(tracker.filemakerBootstraps).toBe(1);
    expect(tracker.codegens).toBe(1);
    expect(tracker.gitInits).toBe(1);

    const settings = await fs.readJson(path.join(cwd, "fm-app", "proofkit.json"));
    const envFile = await fs.readFile(path.join(cwd, "fm-app", ".env"), "utf8");
    expect(settings.dataSources).toHaveLength(1);
    expect(envFile).toContain("FM_DATABASE=Contacts.fmp12");
  });

  it("supports force overwrite for an existing directory", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-force-"));
    const projectDir = path.join(cwd, "force-app");
    await fs.ensureDir(projectDir);
    await fs.writeFile(path.join(projectDir, "README.md"), "old content");

    const plan = planInit(
      {
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
        hasExplicitFileMakerInputs: false,
      },
      {
        templateDir: path.resolve(__dirname, "../../cli/template/nextjs-shadcn"),
      },
    );

    await Effect.runPromise(executeInitPlan(plan).pipe(makeTestLayer({ cwd, packageManager: "pnpm" })));

    expect(await fs.pathExists(path.join(projectDir, "README.md"))).toBe(true);
    expect(await fs.readFile(path.join(projectDir, "README.md"), "utf8")).not.toBe("old content");
  });
});
