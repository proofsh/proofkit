import os from "node:os";
import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";

import { PKG_ROOT } from "~/consts.js";
import { logger } from "~/utils/logger.js";

export type FmAddonName = "auth" | "wv";
export type FmAddonInspectionStatus = "missing" | "installed-current" | "installed-outdated" | "unknown";

export interface FmAddonInspection {
  status: FmAddonInspectionStatus;
  addonName: FmAddonName;
  addonDir: string;
  addonDisplayName: string;
  installCommand: string;
  targetDir: string | null;
  installedPath: string | null;
  bundledPath: string;
  bundledVersion?: string;
  installedVersion?: string;
  reason?: string;
}

const FM_ADDON_VERSION_REGEX = /<FMAdd_on[^>]*\bversion="([^"]+)"/i;
const NUMERIC_VERSION_PART_REGEX = /^\d+$/;

function getAddonDisplayName(addonName: FmAddonName) {
  return addonName === "auth" ? "FM Auth Add-on" : "ProofKit WebViewer";
}

function getAddonDir(addonName: FmAddonName) {
  return addonName === "auth" ? "ProofKitAuth" : "ProofKitWV";
}

function getAddonInstallCommand(addonName: FmAddonName) {
  return addonName === "auth" ? "proofkit add addon auth" : "proofkit add addon webviewer";
}

export function resolveFmAddonModulesDir(platform = process.platform, homeDir = os.homedir()): string | null {
  const overrideDir = process.env.PROOFKIT_FM_ADDON_MODULES_DIR;
  if (overrideDir) {
    return overrideDir;
  }
  if (platform === "win32") {
    return path.join(homeDir, "AppData", "Local", "FileMaker", "Extensions", "AddonModules");
  }
  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", "FileMaker", "Extensions", "AddonModules");
  }
  return null;
}

function parseAddonVersion(version: string) {
  const parts = version
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0 || parts.some((part) => !NUMERIC_VERSION_PART_REGEX.test(part))) {
    return undefined;
  }

  return parts.map((part) => Number.parseInt(part, 10));
}

export function compareAddonVersions(installedVersion: string, bundledVersion: string) {
  const installed = parseAddonVersion(installedVersion);
  const bundled = parseAddonVersion(bundledVersion);

  if (!(installed && bundled)) {
    return undefined;
  }

  const maxLength = Math.max(installed.length, bundled.length);
  for (let index = 0; index < maxLength; index += 1) {
    const installedPart = installed[index] ?? 0;
    const bundledPart = bundled[index] ?? 0;

    if (installedPart < bundledPart) {
      return -1;
    }
    if (installedPart > bundledPart) {
      return 1;
    }
  }

  return 0;
}

async function readAddonVersionFromDirectory(addonPath: string): Promise<string | undefined> {
  const templateXmlPath = path.join(addonPath, "template.xml");
  if (await fs.pathExists(templateXmlPath)) {
    const templateXml = await fs.readFile(templateXmlPath, "utf8");
    const versionMatch = templateXml.match(FM_ADDON_VERSION_REGEX);
    if (versionMatch?.[1]) {
      return versionMatch[1];
    }
  }

  const infoJsonPath = path.join(addonPath, "info.json");
  if (await fs.pathExists(infoJsonPath)) {
    const infoJson = (await fs.readJson(infoJsonPath)) as { Version?: string | number };
    if (typeof infoJson.Version === "string" || typeof infoJson.Version === "number") {
      return String(infoJson.Version);
    }
  }

  return undefined;
}

export async function inspectFmAddon(
  {
    addonName,
  }: {
    addonName: FmAddonName;
  },
  options?: {
    targetDir?: string | null;
    bundledPath?: string;
  },
): Promise<FmAddonInspection> {
  const addonDir = getAddonDir(addonName);
  const addonDisplayName = getAddonDisplayName(addonName);
  const installCommand = getAddonInstallCommand(addonName);
  const targetDir = options && "targetDir" in options ? options.targetDir : resolveFmAddonModulesDir();
  const bundledPath = options?.bundledPath ?? path.join(PKG_ROOT, `template/fm-addon/${addonDir}`);
  const bundledVersion = await readAddonVersionFromDirectory(bundledPath);

  if (!targetDir) {
    return {
      status: "unknown",
      addonName,
      addonDir,
      addonDisplayName,
      installCommand,
      targetDir: null,
      installedPath: null,
      bundledPath,
      bundledVersion,
      reason: "unsupported-platform",
    };
  }

  const installedPath = path.join(targetDir, addonDir);
  const installedExists = await fs.pathExists(installedPath);

  if (!installedExists) {
    return {
      status: "missing",
      addonName,
      addonDir,
      addonDisplayName,
      installCommand,
      targetDir,
      installedPath,
      bundledPath,
      bundledVersion,
    };
  }

  const installedVersion = await readAddonVersionFromDirectory(installedPath);
  if (!(installedVersion && bundledVersion)) {
    return {
      status: "unknown",
      addonName,
      addonDir,
      addonDisplayName,
      installCommand,
      targetDir,
      installedPath,
      bundledPath,
      bundledVersion,
      installedVersion,
      reason: "unreadable-version",
    };
  }

  const comparison = compareAddonVersions(installedVersion, bundledVersion);
  if (comparison === undefined) {
    return {
      status: "unknown",
      addonName,
      addonDir,
      addonDisplayName,
      installCommand,
      targetDir,
      installedPath,
      bundledPath,
      bundledVersion,
      installedVersion,
      reason: "invalid-version",
    };
  }

  return {
    status: comparison < 0 ? "installed-outdated" : "installed-current",
    addonName,
    addonDir,
    addonDisplayName,
    installCommand,
    targetDir,
    installedPath,
    bundledPath,
    bundledVersion,
    installedVersion,
  };
}

export function getFmAddonInstallInstructions(addonName: FmAddonName) {
  const addonDisplayName = getAddonDisplayName(addonName);
  const installCommand = getAddonInstallCommand(addonName);
  const removeOldStep = `If your FileMaker file already has an older ${addonDisplayName} add-on installed, remove that old add-on first`;

  return {
    addonDisplayName,
    installCommand,
    docsUrl: addonName === "auth" ? "https://proofkit.proof.sh/auth/fm-addon" : "https://proofkit.proof.sh/webviewer",
    steps: [
      `Run \`${installCommand}\` to install or update the local add-on files`,
      "Restart FileMaker Pro so the new local add-on files appear",
      removeOldStep,
      `Open your FileMaker file, go to layout mode, and install the ${addonDisplayName} add-on to the file`,
    ],
  };
}

export async function installFmAddonExplicitly({ addonName }: { addonName: FmAddonName }) {
  const addonDisplayName = getAddonDisplayName(addonName);

  const targetDir = resolveFmAddonModulesDir();

  if (!targetDir) {
    logger.warn(`Could not install the ${addonDisplayName} addon. You will need to do this manually.`);
    return false;
  }

  const addonDir = getAddonDir(addonName);

  await fs.copy(path.join(PKG_ROOT, `template/fm-addon/${addonDir}`), path.join(targetDir, addonDir), {
    overwrite: true,
  });

  console.log("");
  console.log(chalk.bgYellow(" ACTION REQUIRED: "));
  if (addonName === "auth") {
    console.log(
      `${chalk.yellowBright(
        "You must install the FM Auth addon in your FileMaker file to continue.",
      )} ${chalk.dim("(Learn more: https://proofkit.proof.sh/auth/fm-addon)")}`,
    );
  } else {
    console.log(
      `${chalk.yellowBright(
        "You must install the ProofKit WebViewer addon in your FileMaker file to continue.",
      )} ${chalk.dim("(Learn more: https://proofkit.proof.sh/webviewer)")}`,
    );
  }
  const steps = [
    "Restart FileMaker Pro so the new local add-on files appear",
    `If your FileMaker file already has an older ${addonDisplayName} add-on installed, remove that old add-on first`,
    `Open your FileMaker file, go to layout mode, and install the ${addonDisplayName} add-on to the file`,
  ];
  steps.forEach((step, index) => {
    console.log(`${index + 1}. ${step}`);
  });
  return true;
}

export function installFmAddon({ addonName }: { addonName: FmAddonName }) {
  return installFmAddonExplicitly({ addonName });
}
