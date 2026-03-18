import os from "node:os";
import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";

import { PKG_ROOT } from "~/consts.js";
import { logger } from "~/utils/logger.js";

export async function installFmAddon({ addonName }: { addonName: "auth" | "wv" }) {
  const addonDisplayName = addonName === "auth" ? "FM Auth Add-on" : "ProofKit WebViewer";

  let targetDir: string | null = null;
  if (process.platform === "win32") {
    targetDir = path.join(os.homedir(), "AppData", "Local", "FileMaker", "Extensions", "AddonModules");
  } else if (process.platform === "darwin") {
    targetDir = path.join(os.homedir(), "Library", "Application Support", "FileMaker", "Extensions", "AddonModules");
  }

  if (!targetDir) {
    logger.warn(`Could not install the ${addonDisplayName} addon. You will need to do this manually.`);
    return;
  }

  const addonDir = addonName === "auth" ? "ProofKitAuth" : "ProofKitWV";

  await fs.copy(path.join(PKG_ROOT, `template/fm-addon/${addonDir}`), path.join(targetDir, addonDir), {
    overwrite: true,
  });

  console.log("");
  console.log(chalk.bgYellow(" ACTION REQUIRED: "));
  if (addonName === "auth") {
    console.log(
      `${chalk.yellowBright(
        "You must install the FM Auth addon in your FileMaker file to continue.",
      )} ${chalk.dim("(Learn more: https://proofkit.dev/auth/fm-addon)")}`,
    );
  } else {
    console.log(
      `${chalk.yellowBright(
        "You must install the ProofKit WebViewer addon in your FileMaker file to continue.",
      )} ${chalk.dim("(Learn more: https://proofkit.dev/webviewer)")}`,
    );
  }
  const steps = [
    "Restart FileMaker Pro (if it's currently running)",
    `Open your FileMaker file, go to layout mode, and install the ${addonDisplayName} addon to the file`,
    "Come back here to continue the installation",
  ];
  steps.forEach((step, index) => {
    console.log(`${index + 1}. ${step}`);
  });
}
