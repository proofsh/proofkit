import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { compareAddonVersions, getFmAddonInstallInstructions, inspectFmAddon } from "~/installers/install-fm-addon.js";
import { getWebViewerAddonMessages } from "~/installers/proofkit-webviewer.js";

async function writeAddonVersion(dir: string, version: string) {
  await fs.ensureDir(dir);
  await fs.writeFile(
    path.join(dir, "template.xml"),
    `<?xml version="1.0"?><FMAdd_on version="${version}" Source="22.0.4"></FMAdd_on>`,
    "utf8",
  );
}

describe("inspectFmAddon", () => {
  it("returns unknown when the platform is unsupported", async () => {
    const result = await inspectFmAddon(
      { addonName: "wv" },
      {
        targetDir: null,
        latestAddonPath: "/tmp/latest-addon",
      },
    );

    expect(result.status).toBe("unknown");
    expect(result.reason).toBe("unsupported-platform");
  });

  it("returns missing when the local add-on is absent", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-addon-missing-"));
    const latestAddonPath = path.join(root, "latest", "ProofKitWV");
    const targetDir = path.join(root, "target");
    await writeAddonVersion(latestAddonPath, "2.2.3.0");
    await fs.ensureDir(targetDir);

    const result = await inspectFmAddon({ addonName: "wv" }, { targetDir, latestAddonPath });

    expect(result.status).toBe("missing");
    expect(result.latestVersion).toBe("2.2.3.0");
  });

  it("returns installed-current when versions match", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-addon-current-"));
    const latestAddonPath = path.join(root, "latest", "ProofKitWV");
    const targetDir = path.join(root, "target");
    await writeAddonVersion(latestAddonPath, "2.2.3.0");
    await writeAddonVersion(path.join(targetDir, "ProofKitWV"), "2.2.3.0");

    const result = await inspectFmAddon({ addonName: "wv" }, { targetDir, latestAddonPath });

    expect(result.status).toBe("installed-current");
    expect(result.installedVersion).toBe("2.2.3.0");
  });

  it("returns installed-outdated when the remote add-on is newer", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-addon-outdated-"));
    const latestAddonPath = path.join(root, "latest", "ProofKitWV");
    const targetDir = path.join(root, "target");
    await writeAddonVersion(latestAddonPath, "2.2.4.0");
    await writeAddonVersion(path.join(targetDir, "ProofKitWV"), "2.2.3.0");

    const result = await inspectFmAddon({ addonName: "wv" }, { targetDir, latestAddonPath });

    expect(result.status).toBe("installed-outdated");
    expect(result.installedVersion).toBe("2.2.3.0");
    expect(result.latestVersion).toBe("2.2.4.0");
  });

  it("returns unknown when installed metadata cannot be parsed", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-addon-unknown-"));
    const latestAddonPath = path.join(root, "latest", "ProofKitWV");
    const targetDir = path.join(root, "target");
    await writeAddonVersion(latestAddonPath, "2.2.4.0");
    await fs.ensureDir(path.join(targetDir, "ProofKitWV"));
    await fs.writeFile(path.join(targetDir, "ProofKitWV", "template.xml"), "<FMAdd_on />", "utf8");

    const result = await inspectFmAddon({ addonName: "wv" }, { targetDir, latestAddonPath });

    expect(result.status).toBe("unknown");
    expect(result.reason).toBe("unreadable-version");
  });
});

describe("compareAddonVersions", () => {
  it("preserves the fourth version segment", () => {
    expect(compareAddonVersions("2.2.3.0", "2.2.3.1")).toBe(-1);
    expect(compareAddonVersions("2.2.3.1", "2.2.3.0")).toBe(1);
  });
});

describe("getWebViewerAddonMessages", () => {
  it("points to the docs when the local add-on is outdated", () => {
    const messages = getWebViewerAddonMessages({
      hasRequiredLayouts: true,
      inspection: {
        status: "installed-outdated",
        addonName: "wv",
        addonDir: "ProofKitWV",
        addonDisplayName: "ProofKit Web Viewer",
        targetDir: "/tmp/ProofKit",
        installedPath: "/tmp/ProofKit/ProofKit.fmaddon",
        installedVersion: "2.2.3.0",
        remoteAssetUrl: "https://downloads.ottomatic.cloud/proofkit/addons/ProofKitWV.fmaddon",
        latestVersion: "2.2.4.0",
      },
    });

    expect(messages.warn.join("\n")).toContain("https://proofkit.proof.sh/docs/webviewer");
    expect(messages.nextSteps).toEqual([
      "Update the ProofKit Web Viewer add-on: https://proofkit.proof.sh/docs/webviewer",
    ]);
    expect(messages.warn.join("\n")).not.toContain("proofkit add addon");
  });
});

describe("getFmAddonInstallInstructions", () => {
  it("includes direct-open install guidance", () => {
    const instructions = getFmAddonInstallInstructions("wv");

    expect(instructions.steps).toContain("When FileMaker opens the add-on file, confirm the install prompt");
    expect(instructions.steps.join("\n")).not.toContain("Restart FileMaker");
  });
});
