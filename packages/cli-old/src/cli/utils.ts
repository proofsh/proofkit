import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import z, { ZodError } from "zod/v4";

import { cancel, isCancel } from "~/cli/prompts.js";
import { npmName } from "~/consts.js";
import { getSettings } from "~/utils/parseSettings.js";

/**
 * Runs before any add command is run. Checks if the user is in a ProofKit project and if the
 * proofkit.json file is valid.
 */
export const ensureProofKitProject = ({ commandName }: { commandName: string }) => {
  const settingsExists = fs.existsSync(path.join(process.cwd(), "proofkit.json"));
  if (!settingsExists) {
    console.log(
      chalk.yellow(
        `The "${commandName}" command requires an existing ProofKit project.
Please run " ${npmName} init" first, or try this command again when inside a ProofKit project.`,
      ),
    );
    process.exit(1);
  }

  try {
    return getSettings();
  } catch (error) {
    console.log(chalk.red("Error parsing ProofKit settings file:"));
    if (error instanceof ZodError) {
      console.log(z.prettifyError(error));
    } else {
      console.log(error);
    }

    process.exit(1);
  }
};

export class UserAbortedError extends Error {}
export function abortIfCancel(value: symbol | string): string;
export function abortIfCancel<T extends boolean>(value: symbol | T): T;
export function abortIfCancel<T extends string | boolean>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel();
    throw new UserAbortedError();
  }
  return value;
}
