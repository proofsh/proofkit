import { injectTanstackQuery } from "~/generators/tanstack-query.js";
import { installDependencies } from "~/helpers/installDependencies.js";
import type { TPostInstallFn } from "../types.js";
import { postInstallTable } from "./table.js";

export const postInstallTableInfinite: TPostInstallFn = async (args) => {
  await postInstallTable(args);
  const didInject = await injectTanstackQuery();
  if (didInject) {
    await installDependencies();
  }
};
