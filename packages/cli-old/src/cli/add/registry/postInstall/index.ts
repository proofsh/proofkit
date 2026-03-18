import type { PostInstallStep } from "@proofkit/registry";

import { addToEnv } from "~/utils/addToEnvs.js";
import { logger } from "~/utils/logger.js";
import { addScriptToPackageJson } from "./package-script.js";
import { wrapProvider } from "./wrap-provider.js";

export async function processPostInstallStep(step: PostInstallStep) {
  if (step.action === "package.json script") {
    addScriptToPackageJson(step);
  } else if (step.action === "wrap provider") {
    await wrapProvider(step);
  } else if (step.action === "next-steps") {
    logger.info(step.data.message);
  } else if (step.action === "env") {
    await addToEnv({
      envs: step.data.envs,
    });
  } else {
    logger.error(`Unknown post-install step: ${step}`);
  }
}
