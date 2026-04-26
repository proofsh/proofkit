import { logger } from "~/utils/logger.js";
import { runAddAddonAction } from "./addon.js";

const ADDON_ONLY_MESSAGE = "Only `proofkit add addon <target>` is supported.";

export const runAdd = async (name: string | undefined, options?: { noInstall?: boolean; target?: string }) => {
  if (name === "addon") {
    return await runAddAddonAction(options?.target);
  }
  logger.error(ADDON_ONLY_MESSAGE);
  throw new Error(ADDON_ONLY_MESSAGE);
};
