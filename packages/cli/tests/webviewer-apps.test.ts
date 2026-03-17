import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { verifyProjectBuilds } from "./test-utils";

const nonInteractiveDirectoryError = /already exists and isn't empty/;

describe("WebViewer CLI Tests", () => {
  const testDir = join(__dirname, "..", "..", "tmp", "cli-tests");
  const cliPath = join(__dirname, "..", "dist", "index.js");
  const projectName = "test-webviewer-project";
  const projectDir = join(testDir, projectName);

  beforeEach(() => {
    if (existsSync(projectDir)) {
      rmSync(projectDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  it("should create a webviewer project without FileMaker server setup", () => {
    const command = [`node "${cliPath}" init`, projectName, "--non-interactive", "--appType webviewer", "--noGit"].join(
      " ",
    );

    expect(() => {
      execSync(command, {
        cwd: testDir,
        env: process.env,
        encoding: "utf-8",
      });
    }).not.toThrow();

    expect(existsSync(projectDir)).toBe(true);
    expect(existsSync(join(projectDir, "package.json"))).toBe(true);
    expect(existsSync(join(projectDir, "proofkit.json"))).toBe(true);
    expect(existsSync(join(projectDir, "proofkit-typegen.config.jsonc"))).toBe(true);

    const packageJson = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8"));
    expect(packageJson.scripts.typegen).toBe("typegen");
    expect(packageJson.scripts["typegen:ui"]).toBe("typegen ui");
    expect(packageJson.devDependencies["@proofkit/typegen"]).toBe("^1.1.0-beta.16");

    const proofkitConfig = JSON.parse(readFileSync(join(projectDir, "proofkit.json"), "utf-8"));
    expect(proofkitConfig.appType).toBe("webviewer");
    expect(proofkitConfig.dataSources).toEqual([]);

    verifyProjectBuilds(projectDir);
  });

  it("should allow agent-only folders in non-interactive mode", () => {
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(join(projectDir, ".cursor"), { recursive: true });
    writeFileSync(join(projectDir, ".cursor", "rules.mdc"), "placeholder");

    const command = [
      `node "${cliPath}" init`,
      projectName,
      "--non-interactive",
      "--appType webviewer",
      "--noGit",
      "--noInstall",
    ].join(" ");

    expect(() => {
      execSync(command, {
        cwd: testDir,
        env: process.env,
        encoding: "utf-8",
      });
    }).not.toThrow();

    expect(existsSync(join(projectDir, "package.json"))).toBe(true);
    expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
    expect(existsSync(join(projectDir, ".cursor", "rules"))).toBe(false);
  });

  it("should allow hidden files in non-interactive mode", () => {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, ".DS_Store"), "placeholder");

    const command = [
      `node "${cliPath}" init`,
      projectName,
      "--non-interactive",
      "--appType webviewer",
      "--noGit",
      "--noInstall",
    ].join(" ");

    expect(() => {
      execSync(command, {
        cwd: testDir,
        env: process.env,
        encoding: "utf-8",
      });
    }).not.toThrow();

    expect(existsSync(join(projectDir, "package.json"))).toBe(true);
    expect(existsSync(join(projectDir, ".DS_Store"))).toBe(true);
  });

  it("should fail without prompting when a non-interactive target directory has real files", () => {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, "README.md"), "existing content");

    const command = [
      `node "${cliPath}" init`,
      projectName,
      "--non-interactive",
      "--appType webviewer",
      "--noGit",
      "--noInstall",
    ].join(" ");

    expect(() => {
      execSync(command, {
        cwd: testDir,
        env: process.env,
        encoding: "utf-8",
        stdio: "pipe",
      });
    }).toThrow(nonInteractiveDirectoryError);

    expect(existsSync(join(projectDir, "package.json"))).toBe(false);
  });
});
