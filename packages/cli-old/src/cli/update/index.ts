import chalk from "chalk";
import { Command } from "commander";

import { initProgramState, state } from "~/state.js";
import { runAllAvailableUpgrades } from "~/upgrades/index.js";
import { logger } from "~/utils/logger.js";
import { ensureProofKitProject } from "../utils.js";

export const runUpgrade = async () => {
  initProgramState({});
  state.baseCommand = "upgrade";
  ensureProofKitProject({ commandName: "upgrade" });

  logger.info("\nUpgrading ProofKit components...\n");

  try {
    await runAllAvailableUpgrades();
    logger.info(chalk.green("✔ Successfully upgraded components\n"));
  } catch (error) {
    logger.error("Failed to upgrade components:", error);
    process.exit(1);
  }
};

export const upgrade = new Command()
  .name("upgrade")
  .description("Upgrade ProofKit components in your project")
  .action(runUpgrade);
