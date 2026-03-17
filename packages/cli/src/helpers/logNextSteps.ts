import chalk from "chalk";

import { DEFAULT_APP_NAME } from "~/consts.js";
import type { InstallerOptions } from "~/installers/index.js";
import { state } from "~/state.js";
import { getUserPkgManager } from "~/utils/getUserPkgManager.js";
import { logger } from "~/utils/logger.js";

const formatRunCommand = (pkgManager: ReturnType<typeof getUserPkgManager>, command: string) =>
  ["npm", "bun"].includes(pkgManager) ? `${pkgManager} run ${command}` : `${pkgManager} ${command}`;

// This logs the next steps that the user should take in order to advance the project
export const logNextSteps = ({
  projectName = DEFAULT_APP_NAME,
  noInstall,
}: Pick<InstallerOptions, "projectName" | "noInstall">) => {
  const pkgManager = getUserPkgManager();

  logger.info(chalk.bold("Next steps:"));
  logger.dim("\nNavigate to the project directory:");
  projectName !== "." && logger.info(`  cd ${projectName}`);
  logger.dim("(or open in your code editor, and run the rest of these commands from there)");

  if (noInstall) {
    logger.dim("\nInstall dependencies:");
    // To reflect yarn's default behavior of installing packages when no additional args provided
    if (pkgManager === "yarn") {
      logger.info(`  ${pkgManager}`);
    } else {
      logger.info(`  ${pkgManager} install`);
    }
  }

  logger.dim("\nStart the dev server to view your app in a browser:");
  logger.info(`  ${formatRunCommand(pkgManager, "dev")}`);

  if (state.appType === "webviewer") {
    logger.dim("\nWhen you're ready to generate FileMaker clients:");
    logger.info(`  ${formatRunCommand(pkgManager, "typegen")}`);

    logger.dim("\nTo open the starter inside FileMaker once your file is ready:");
    logger.info(`  ${formatRunCommand(pkgManager, "launch-fm")}`);
  }

  logger.dim("\nOr, run the ProofKit command again to add more to your project:");
  logger.info(`  ${formatRunCommand(pkgManager, "proofkit")}`);
  logger.dim("(Must be inside the project directory)");
};
