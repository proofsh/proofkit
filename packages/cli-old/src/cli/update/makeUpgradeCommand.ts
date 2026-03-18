import { Command } from "commander";

import { ciOption } from "~/globalOptions.js";
import { initProgramState, state } from "~/state.js";
import { ensureProofKitProject } from "../utils.js";
import { runUpgrade } from "./index.js";

export const makeUpgradeCommand = () => {
  const upgradeCommand = new Command("upgrade")
    .description("Upgrade ProofKit components in your project")
    .addOption(ciOption)
    .action(async (args) => {
      initProgramState(args);

      await runUpgrade();
    });

  upgradeCommand.hook("preAction", (_thisCommand, _actionCommand) => {
    initProgramState(_actionCommand.opts());
    state.baseCommand = "upgrade";
    ensureProofKitProject({ commandName: "upgrade" });
  });

  return upgradeCommand;
};
