import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { glob } from "glob";

import { installDependencies } from "~/helpers/installDependencies.js";
import { betterAuthInstaller } from "~/installers/better-auth.js";
import { clerkInstaller } from "~/installers/clerk.js";
import { proofkitAuthInstaller } from "~/installers/proofkit-auth.js";
import { state } from "~/state.js";
import { getSettings, mergeSettings } from "~/utils/parseSettings.js";

export async function addAuth({
  options,
  noInstall = false,
  projectDir = process.cwd(),
}: {
  options:
    | { type: "clerk" }
    | {
        type: "fmaddon";
        emailProvider?: "plunk" | "resend";
        apiKey?: string;
      }
    | { type: "better-auth" };
  projectDir?: string;
  noInstall?: boolean;
}) {
  const settings = getSettings();
  if (settings.ui === "shadcn") {
    throw new Error("Shadcn projects should add auth using the template registry");
  }
  if (settings.auth.type !== "none") {
    throw new Error("Auth already exists");
  }
  if (!settings.dataSources.some((o) => o.type === "fm") && options.type === "fmaddon") {
    throw new Error("A FileMaker data source is required to use the FM Add-on Auth");
  }
  if (!settings.dataSources.some((o) => o.type === "fm") && options.type === "better-auth") {
    throw new Error("A FileMaker data source is required to use the Better-Auth");
  }

  if (options.type === "clerk") {
    await addClerkAuth({ projectDir });
  } else if (options.type === "fmaddon") {
    await addFmaddonAuth();
  }

  // Replace actionClient with authedActionClient in all action files
  await replaceActionClientWithAuthed();

  if (!noInstall) {
    await installDependencies({ projectDir });
  }
}

async function addClerkAuth({ projectDir = process.cwd() }: { projectDir?: string }) {
  await clerkInstaller({ projectDir });
  mergeSettings({ auth: { type: "clerk" } });
}

async function addFmaddonAuth() {
  await proofkitAuthInstaller();
  mergeSettings({ auth: { type: "fmaddon" } });
}

async function replaceActionClientWithAuthed() {
  const projectDir = state.projectDir;
  const actionFiles = await glob("src/app/(main)/**/actions.ts", {
    cwd: projectDir,
  });

  for (const file of actionFiles) {
    const fullPath = path.join(projectDir, file);
    const content = readFileSync(fullPath, "utf-8");
    const updatedContent = content.replace(/actionClient/g, "authedActionClient");
    writeFileSync(fullPath, updatedContent);
  }
}

async function _addBetterAuth() {
  await betterAuthInstaller();
  mergeSettings({ auth: { type: "better-auth" } });
}
