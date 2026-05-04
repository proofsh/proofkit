import path from "node:path";
import type { OttoAPIKey } from "@proofkit/fmdapi";
import chalk from "chalk";
import dotenv from "dotenv";
import { getLayouts } from "~/cli/fmdapi.js";
import { state } from "~/state.js";
import { readSettings } from "~/utils/parseSettings.js";
import { type FmAddonInspection, getFmAddonInstallInstructions, inspectFmAddon } from "./install-fm-addon.js";

export interface WebViewerAddonStatus {
  hasRequiredLayouts?: boolean;
  inspection: FmAddonInspection;
}

export async function checkForWebViewerLayouts(projectDir = state.projectDir): Promise<WebViewerAddonStatus> {
  const settings = readSettings(projectDir);
  const inspection = await inspectFmAddon({ addonName: "wv" });

  const dataSource = settings.dataSources
    .filter((s: { type: string }) => s.type === "fm")
    .find((s: { name: string; type: string }) => s.name === "filemaker") as
    | {
        type: "fm";
        name: string;
        envNames: { database: string; server: string; apiKey: string };
      }
    | undefined;

  if (!dataSource) {
    return { inspection };
  }
  if (settings.envFile) {
    dotenv.config({
      path: path.join(projectDir, settings.envFile),
    });
  }
  const dataApiKey = process.env[dataSource.envNames.apiKey] as OttoAPIKey | undefined;
  const fmFile = process.env[dataSource.envNames.database];
  const server = process.env[dataSource.envNames.server];

  if (!(dataApiKey && fmFile && server)) {
    return { inspection };
  }

  const existingLayouts = await getLayouts({
    dataApiKey,
    fmFile,
    server,
  });
  const webviewerLayouts = ["ProofKitWV"];

  const allWebViewerLayoutsExist = webviewerLayouts.every((layout) =>
    existingLayouts.some((l: string) => l === layout),
  );

  return {
    hasRequiredLayouts: allWebViewerLayoutsExist,
    inspection,
  };
}

export function getWebViewerAddonMessages({ hasRequiredLayouts, inspection }: WebViewerAddonStatus): {
  info: string[];
  warn: string[];
  nextSteps: string[];
} {
  const messages = {
    info: [] as string[],
    warn: [] as string[],
    nextSteps: [] as string[],
  };

  if (hasRequiredLayouts) {
    messages.info.push("Successfully detected all required layouts for ProofKit Web Viewer in your FileMaker file.");
  }

  if (inspection.status === "installed-outdated") {
    const versionSuffix =
      inspection.installedVersion && inspection.bundledVersion
        ? ` Local version: ${inspection.installedVersion}. Bundled version: ${inspection.bundledVersion}.`
        : "";
    messages.warn.push(
      `New ProofKit Web Viewer add-on available. Run \`${inspection.installCommand}\` to update the local add-on files.${versionSuffix}`,
    );
    messages.nextSteps.push(inspection.installCommand);
  }

  if (inspection.status === "unknown" && inspection.reason === "unsupported-platform") {
    messages.warn.push("Could not inspect the local ProofKit Web Viewer add-on on this platform.");
  }

  if (hasRequiredLayouts === false) {
    const instructions = getFmAddonInstallInstructions("wv");
    messages.warn.push(
      "ProofKit Web Viewer layouts were not detected in your FileMaker file. The add-on may not be installed in the file yet.",
    );
    if (inspection.status === "missing") {
      messages.warn.push(
        `Local ProofKit Web Viewer add-on files were not found. Run \`${inspection.installCommand}\` before installing the add-on into the FileMaker file.`,
      );
      messages.nextSteps.push(inspection.installCommand);
    }
    if (inspection.status === "unknown" && inspection.reason !== "unsupported-platform") {
      messages.warn.push(
        "Could not determine the local ProofKit Web Viewer add-on version. Reinstall it explicitly if you need the latest local files.",
      );
      messages.nextSteps.push(inspection.installCommand);
    }
    messages.info.push(
      chalk.bgYellow(" ACTION REQUIRED: ") +
        ` Install or update the ProofKit Web Viewer add-on in your FileMaker file. ${chalk.dim(`(Learn more: ${instructions.docsUrl})`)}`,
    );
    for (const step of instructions.steps) {
      messages.info.push(step);
    }
  }

  return messages;
}

export async function ensureWebViewerAddonInstalled() {
  const status = await checkForWebViewerLayouts();
  const messages = getWebViewerAddonMessages(status);

  for (const message of messages.warn) {
    console.log(chalk.yellow(message));
  }
  for (const message of messages.info) {
    console.log(message);
  }

  return status;
}
