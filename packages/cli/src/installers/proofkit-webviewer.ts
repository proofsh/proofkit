import path from "node:path";
import type { OttoAPIKey } from "@proofkit/fmdapi";
import chalk from "chalk";
import dotenv from "dotenv";
import { getLayouts } from "~/cli/fmdapi.js";
import * as p from "~/cli/prompts.js";
import { abortIfCancel, UserAbortedError } from "~/cli/utils.js";
import { state } from "~/state.js";
import { getSettings } from "~/utils/parseSettings.js";
import { installFmAddon } from "./install-fm-addon.js";

export async function checkForWebViewerLayouts(): Promise<boolean> {
  const settings = getSettings();

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
    return false;
  }
  if (settings.envFile) {
    dotenv.config({
      path: path.join(state.projectDir, settings.envFile),
    });
  }
  const dataApiKey = process.env[dataSource.envNames.apiKey] as OttoAPIKey | undefined;
  const fmFile = process.env[dataSource.envNames.database];
  const server = process.env[dataSource.envNames.server];

  if (!(dataApiKey && fmFile && server)) {
    return false;
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

  if (allWebViewerLayoutsExist) {
    console.log(
      chalk.green("Successfully detected all required layouts for ProofKit WebViewer in your FileMaker file."),
    );
    return true;
  }

  await installFmAddon({ addonName: "wv" });

  return false;
}

export async function ensureWebViewerAddonInstalled() {
  let hasWebViewerLayouts = false;
  while (!hasWebViewerLayouts) {
    hasWebViewerLayouts = await checkForWebViewerLayouts();

    if (!hasWebViewerLayouts) {
      const shouldContinue = abortIfCancel<boolean>(
        await p.confirm({
          message: "I have followed the above instructions, continue installing",
          initialValue: true,
        }),
      );

      if (!shouldContinue) {
        throw new UserAbortedError();
      }
    }
  }
}
