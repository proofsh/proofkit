import { runCli } from "@proofkit/typegen/cli";

export interface TypegenOptions {
  config?: string;
  envPath?: string;
  proofkitToken?: string;
  resetOverrides?: boolean;
}

/**
 * Thin alias to the `@proofkit/typegen` CLI. All config reading, validation, and
 * generation lives in that package; we only map flags to its arg list so there is
 * no duplicated logic to drift.
 */
export async function runTypegen(options: TypegenOptions = {}) {
  const args: string[] = [];
  if (options.config) {
    args.push("--config", options.config);
  }
  if (options.envPath) {
    args.push("--env-path", options.envPath);
  }
  if (options.proofkitToken) {
    args.push("--proofkit-token", options.proofkitToken);
  }
  if (options.resetOverrides) {
    args.push("--reset-overrides");
  }
  await runCli(args);
}
