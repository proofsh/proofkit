import path from "node:path";
import fg from "fast-glob";
import fs from "fs-extra";

import { state } from "~/state.js";
import { registryFetch } from "./http.js";

export async function getMetaFromRegistry(name: string) {
  const result = await registryFetch("@get/meta/:name", {
    params: { name },
  });

  if (result.error) {
    if (result.error.status === 404) {
      return null;
    }
    throw new Error(result.error.message);
  }

  return result.data;
}

const PROJECT_SHARED_IGNORE = ["**/node_modules/**", ".next", "public", "dist", "build"];

export async function getProjectInfo() {
  const cwd = state.projectDir || process.cwd();
  const [configFiles, isSrcDir] = await Promise.all([
    fg.glob("**/{next,vite,astro,app}.config.*|gatsby-config.*|composer.json|react-router.config.*", {
      cwd,
      deep: 3,
      ignore: PROJECT_SHARED_IGNORE,
    }),
    fs.pathExists(path.resolve(cwd, "src")),
  ]);

  const isUsingAppDir = await fs.pathExists(path.resolve(cwd, `${isSrcDir ? "src/" : ""}app`));

  // Next.js.
  if (configFiles.find((file) => file.startsWith("next.config."))?.length) {
    return isUsingAppDir ? "next-app" : "next-pages";
  }

  return "manual";
}
