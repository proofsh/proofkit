#!/usr/bin/env node
import { intro } from "@clack/prompts";
import { Command } from "commander";
import { makeInitCommand } from "~/cli/init.js";
import { cliName } from "~/consts.js";
import { UserAbortedError } from "~/core/errors.js";

const program = new Command();
program.name(cliName).description("Internal scaffold package for the next ProofKit CLI");
program.addCommand(makeInitCommand());

const main = async () => {
  intro("ProofKit New");
  await program.parseAsync(process.argv);
};

main().catch((error) => {
  if (error instanceof UserAbortedError) {
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
