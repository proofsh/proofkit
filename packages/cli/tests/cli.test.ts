import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.join(__dirname, "..");
const distEntry = path.join(packageDir, "dist/index.js");

describe("proofkit CLI", () => {
  it("shows kebab-case init flags in help", () => {
    const output = execFileSync("node", [distEntry, "init", "--help"], {
      cwd: packageDir,
      stdio: "pipe",
      encoding: "utf8",
    });

    expect(output).toContain("--app-type");
    expect(output).toContain("--non-interactive");
    expect(output).toContain("--no-install");
    expect(output).toContain("--no-git");
    expect(output).not.toContain("--ui");
    expect(output).not.toContain("--appType");
  });

  it("prints the header and project command guidance when run inside a ProofKit project", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-cli-project-"));
    await fs.writeJson(path.join(cwd, "proofkit.json"), {
      appType: "browser",
      ui: "shadcn",
      dataSources: [],
      replacedMainPage: false,
      registryTemplates: [],
    });

    const output = execFileSync("node", [distEntry], {
      cwd,
      stdio: "pipe",
      encoding: "utf8",
    });

    expect(output).toContain("_______");
    expect(output).toContain("Found");
    expect(output).toContain("Project commands");
    expect(output).toContain("proofkit doctor");
    expect(output).toContain("proofkit prompt");
  });

  it("fails with guidance when no command is used in non-interactive mode", () => {
    const result = spawnSync("node", [distEntry, "--non-interactive"], {
      cwd: packageDir,
      stdio: "pipe",
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("interactive-only in non-interactive mode");
    expect(`${result.stdout}\n${result.stderr}`).toContain("proofkit init <name> --non-interactive");
  });

  it("auto-detects piped execution as non-interactive", () => {
    const result = spawnSync("node", [distEntry], {
      cwd: packageDir,
      stdio: "pipe",
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("interactive-only in non-interactive mode");
  });

  it("runs when invoked through a symlinked bin path", async () => {
    const shimDir = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-cli-shim-"));
    const shimPath = path.join(shimDir, "proofkit");
    await fs.symlink(distEntry, shimPath);

    const result = spawnSync("node", [shimPath, "init", "--help"], {
      cwd: packageDir,
      stdio: "pipe",
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ProofKit");
    expect(result.stdout).toContain("Create a new project with ProofKit");
    expect(result.stdout).toContain("--app-type");
    expect(result.stdout).not.toContain("--ui");
  });

  it("shows a clean invalid subcommand error by default", () => {
    const result = spawnSync("node", [distEntry, "my-proofkit-app", "--force"], {
      cwd: packageDir,
      stdio: "pipe",
      encoding: "utf8",
    });

    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "Invalid subcommand for proofkit - use one of 'init', 'doctor', 'prompt', 'add', 'remove', 'typegen', 'deploy', 'upgrade'",
    );
    expect(output).not.toContain('"CommandMismatch"');
    expect(output).not.toContain("[debug]");
  });

  it("shows internal error details when debug mode is enabled", () => {
    const result = spawnSync("node", [distEntry, "--debug", "my-proofkit-app", "--force"], {
      cwd: packageDir,
      stdio: "pipe",
      encoding: "utf8",
    });

    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain(
      "Invalid subcommand for proofkit - use one of 'init', 'doctor', 'prompt', 'add', 'remove', 'typegen', 'deploy', 'upgrade'",
    );
    expect(output).toContain("[debug]");
    expect(output).toContain('"CommandMismatch"');
  });

  it("supports `proofkit prompt`", () => {
    const result = spawnSync("node", [distEntry, "prompt"], {
      cwd: packageDir,
      stdio: "pipe",
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Agent-ready prompts are coming soon.");
  });

  it("supports `proofkit add addon webviewer`", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-cli-addon-project-"));
    const addonDownloadDir = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-cli-addon-downloads-"));
    const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-cli-addon-fixtures-"));
    const addonFixturePath = path.join(fixtureDir, "ProofKit.fmaddon");
    await fs.writeFile(addonFixturePath, "fake-fmaddon");
    const manifestPath = path.join(fixtureDir, "manifest.json");
    await fs.writeJson(manifestPath, {
      latestVersion: "2.2.4.0",
      versions: [
        {
          version: "2.2.4.0",
          assets: [{ file: "ProofKit.fmaddon", url: pathToFileURL(addonFixturePath).toString() }],
        },
      ],
    });

    const result = spawnSync("node", [distEntry, "add", "addon", "webviewer", "--non-interactive"], {
      cwd,
      stdio: "pipe",
      encoding: "utf8",
      env: {
        ...process.env,
        PROOFKIT_FM_ADDON_MANIFEST_URL: pathToFileURL(manifestPath).toString(),
        PROOFKIT_FM_ADDON_DOWNLOAD_DIR: addonDownloadDir,
        PROOFKIT_SKIP_OPEN_FM_ADDON: "1",
      },
    });

    expect(result.status).toBe(0);

    expect(await fs.pathExists(path.join(addonDownloadDir, "ProofKit.fmaddon"))).toBe(true);
    expect(await fs.pathExists(path.join(addonDownloadDir, "ProofKit.fmaddon.proofkit.json"))).toBe(true);
  });

  it("rejects unsupported add targets", () => {
    const result = spawnSync("node", [distEntry, "add", "page"], {
      cwd: packageDir,
      stdio: "pipe",
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Only `proofkit add addon <target>` is supported.");
  });
});
