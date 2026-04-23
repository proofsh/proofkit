import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";

import { verifySmokeProjectBuilds } from "./test-utils.js";

const smokeEnvSchema = z.object({
  OTTO_SERVER_URL: z.url(),
  OTTO_ADMIN_API_KEY: z.string().min(1),
  FM_DATA_API_KEY: z.string().min(1),
  FM_FILE_NAME: z.string().min(1),
});

const parsedSmokeEnv = smokeEnvSchema.safeParse(process.env);
const describeWhenSmokeEnvPresent = parsedSmokeEnv.success ? describe : describe.skip;

if (!parsedSmokeEnv.success) {
  const missingKeys = [...new Set(parsedSmokeEnv.error.issues.map((issue) => issue.path.join(".")))];
  console.warn(`Skipping external integration smoke tests; missing required env vars: ${missingKeys.join(", ")}`);
}

describeWhenSmokeEnvPresent("External integration smoke tests (non-interactive CLI)", () => {
  if (!parsedSmokeEnv.success) {
    return;
  }

  const testDir = join(tmpdir(), "proofkit-cli-tests");
  const cliPath = join(__dirname, "..", "dist", "index.js");
  const projectName = "test-fm-project";
  const projectDir = join(testDir, projectName);

  // Required for live Otto/FileMaker integration smoke coverage.
  const testEnv = parsedSmokeEnv.data;

  beforeEach(
    () => {
      // Clean up any stale test project from previous runs
      if (existsSync(projectDir)) {
        rmSync(projectDir, { recursive: true, force: true });
      }
      // Ensure the test directory exists
      mkdirSync(testDir, { recursive: true });
    },
    30_000, // 30s timeout for cleanup of large node_modules
  );

  it("should create a browser project with FileMaker integration in non-interactive mode", () => {
    // Build the command with all necessary flags for non-interactive mode
    const command = [
      `node "${cliPath}" init`,
      projectName,
      "--non-interactive",
      "--app-type browser",
      "--data-source filemaker",
      `--server "${testEnv.OTTO_SERVER_URL}"`,
      `--admin-api-key "${testEnv.OTTO_ADMIN_API_KEY}"`,
      `--data-api-key "${testEnv.FM_DATA_API_KEY}"`,
      `--file-name "${testEnv.FM_FILE_NAME}"`,
      "--no-git", // Skip git initialization for testing
    ].join(" ");

    // Execute the command
    expect(() => {
      execSync(command, {
        cwd: testDir,
        env: process.env,
        encoding: "utf-8",
      });
    }).not.toThrow();

    // Verify project structure
    expect(existsSync(projectDir)).toBe(true);
    expect(existsSync(join(projectDir, "package.json"))).toBe(true);
    expect(existsSync(join(projectDir, "proofkit.json"))).toBe(true);
    expect(existsSync(join(projectDir, ".env"))).toBe(true);

    // Verify package.json content
    const pkgJson = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8"));
    expect(pkgJson.name).toBe(projectName);

    // Verify proofkit.json content
    const proofkitConfig = JSON.parse(readFileSync(join(projectDir, "proofkit.json"), "utf-8"));
    expect(proofkitConfig.appType).toBe("browser");
    expect(proofkitConfig.dataSources).toContainEqual(
      expect.objectContaining({
        type: "fm",
        name: "filemaker",
      }),
    );

    // Verify the project can be built successfully
    verifySmokeProjectBuilds(projectDir);
  });
});
