import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { executeInitPlan } from "~/core/executeInitPlan.js";
import { planInit } from "~/core/planInit.js";
import { detectUserPackageManager } from "~/utils/packageManager.js";
import { makeTestLayer } from "./test-layer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("integration scaffold generation", () => {
  it("creates a browser scaffold with proofkit.json and env", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-browser-"));
    const projectDir = path.join(cwd, "browser-app");
    const layer = makeTestLayer({
      cwd,
      packageManager: detectUserPackageManager(),
    });

    const plan = planInit(
      {
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
        hasExplicitFileMakerInputs: false,
      },
      {
        templateDir: path.resolve(__dirname, "../../cli/template/nextjs-shadcn"),
        packageManagerVersion: "10.27.0",
      },
    );

    await Effect.runPromise(layer(executeInitPlan(plan)));

    expect(await fs.pathExists(projectDir)).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, "package.json"))).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, "proofkit.json"))).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, ".env"))).toBe(true);

    const packageJson = await fs.readJson(path.join(projectDir, "package.json"));
    const settings = await fs.readJson(path.join(projectDir, "proofkit.json"));

    expect(packageJson.name).toBe("browser-app");
    expect(packageJson.packageManager).toBe("pnpm@10.27.0");
    expect(settings).toMatchObject({
      appType: "browser",
      dataSources: [],
      envFile: ".env",
    });
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
      {
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
        hasExplicitFileMakerInputs: false,
      },
      {
        templateDir: path.resolve(__dirname, "../../cli/template/vite-wv"),
      },
    );

    const secondPlan = planInit(
      {
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
        hasExplicitFileMakerInputs: false,
      },
      {
        templateDir: path.resolve(__dirname, "../../cli/template/nextjs-shadcn"),
      },
    );

    await Effect.runPromise(layer(executeInitPlan(firstPlan)));
    await Effect.runPromise(layer(executeInitPlan(secondPlan)));

    const firstSettings = await fs.readJson(path.join(firstDir, "proofkit.json"));
    const secondSettings = await fs.readJson(path.join(secondDir, "proofkit.json"));
    expect(firstSettings.appType).toBe("webviewer");
    expect(secondSettings.appType).toBe("browser");
  });
});
