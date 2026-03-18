import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

type ExecFailure = Error & {
  status?: number | null;
  stdout?: string | Buffer;
  stderr?: string | Buffer;
};
const typegenCommandPattern = /\b(?:npm run|pnpm|yarn|bun)\s+typegen\b/;

function toText(value: string | Buffer | undefined) {
  if (typeof value === "string") {
    return value;
  }
  if (!value) {
    return "";
  }
  return value.toString("utf-8");
}

describe("Init Non-Interactive Failure Paths", () => {
  const cliRoot = join(__dirname, "..");
  const testDir = join(__dirname, "..", "..", "tmp", "init-failure-tests");
  const cliPath = join(__dirname, "..", "dist", "index.js");

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  const rebuildCli = () => {
    execFileSync("pnpm", ["build"], {
      cwd: cliRoot,
      env: process.env,
      stdio: "pipe",
    });
  };

  const runInitCommand = (args: string[], cwd = testDir) => {
    const execute = () =>
      execFileSync("node", [cliPath, "init", ...args], {
        cwd,
        env: process.env,
        stdio: "pipe",
        encoding: "utf-8",
      });

    try {
      return execute();
    } catch (error) {
      const failure = error as ExecFailure;
      const output = `${toText(failure.stdout)}\n${toText(failure.stderr)}`;
      if (output.includes("Cannot find module") && output.includes("dist/index.js")) {
        rebuildCli();
        return execute();
      }
      throw error;
    }
  };

  const runInitExpectFailure = (args: string[], cwd = testDir) => {
    try {
      runInitCommand(args, cwd);
      throw new Error(`Expected init to fail, but it succeeded: ${args.join(" ")}`);
    } catch (error) {
      const failure = error as ExecFailure;
      if (typeof failure.status === "number" || failure.status === null) {
        return {
          status: failure.status,
          stdout: toText(failure.stdout),
          stderr: toText(failure.stderr),
        };
      }
      throw error;
    }
  };

  const runInitExpectSuccess = (args: string[], cwd = testDir) => runInitCommand(args, cwd);

  it("fails in non-interactive mode without a project name and does not scaffold", () => {
    writeFileSync(join(testDir, "sentinel.txt"), "keep");

    const result = runInitExpectFailure(["--non-interactive", "--app-type", "webviewer", "--no-install", "--no-git"]);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("Project name is required in non-interactive mode.");
    expect(readdirSync(testDir).sort()).toEqual(["sentinel.txt"]);
  });

  it("fails fast for invalid non-interactive app names and does not create a project directory", () => {
    const projectName = "Bad Name";

    const result = runInitExpectFailure([
      projectName,
      "--non-interactive",
      "--app-type",
      "webviewer",
      "--no-install",
      "--no-git",
    ]);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("Name must consist of only lowercase alphanumeric characters, '-', and '_'");
    expect(existsSync(join(testDir, projectName))).toBe(false);
  });

  it("fails for invalid scoped-path edge cases before mutating the target directory", () => {
    writeFileSync(join(testDir, "README.md"), "existing content");

    const result = runInitExpectFailure([
      "@scope",
      "--non-interactive",
      "--app-type",
      "webviewer",
      "--no-install",
      "--no-git",
    ]);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("Name must consist of only lowercase alphanumeric characters, '-', and '_'");
    expect(readFileSync(join(testDir, "README.md"), "utf-8")).toBe("existing content");
    expect(existsSync(join(testDir, "package.json"))).toBe(false);
    expect(existsSync(join(testDir, "proofkit.json"))).toBe(false);
  });

  it("fails for partial FileMaker schema flags without creating a scaffold", () => {
    const projectName = "partial-filemaker-flags";

    const result = runInitExpectFailure([
      projectName,
      "--non-interactive",
      "--app-type",
      "webviewer",
      "--data-source",
      "filemaker",
      "--layout-name",
      "Contacts",
      "--no-install",
      "--no-git",
    ]);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("Both --layout-name and --schema-name must be provided together.");
    expect(existsSync(join(testDir, projectName))).toBe(false);
  });

  it("fails when FileMaker flags are passed without selecting the filemaker data source", () => {
    const projectName = "unsupported-filemaker-flags";

    const result = runInitExpectFailure([
      projectName,
      "--non-interactive",
      "--app-type",
      "webviewer",
      "--layout-name",
      "Contacts",
      "--schema-name",
      "Contacts",
      "--no-install",
      "--no-git",
    ]);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("FileMaker flags require --data-source filemaker in non-interactive mode.");
    expect(existsSync(join(testDir, projectName))).toBe(false);
  });

  it("preserves existing directory contents when validation fails even with --force", () => {
    const projectName = "force-validation-failure";
    const projectDir = join(testDir, projectName);
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, "README.md"), "existing content");

    const result = runInitExpectFailure([
      projectName,
      "--non-interactive",
      "--app-type",
      "webviewer",
      "--force",
      "--layout-name",
      "Contacts",
      "--schema-name",
      "Contacts",
      "--no-install",
      "--no-git",
    ]);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("FileMaker flags require --data-source filemaker in non-interactive mode.");
    expect(readFileSync(join(projectDir, "README.md"), "utf-8")).toBe("existing content");
    expect(existsSync(join(projectDir, "package.json"))).toBe(false);
    expect(existsSync(join(projectDir, "proofkit.json"))).toBe(false);
  });

  it("does not surface typegen guidance for browser scaffolds without a typegen script", () => {
    const projectName = "browser-no-fm-guidance";
    const output = runInitExpectSuccess([
      projectName,
      "--non-interactive",
      "--app-type",
      "browser",
      "--data-source",
      "none",
      "--no-install",
      "--no-git",
    ]);

    const packageJson = JSON.parse(readFileSync(join(testDir, projectName, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.typegen).toBeUndefined();
    expect(output).not.toMatch(typegenCommandPattern);
  });
});
