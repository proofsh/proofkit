import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";

import { openExternal } from "~/utils/browserOpen.js";
import { requestArrayBuffer, requestJson } from "~/utils/http.js";

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
  remoteAssetUrl: string;
  latestVersion?: string;
  installedVersion?: string;
  reason?: string;
}

type FmAddonTarget = "webviewer" | "auth";

interface FmAddonManifestAsset {
  file?: string;
  url?: string;
  sha256?: string;
  size?: number;
}

interface FmAddonManifestEntry {
  version?: string;
  latestVersion?: string;
  assets?: FmAddonManifestAsset[];
  url?: string;
  file?: string;
}

interface FmAddonManifest {
  product?: string;
  updatedAt?: string;
  latestVersion?: string;
  addons?: Partial<Record<FmAddonTarget, FmAddonManifestEntry>>;
  versions?: Array<{
    version?: string;
    assets?: FmAddonManifestAsset[];
    addons?: Partial<Record<FmAddonTarget, FmAddonManifestEntry>>;
  }>;
}

const DEFAULT_FM_ADDON_MANIFEST_URL = "https://downloads.ottomatic.cloud/proofkit/manifest.json";
const FM_ADDON_VERSION_REGEX = /<FMAdd_on[^>]*\bversion="([^"]+)"/i;
const NUMERIC_VERSION_PART_REGEX = /^\d+$/;

function getAddonDisplayName(addonName: FmAddonName) {
  return addonName === "auth" ? "FM Auth Add-on" : "ProofKit Web Viewer";
}

function getAddonDir(addonName: FmAddonName) {
  return addonName === "auth" ? "ProofKitAuth" : "ProofKitWV";
}

function getAddonTarget(addonName: FmAddonName): FmAddonTarget {
  return addonName === "auth" ? "auth" : "webviewer";
}

function getAddonInstallCommand(addonName: FmAddonName) {
  return addonName === "auth" ? "proofkit add addon auth" : "proofkit add addon webviewer";
}

function getAddonManifestUrl() {
  return process.env.PROOFKIT_FM_ADDON_MANIFEST_URL || DEFAULT_FM_ADDON_MANIFEST_URL;
}

export function resolveFmAddonDownloadDir(homeDir = os.homedir()): string {
  return process.env.PROOFKIT_FM_ADDON_DOWNLOAD_DIR || path.join(homeDir, "Downloads", "ProofKit");
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

export function compareAddonVersions(installedVersion: string, latestVersion: string) {
  const installed = parseAddonVersion(installedVersion);
  const latest = parseAddonVersion(latestVersion);

  if (!(installed && latest)) {
    return undefined;
  }

  const maxLength = Math.max(installed.length, latest.length);
  for (let index = 0; index < maxLength; index += 1) {
    const installedPart = installed[index] ?? 0;
    const latestPart = latest[index] ?? 0;

    if (installedPart < latestPart) {
      return -1;
    }
    if (installedPart > latestPart) {
      return 1;
    }
  }

  return 0;
}

async function readAddonVersionFromDirectory(addonPath: string): Promise<string | undefined> {
  const sidecarJsonPath = `${addonPath}.proofkit.json`;
  if (await fs.pathExists(sidecarJsonPath)) {
    const sidecarJson = (await fs.readJson(sidecarJsonPath)) as { version?: string | number };
    if (typeof sidecarJson.version === "string" || typeof sidecarJson.version === "number") {
      return String(sidecarJson.version);
    }
  }

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

function resolveUrl(url: string, baseUrl: string) {
  return new URL(url, baseUrl).toString();
}

function getRemoteFileName(remoteAssetUrl: string) {
  try {
    return path.basename(new URL(remoteAssetUrl).pathname);
  } catch {
    return path.basename(remoteAssetUrl);
  }
}

function pickAddonEntry(manifest: FmAddonManifest, addonName: FmAddonName): FmAddonManifestEntry | undefined {
  const target = getAddonTarget(addonName);
  const latestVersion = manifest.latestVersion;

  if (latestVersion && manifest.versions?.length) {
    const latestEntry = manifest.versions.find((entry) => entry.version === latestVersion);
    const addon = latestEntry?.addons?.[target];
    if (addon) {
      return { ...addon, version: addon.version ?? latestEntry?.version };
    }
    if (latestEntry?.assets?.length) {
      return { version: latestEntry.version, assets: latestEntry.assets };
    }
  }

  return manifest.addons?.[target];
}

function pickAddonAsset(entry: FmAddonManifestEntry): FmAddonManifestAsset | undefined {
  const assets = entry.assets ?? (entry.url ? [{ url: entry.url, file: entry.file }] : []);
  return (
    assets.find((asset) => asset.file?.toLowerCase().endsWith(".fmaddon")) ??
    assets.find((asset) => asset.url?.toLowerCase().endsWith(".fmaddon")) ??
    assets[0]
  );
}

export async function resolveRemoteFmAddon(addonName: FmAddonName) {
  const manifestUrl = getAddonManifestUrl();
  const response = await requestJson<FmAddonManifest>(manifestUrl);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Could not fetch FileMaker add-on manifest (${response.status}).`);
  }

  const entry = pickAddonEntry(response.data, addonName);
  const asset = entry ? pickAddonAsset(entry) : undefined;
  if (!(entry && asset?.url)) {
    throw new Error(`Manifest does not include a ${getAddonDisplayName(addonName)} asset.`);
  }

  return {
    version: entry.version ?? entry.latestVersion ?? response.data.latestVersion,
    url: resolveUrl(asset.url, manifestUrl),
    file: asset.file,
    sha256: asset.sha256,
  };
}

export async function inspectFmAddon(
  {
    addonName,
  }: {
    addonName: FmAddonName;
  },
  options?: {
    targetDir?: string | null;
    latestAddonPath?: string;
  },
): Promise<FmAddonInspection> {
  const addonDir = getAddonDir(addonName);
  const addonDisplayName = getAddonDisplayName(addonName);
  const installCommand = getAddonInstallCommand(addonName);
  const targetDir = options && "targetDir" in options ? options.targetDir : resolveFmAddonDownloadDir();
  const remoteAddon = options?.latestAddonPath
    ? {
        latestVersion: await readAddonVersionFromDirectory(options.latestAddonPath),
        remoteAssetUrl: options.latestAddonPath,
      }
    : await resolveRemoteFmAddon(addonName)
        .then((addon) => ({ latestVersion: addon.version, remoteAssetUrl: addon.url }))
        .catch((error) => ({
          latestVersion: undefined,
          remoteAssetUrl: getAddonManifestUrl(),
          reason: error instanceof Error ? error.message : "remote-manifest-unavailable",
        }));

  if (!targetDir) {
    return {
      status: "unknown",
      addonName,
      addonDir,
      addonDisplayName,
      installCommand,
      targetDir: null,
      installedPath: null,
      remoteAssetUrl: remoteAddon.remoteAssetUrl,
      latestVersion: remoteAddon.latestVersion,
      reason: "unsupported-platform",
    };
  }

  const remoteFileName = getRemoteFileName(remoteAddon.remoteAssetUrl);
  const installedCandidates = [
    remoteFileName ? path.join(targetDir, remoteFileName) : undefined,
    path.join(targetDir, "ProofKit.fmaddon"),
    path.join(targetDir, `${addonDir}.fmaddon`),
    path.join(targetDir, addonDir),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const installedPath = (
    await Promise.all(
      installedCandidates.map(async (candidate) => ((await fs.pathExists(candidate)) ? candidate : null)),
    )
  ).find((candidate): candidate is string => Boolean(candidate));
  if (!installedPath) {
    return {
      status: "missing",
      addonName,
      addonDir,
      addonDisplayName,
      installCommand,
      targetDir,
      installedPath: installedCandidates[0] ?? null,
      remoteAssetUrl: remoteAddon.remoteAssetUrl,
      latestVersion: remoteAddon.latestVersion,
    };
  }

  const installedVersion = await readAddonVersionFromDirectory(installedPath);
  if (!(installedVersion && remoteAddon.latestVersion)) {
    return {
      status: "unknown",
      addonName,
      addonDir,
      addonDisplayName,
      installCommand,
      targetDir,
      installedPath,
      remoteAssetUrl: remoteAddon.remoteAssetUrl,
      latestVersion: remoteAddon.latestVersion,
      installedVersion,
      reason: installedVersion ? "remote-version-unavailable" : "unreadable-version",
    };
  }

  const comparison = compareAddonVersions(installedVersion, remoteAddon.latestVersion);
  if (comparison === undefined) {
    return {
      status: "unknown",
      addonName,
      addonDir,
      addonDisplayName,
      installCommand,
      targetDir,
      installedPath,
      remoteAssetUrl: remoteAddon.remoteAssetUrl,
      latestVersion: remoteAddon.latestVersion,
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
    remoteAssetUrl: remoteAddon.remoteAssetUrl,
    latestVersion: remoteAddon.latestVersion,
    installedVersion,
  };
}

export function getFmAddonInstallInstructions(addonName: FmAddonName) {
  const addonDisplayName = getAddonDisplayName(addonName);
  const installCommand = getAddonInstallCommand(addonName);
  return {
    addonDisplayName,
    installCommand,
    docsUrl: addonName === "auth" ? "https://proofkit.proof.sh/auth/fm-addon" : "https://proofkit.proof.sh/webviewer",
    steps: [
      `Run \`${installCommand}\` to download and open the latest add-on`,
      "When FileMaker opens the add-on file, confirm the install prompt",
      `Open your FileMaker file, go to layout mode, and add the ${addonDisplayName} add-on to the file`,
    ],
  };
}

export async function installFmAddonExplicitly({ addonName }: { addonName: FmAddonName }) {
  const addonDisplayName = getAddonDisplayName(addonName);
  const addonDir = getAddonDir(addonName);

  const remoteAddon = await resolveRemoteFmAddon(addonName);
  const addonResponse = await requestArrayBuffer(remoteAddon.url);
  if (addonResponse.status < 200 || addonResponse.status >= 300) {
    throw new Error(`Could not download ${addonDisplayName} (${addonResponse.status}).`);
  }
  if (remoteAddon.sha256) {
    const digest = crypto.createHash("sha256").update(addonResponse.data).digest("hex");
    if (digest !== remoteAddon.sha256) {
      throw new Error(`Downloaded ${addonDisplayName} checksum did not match the manifest.`);
    }
  }

  const targetDir = resolveFmAddonDownloadDir();
  await fs.ensureDir(targetDir);
  const addonPath = path.join(targetDir, remoteAddon.file || `${addonDir}.fmaddon`);
  await fs.writeFile(addonPath, addonResponse.data);
  await fs.writeJson(
    `${addonPath}.proofkit.json`,
    {
      version: remoteAddon.version,
      url: remoteAddon.url,
      sha256: remoteAddon.sha256,
      installedAt: new Date().toISOString(),
    },
    { spaces: 2 },
  );

  if (process.env.PROOFKIT_SKIP_OPEN_FM_ADDON !== "1") {
    await openExternal(addonPath);
  }

  console.log("");
  console.log(chalk.bgYellow(" ACTION REQUIRED: "));
  if (addonName === "auth") {
    console.log(
      `${chalk.yellowBright(
        "The FM Auth add-on file was downloaded and opened.",
      )} ${chalk.dim("(Learn more: https://proofkit.proof.sh/auth/fm-addon)")}`,
    );
  } else {
    console.log(
      `${chalk.yellowBright(
        "The ProofKit Web Viewer add-on file was downloaded and opened.",
      )} ${chalk.dim("(Learn more: https://proofkit.proof.sh/webviewer)")}`,
    );
  }
  const steps = [
    "When FileMaker opens the add-on file, confirm the install prompt",
    `Open your FileMaker file, go to layout mode, and add the ${addonDisplayName} add-on to the file`,
    `If FileMaker did not open automatically, open ${addonPath}`,
  ];
  steps.forEach((step, index) => {
    console.log(`${index + 1}. ${step}`);
  });
  return true;
}

export function installFmAddon({ addonName }: { addonName: FmAddonName }) {
  return installFmAddonExplicitly({ addonName });
}
