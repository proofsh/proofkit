import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import type { Project } from "ts-morph";
import type { PackageJson } from "type-fest";
import * as p from "~/cli/prompts.js";

import { abortIfCancel } from "~/cli/utils.js";
import { PKG_ROOT } from "~/consts.js";
import { installDependencies } from "~/helpers/installDependencies.js";
import { isNonInteractiveMode, state } from "~/state.js";
import { addPackageDependency } from "~/utils/addPackageDependency.js";
import { addToEnv } from "~/utils/addToEnvs.js";
import { logger } from "~/utils/logger.js";
import { getSettings, setSettings } from "~/utils/parseSettings.js";
import { formatAndSaveSourceFiles, getNewProject } from "~/utils/ts-morph.js";

export async function installReactEmail({
  ...args
}: {
  project?: Project;
  noInstall?: boolean;
  installServerFiles?: boolean;
}) {
  const projectDir = state.projectDir;

  // Exit early if already installed
  const settings = getSettings();
  if (settings.ui === "shadcn") {
    return false;
  }
  if (settings.reactEmail) {
    return false;
  }

  // Ensure emails directory exists
  fs.ensureDirSync(path.join(projectDir, "src/emails"));
  addPackageDependency({
    dependencies: ["@react-email/components", "@react-email/render"],
    devMode: false,
    projectDir,
  });
  addPackageDependency({
    dependencies: ["react-email", "@react-email/preview-server"],
    devMode: true,
    projectDir,
  });

  // add a script to package.json
  const pkgJson = fs.readJSONSync(path.join(projectDir, "package.json")) as PackageJson;
  if (!pkgJson.scripts) {
    pkgJson.scripts = {};
  }
  pkgJson.scripts["email:preview"] = "email dev --port 3010 --dir=src/emails";
  fs.writeJSONSync(path.join(projectDir, "package.json"), pkgJson, {
    spaces: 2,
  });

  const project = args.project ?? getNewProject(projectDir);

  if (args.installServerFiles) {
    const emailProvider = state.emailProvider;
    if (emailProvider === "plunk") {
      await installPlunk({ project });
    } else if (emailProvider === "resend") {
      await installResend({ project });
    } else {
      await fs.copy(
        path.join(PKG_ROOT, "template/extras/emailProviders/none/email.tsx"),
        path.join(projectDir, "src/server/auth/email.tsx"),
      );
    }
  }

  // Copy base email template(s) into src/emails for preview and reuse
  await fs.copy(
    path.join(PKG_ROOT, "template/extras/emailTemplates/generic.tsx"),
    path.join(projectDir, "src/emails/generic.tsx"),
  );
  if (args.installServerFiles) {
    await fs.copy(
      path.join(PKG_ROOT, "template/extras/emailTemplates/auth-code.tsx"),
      path.join(projectDir, "src/emails/auth-code.tsx"),
    );
  }

  if (!args.project) {
    await formatAndSaveSourceFiles(project);
  }

  // Mark as installed
  setSettings({
    ...settings,
    reactEmail: true,
    reactEmailServer: Boolean(args.installServerFiles) || settings.reactEmailServer,
  });

  // Install dependencies unless explicitly skipped
  if (!args.noInstall) {
    await installDependencies({ projectDir });
  }
  return true;
}

export async function installPlunk({ project }: { project?: Project }) {
  const projectDir = state.projectDir;
  addPackageDependency({
    dependencies: ["@plunk/node"],
    devMode: false,
    projectDir,
  });

  let apiKey: string;
  if (typeof state.apiKey === "string") {
    apiKey = state.apiKey;
  } else if (isNonInteractiveMode()) {
    apiKey = "";
  } else {
    apiKey = abortIfCancel(
      await p.text({
        message: `Enter your Plunk API key\n${chalk.dim(
          "Enter your Secret API Key from https://app.useplunk.com/settings/api",
        )}`,
      }),
    );
  }

  if (!apiKey) {
    logger.warn("You will need to add your Plunk API key to the .env file manually for your app to run.");
  }

  console.log("");

  await addToEnv({
    projectDir,
    project,
    envs: [
      {
        name: "PLUNK_API_KEY",
        zodValue: `z.string().startsWith("sk_")`,
        type: "server",
        defaultValue: apiKey,
      },
    ],
  });

  await fs.copy(
    path.join(PKG_ROOT, "template/extras/emailProviders/plunk/service.ts"),
    path.join(projectDir, "src/server/services/plunk.ts"),
  );

  await fs.copy(
    path.join(PKG_ROOT, "template/extras/emailProviders/plunk/email.tsx"),
    path.join(projectDir, "src/server/auth/email.tsx"),
  );
}

export async function installResend({ project }: { project?: Project }) {
  const projectDir = state.projectDir;
  addPackageDependency({
    dependencies: ["resend"],
    devMode: false,
    projectDir,
  });

  let apiKey: string;
  if (typeof state.apiKey === "string") {
    apiKey = state.apiKey;
  } else if (isNonInteractiveMode()) {
    apiKey = "";
  } else {
    apiKey = abortIfCancel(
      await p.text({
        message: `Enter your Resend API key\n${chalk.dim(
          `Only "Sending Access" permission required: https://resend.com/api-keys`,
        )}`,
      }),
    );
  }

  if (!apiKey) {
    logger.warn("You will need to add your Resend API key to the .env file manually for your app to run.");
  }

  console.log("");

  await addToEnv({
    projectDir,
    project,
    envs: [
      {
        name: "RESEND_API_KEY",
        zodValue: `z.string().startsWith("re_")`,
        type: "server",
        defaultValue: apiKey,
      },
    ],
  });

  await fs.copy(
    path.join(PKG_ROOT, "template/extras/emailProviders/resend/service.ts"),
    path.join(projectDir, "src/server/services/resend.ts"),
  );

  await fs.copy(
    path.join(PKG_ROOT, "template/extras/emailProviders/resend/email.tsx"),
    path.join(projectDir, "src/server/auth/email.tsx"),
  );
}
