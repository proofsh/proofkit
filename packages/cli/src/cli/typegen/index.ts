import { Command } from "commander";

import { runCodegenCommand } from "~/generators/fmdapi.js";
import type { Settings } from "~/utils/parseSettings.js";
import { ensureProofKitProject } from "../utils.js";

export async function runTypegen(_opts: { settings: Settings }) {
  await runCodegenCommand();
}

export const makeTypegenCommand = () => {
  const typegenCommand = new Command("typegen").description("Generate types for your project").action(runTypegen);

  typegenCommand.hook("preAction", (_thisCommand, actionCommand) => {
    const settings = ensureProofKitProject({ commandName: "typegen" });
    actionCommand.setOptionValue("settings", settings);
  });

  return typegenCommand;
};
