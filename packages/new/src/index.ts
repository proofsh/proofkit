#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { make, run, withDescription, withHandler, withSubcommands } from "@effect/cli/Command";
import { layer } from "@effect/platform-node/NodeContext";
import { runMain } from "@effect/platform-node/NodeRuntime";
import { Effect } from "effect";
import { makeInitCommand } from "~/cli/init.js";
import { cliName } from "~/consts.js";

function getVersion() {
  try {
    const packageJsonPath = new URL("../package.json", import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
    return packageJson.version ?? "0.0.0-private";
  } catch {
    return "0.0.0-private";
  }
}

const rootCommand = make(cliName).pipe(
  withHandler(() => Effect.void),
  withDescription("Internal scaffold package for the next ProofKit CLI"),
  withSubcommands([makeInitCommand()]),
);

const cli = run(rootCommand, {
  name: "ProofKit New",
  version: getVersion(),
});

runMain(cli(process.argv).pipe(Effect.provide(layer)));
