import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import { beforeEach, describe, expect, it } from "vitest";

interface PackageJsonShape {
  version?: string;
  name?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  proofkitMetadata?: {
    initVersion?: string;
  };
}

interface ProofkitSettings {
  appType?: string;
  ui?: string;
  envFile?: string;
  dataSources?: unknown[];
}

const cliPath = join(__dirname, "..", "bin", "proofkit.cjs");
const testDir = join(__dirname, "..", "..", "tmp", "cli-contract-tests");
const browserProjectName = "contract-browser-project";
const webviewerProjectName = "contract-webviewer-project";
const browserProjectDir = join(testDir, browserProjectName);
const webviewerProjectDir = join(testDir, webviewerProjectName);
const cliPackageJsonPath = join(__dirname, "..", "package.json");
const cliPackageJson = readJsonFile<PackageJsonShape>(cliPackageJsonPath);
const cliVersion = cliPackageJson.version ?? "";
const expectedProofkitVersions = new Map([
  ["@proofkit/cli", `^${cliVersion}`],
  [
    "@proofkit/fmdapi",
    `^${readJsonFile<PackageJsonShape>(join(__dirname, "..", "..", "fmdapi", "package.json")).version}`,
  ],
  [
    "@proofkit/typegen",
    `^${readJsonFile<PackageJsonShape>(join(__dirname, "..", "..", "typegen", "package.json")).version}`,
  ],
  [
    "@proofkit/webviewer",
    `^${readJsonFile<PackageJsonShape>(join(__dirname, "..", "..", "webviewer", "package.json")).version}`,
  ],
]);
const packageManagerPattern = /^(npm|pnpm|yarn|bun)@/;
const ansiStylePrefixPattern = /^[0-9;]*m/;

function runInit({ appType, projectName }: { appType: "browser" | "webviewer"; projectName: string }): string {
  return execFileSync(
    "node",
    [
      cliPath,
      "init",
      projectName,
      "--non-interactive",
      "--app-type",
      appType,
      "--data-source",
      "none",
      "--no-git",
      "--no-install",
    ],
    {
      cwd: testDir,
      env: process.env,
      encoding: "utf-8",
      stdio: "pipe",
    },
  );
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

function getProofkitDependencyVersions(pkg: PackageJsonShape): [string, string][] {
  const combined = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  return Object.entries(combined)
    .filter(([name]) => name.startsWith("@proofkit/"))
    .map(([name, version]) => [name, version]);
}

function allProofkitDependenciesUseCurrentVersions(pkg: PackageJsonShape): boolean {
  const versions = getProofkitDependencyVersions(pkg);
  return versions.length > 0 && versions.every(([name, version]) => version === expectedProofkitVersions.get(name));
}

function checkNodeSyntax(projectDir: string, relativeFilePath: string): boolean {
  try {
    execFileSync("node", ["--check", relativeFilePath], {
      cwd: projectDir,
      env: process.env,
      encoding: "utf-8",
      stdio: "pipe",
    });

    return true;
  } catch {
    return false;
  }
}

function getPackageManagerName(packageJson: PackageJsonShape): "npm" | "pnpm" | "yarn" | "bun" {
  const raw = packageJson.packageManager?.split("@")[0];
  if (raw === "pnpm" || raw === "yarn" || raw === "bun") {
    return raw;
  }
  return "npm";
}

function formatRunCommand(pkgManager: "npm" | "pnpm" | "yarn" | "bun", command: string): string {
  return pkgManager === "npm" || pkgManager === "bun" ? `${pkgManager} run ${command}` : `${pkgManager} ${command}`;
}

function sanitizeOutput(output: string): string {
  return output
    .split("\u001b[")
    .map((segment, index) => (index === 0 ? segment : segment.replace(ansiStylePrefixPattern, "")))
    .join("");
}

function outputSuggestsCommand(output: string, command: string): boolean {
  return output.includes(`  ${command}`);
}

describe("Init scaffold contract tests", () => {
  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  it("creates deterministic browser scaffold output in non-interactive mode", () => {
    const initOutput = runInit({
      appType: "browser",
      projectName: browserProjectName,
    });
    const normalizedOutput = sanitizeOutput(initOutput);

    expect(existsSync(browserProjectDir)).toBe(true);
    expect(existsSync(join(browserProjectDir, "package.json"))).toBe(true);
    expect(existsSync(join(browserProjectDir, "proofkit.json"))).toBe(true);
    expect(existsSync(join(browserProjectDir, ".env"))).toBe(true);
    expect(existsSync(join(browserProjectDir, ".cursorignore"))).toBe(true);
    expect(existsSync(join(browserProjectDir, "pnpm-workspace.yaml"))).toBe(true);
    expect(existsSync(join(browserProjectDir, "src", "lib", "env.ts"))).toBe(true);
    expect(existsSync(join(browserProjectDir, "src", "app", "layout.tsx"))).toBe(true);
    expect(existsSync(join(browserProjectDir, "postcss.config.mjs"))).toBe(true);

    const packageJson = readJsonFile<PackageJsonShape>(join(browserProjectDir, "package.json"));
    expect(packageJson.name).toBe(browserProjectName);
    expect(packageJson.scripts?.dev).toBe("next dev --turbopack");
    expect(packageJson.scripts?.build).toBe("next build --turbopack");
    expect(packageJson.scripts?.proofkit).toBe("proofkit");
    expect(packageJson.proofkitMetadata?.initVersion).toBe(cliVersion);
    expect(packageJson.packageManager).toMatch(packageManagerPattern);
    expect(allProofkitDependenciesUseCurrentVersions(packageJson)).toBe(true);
    expect(readFileSync(join(browserProjectDir, "CLAUDE.md"), "utf-8")).toBe("@AGENTS.md\n");
    expect(readFileSync(join(browserProjectDir, ".cursorignore"), "utf-8")).toBe("CLAUDE.md\n");
    const pnpmWorkspaceText = readFileSync(join(browserProjectDir, "pnpm-workspace.yaml"), "utf-8");
    expect(pnpmWorkspaceText).toContain('  "esbuild": true');
    expect(pnpmWorkspaceText).toContain('  "msw": false');
    expect(pnpmWorkspaceText).toContain('  "@parcel/watcher": false');
    expect(pnpmWorkspaceText).toContain('  "sharp": false');
    const pkgManager = getPackageManagerName(packageJson);
    expect(outputSuggestsCommand(normalizedOutput, formatRunCommand(pkgManager, "typegen"))).toBe(false);

    const proofkitConfig = readJsonFile<ProofkitSettings>(join(browserProjectDir, "proofkit.json"));
    expect(proofkitConfig.appType).toBe("browser");
    expect(proofkitConfig.ui).toBe("shadcn");
    expect(proofkitConfig.envFile).toBe(".env");
    expect(proofkitConfig.dataSources).toEqual([]);

    // Compile-equivalent smoke check without external installs.
    expect(checkNodeSyntax(browserProjectDir, "postcss.config.mjs")).toBe(true);
  });

  it("creates deterministic webviewer scaffold output in non-interactive mode", () => {
    const initOutput = runInit({
      appType: "webviewer",
      projectName: webviewerProjectName,
    });
    const normalizedOutput = sanitizeOutput(initOutput);

    expect(existsSync(webviewerProjectDir)).toBe(true);
    expect(existsSync(join(webviewerProjectDir, "package.json"))).toBe(true);
    expect(existsSync(join(webviewerProjectDir, "proofkit.json"))).toBe(true);
    expect(existsSync(join(webviewerProjectDir, "proofkit-typegen.config.jsonc"))).toBe(true);
    expect(existsSync(join(webviewerProjectDir, ".env"))).toBe(true);
    expect(existsSync(join(webviewerProjectDir, ".cursorignore"))).toBe(true);
    expect(existsSync(join(webviewerProjectDir, "pnpm-workspace.yaml"))).toBe(true);
    expect(existsSync(join(webviewerProjectDir, "src", "main.tsx"))).toBe(true);
    expect(existsSync(join(webviewerProjectDir, "scripts", "upload.js"))).toBe(true);

    const packageJson = readJsonFile<PackageJsonShape>(join(webviewerProjectDir, "package.json"));
    expect(packageJson.name).toBe(webviewerProjectName);
    expect(packageJson.scripts?.build).toBe("vite build");
    expect(packageJson.scripts?.typegen).toBe("npx @proofkit/typegen");
    expect(packageJson.scripts?.["typegen:ui"]).toBe("npx @proofkit/typegen ui");
    expect(packageJson.scripts?.proofkit).toBe("proofkit");
    expect(packageJson.proofkitMetadata?.initVersion).toBe(cliVersion);
    expect(packageJson.packageManager).toMatch(packageManagerPattern);
    expect(allProofkitDependenciesUseCurrentVersions(packageJson)).toBe(true);
    expect(readFileSync(join(webviewerProjectDir, "CLAUDE.md"), "utf-8")).toBe("@AGENTS.md\n");
    expect(readFileSync(join(webviewerProjectDir, ".cursorignore"), "utf-8")).toBe("CLAUDE.md\n");
    const pkgManager = getPackageManagerName(packageJson);
    expect(outputSuggestsCommand(normalizedOutput, formatRunCommand(pkgManager, "typegen"))).toBe(true);

    const proofkitConfig = readJsonFile<ProofkitSettings>(join(webviewerProjectDir, "proofkit.json"));
    expect(proofkitConfig.appType).toBe("webviewer");
    expect(proofkitConfig.ui).toBe("shadcn");
    expect(proofkitConfig.envFile).toBe(".env");
    expect(proofkitConfig.dataSources).toEqual([]);

    const typegenConfigText = readFileSync(join(webviewerProjectDir, "proofkit-typegen.config.jsonc"), "utf-8");
    const typegenConfig = parseJsonc(typegenConfigText) as {
      config?: {
        type?: string;
        path?: string;
        validator?: string;
        webviewerScriptName?: string;
        fmMcp?: {
          enabled?: boolean;
        };
      };
    };
    expect(typegenConfig.config?.type).toBe("fmdapi");
    expect(typegenConfig.config?.path).toBe("./src/config/schemas/filemaker");
    expect(typegenConfig.config?.validator).toBe("zod/v4");
    expect(typegenConfig.config?.webviewerScriptName).toBe("ExecuteDataApi");
    expect(typegenConfig.config?.fmMcp?.enabled).toBe(true);

    const uploadScriptText = readFileSync(join(webviewerProjectDir, "scripts", "upload.js"), "utf-8");
    const filemakerHelperText = readFileSync(join(webviewerProjectDir, "scripts", "filemaker.js"), "utf-8");
    const pnpmWorkspaceText = readFileSync(join(webviewerProjectDir, "pnpm-workspace.yaml"), "utf-8");
    expect(uploadScriptText).toContain("const deployment = await deployHtml({");
    expect(uploadScriptText).toContain("Deployed via FM MCP bridge.");
    expect(filemakerHelperText).toContain('scriptName = "deploy_html"');
    expect(pnpmWorkspaceText).toContain('  "esbuild": true');
    expect(pnpmWorkspaceText).toContain('  "msw": false');
    expect(pnpmWorkspaceText).toContain('  "@parcel/watcher": false');
    expect(pnpmWorkspaceText).toContain('  "sharp": false');

    // Compile-equivalent smoke checks without external installs.
    expect(checkNodeSyntax(webviewerProjectDir, "scripts/upload.js")).toBe(true);
  });
});
