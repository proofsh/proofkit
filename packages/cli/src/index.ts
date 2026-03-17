#!/usr/bin/env node --no-warnings
import { intro } from "@clack/prompts";
import chalk from "chalk";
import { Command } from "commander";
import { makeInitCommand, runInit } from "~/cli/init.js";
import { logger } from "~/utils/logger.js";
import { proofGradient, renderTitle } from "~/utils/renderTitle.js";
import { makeAddCommand } from "./cli/add/index.js";
import { makeDeployCommand } from "./cli/deploy/index.js";
import { runMenu } from "./cli/menu.js";
import { makeRemoveCommand } from "./cli/remove/index.js";
import { makeTypegenCommand } from "./cli/typegen/index.js";
import { makeUpgradeCommand } from "./cli/update/makeUpgradeCommand.js";
import { UserAbortedError } from "./cli/utils.js";
import { npmName } from "./consts.js";
import { ciOption, nonInteractiveOption } from "./globalOptions.js";
import { initProgramState, isNonInteractiveMode } from "./state.js";
import { getVersion } from "./utils/getProofKitVersion.js";
import { getSettings, type Settings } from "./utils/parseSettings.js";
import { checkAndRenderVersionWarning } from "./utils/renderVersionWarning.js";

const version = getVersion();

const main = async () => {
  const program = new Command();
  renderTitle();
  if (process.env.PROOFKIT_SKIP_VERSION_CHECK !== "1") {
    await checkAndRenderVersionWarning();
  }

  program
    .name(npmName)
    .version(version)
    .command("default", { hidden: true, isDefault: true })
    .addOption(ciOption)
    .addOption(nonInteractiveOption)
    .action(async (args) => {
      initProgramState(args);

      let settings: Settings | undefined;
      try {
        settings = getSettings();
      } catch {
        // void
      }

      if (isNonInteractiveMode()) {
        throw new Error(
          "The default command is interactive-only in non-interactive mode. Run an explicit command such as `proofkit init <name> --non-interactive`.",
        );
      }

      if (settings) {
        intro(`Found ${proofGradient("ProofKit")} project`);
        await runMenu();
      } else {
        intro(`No ${proofGradient("ProofKit")} project found, running \`init\``);
        await runInit();
      }
    })
    .addHelpText("afterAll", `\n The ProofKit CLI was inspired by the ${chalk.hex("#E8DCFF").bold("t3 stack")}\n`);

  program.addCommand(makeInitCommand());
  program.addCommand(makeAddCommand());
  program.addCommand(makeRemoveCommand());
  program.addCommand(makeTypegenCommand());
  program.addCommand(makeDeployCommand());
  program.addCommand(makeUpgradeCommand());

  await program.parseAsync(process.argv);
  process.exit(0);
};

main().catch((err) => {
  if (err instanceof UserAbortedError) {
    process.exit(0);
  } else if (err instanceof Error) {
    logger.error("Aborting installation...");
    logger.error(err);
  } else {
    logger.error("An unknown error has occurred. Please open an issue on github with the below:");
    console.log(err);
  }
  process.exit(1);
});
