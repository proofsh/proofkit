import { Command } from "commander";
import { select } from "~/cli/prompts.js";
import { debugOption, nonInteractiveOption } from "~/globalOptions.js";
import { installFmAddonExplicitly } from "~/installers/install-fm-addon.js";
import { initProgramState, isNonInteractiveMode } from "~/state.js";
import { abortIfCancel } from "../utils.js";

type AddonTarget = "webviewer" | "auth";

async function resolveAddonTarget(name?: string): Promise<AddonTarget> {
  if (name === "webviewer" || name === "auth") {
    return name;
  }

  if (isNonInteractiveMode()) {
    throw new Error("Addon target is required in non-interactive mode. Use `proofkit add addon webviewer`.");
  }

  return abortIfCancel(
    await select({
      message: "Which add-on do you want to install locally?",
      options: [
        { value: "webviewer", label: "Web Viewer", hint: "ProofKit Web Viewer add-on" },
        { value: "auth", label: "Auth", hint: "ProofKit Auth add-on" },
      ],
    }),
  ) as AddonTarget;
}

export async function runAddAddonAction(targetName?: string) {
  const target = await resolveAddonTarget(targetName);

  await installFmAddonExplicitly({ addonName: target === "webviewer" ? "wv" : "auth" });
}

export const makeAddAddonCommand = () => {
  const addAddonCommand = new Command("addon")
    .description("Install or update local FileMaker add-on files")
    .argument("[target]", "Add-on to install locally (webviewer or auth)")
    .addOption(nonInteractiveOption)
    .addOption(debugOption)
    .action(async (target) => {
      await runAddAddonAction(target);
    });

  addAddonCommand.hook("preAction", (thisCommand) => {
    initProgramState(thisCommand.opts());
  });

  return addAddonCommand;
};
