import { cancel, select } from "@clack/prompts";
import chalk from "chalk";
import { Command } from "commander";
import { z } from "zod/v4";

import { addAuth } from "~/generators/auth.js";
import { ciOption, debugOption, nonInteractiveOption } from "~/globalOptions.js";
import { initProgramState, isNonInteractiveMode, state } from "~/state.js";
import { getSettings } from "~/utils/parseSettings.js";
import { abortIfCancel } from "../utils.js";

export async function runAddAuthAction() {
  const settings = getSettings();
  if (settings.appType !== "browser") {
    return cancel("Auth is not supported for your app type.");
  }
  if (settings.ui === "shadcn") {
    return cancel("Adding auth is not yet supported for shadcn-based projects.");
  }

  const authType =
    state.authType ??
    abortIfCancel(
      await select({
        message: "What auth provider do you want to use?",
        options: [
          {
            value: "fmaddon",
            label: "FM Add-on Auth",
            hint: "Self-hosted auth with email/password",
          },
          {
            value: "clerk",
            label: "Clerk",
            hint: "Hosted auth service with many providers",
          },
        ],
      }),
    );

  const type = z.enum(["clerk", "fmaddon"]).parse(authType);
  state.authType = type;

  if (type === "fmaddon") {
    const emailProviderAnswer =
      state.emailProvider ??
      (isNonInteractiveMode() ? "none" : undefined) ??
      abortIfCancel(
        await select({
          message: `What email provider do you want to use?\n${chalk.dim(
            "Used to send email verification codes. If you skip this, the codes will be displayed here in your terminal.",
          )}`,
          options: [
            {
              label: "Resend",
              value: "resend",
              hint: "Great dev experience",
            },
            {
              label: "Plunk",
              value: "plunk",
              hint: "Cheapest for <20k emails/mo, self-hostable",
            },
            { label: "Other / I'll do it myself later", value: "none" },
          ],
        }),
      );

    const emailProvider = z.enum(["plunk", "resend", "none"]).parse(emailProviderAnswer);

    state.emailProvider = emailProvider;

    await addAuth({
      options: {
        type,
        emailProvider: emailProvider === "none" ? undefined : emailProvider,
      },
    });
  } else {
    await addAuth({ options: { type } });
  }
}

export const makeAddAuthCommand = () => {
  const addAuthCommand = new Command("auth")
    .description("Add authentication to your project")
    .option("--authType <authType>", "Type of auth provider to use")
    .option("--emailProvider <emailProvider>", "Email provider to use (only for FM Add-on Auth)")
    .option("--apiKey <apiKey>", "API key to use for the email provider (only for FM Add-on Auth)")
    .addOption(ciOption)
    .addOption(nonInteractiveOption)
    .addOption(debugOption)

    .action(async () => {
      const settings = getSettings();
      if (settings.ui === "shadcn") {
        throw new Error("Shadcn projects should add auth using the template registry");
      }
      if (settings.auth.type !== "none") {
        throw new Error("Auth already exists");
      }
      await runAddAuthAction();
    });

  addAuthCommand.hook("preAction", (thisCommand) => {
    initProgramState(thisCommand.opts());
  });

  return addAuthCommand;
};
