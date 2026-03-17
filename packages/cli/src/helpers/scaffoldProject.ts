import path from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import fs from "fs-extra";
import ora from "ora";

import { PKG_ROOT } from "~/consts.js";
import type { InstallerOptions } from "~/installers/index.js";
import { isNonInteractiveMode, state } from "~/state.js";
import { logger } from "~/utils/logger.js";

const AGENT_METADATA_DIRS = new Set([".agents", ".claude", ".clawed", ".clinerules", ".cursor", ".windsurf"]);

function getMeaningfulDirectoryEntries(projectDir: string): string[] {
  return fs.readdirSync(projectDir).filter((entry) => {
    if (AGENT_METADATA_DIRS.has(entry)) {
      return false;
    }

    if (entry === ".gitignore") {
      return true;
    }

    if (entry.startsWith(".")) {
      return false;
    }

    return true;
  });
}

// This bootstraps the base Next.js application
export const scaffoldProject = async ({
  projectName,
  pkgManager,
  noInstall,
  force = false,
}: InstallerOptions & { force?: boolean }) => {
  const projectDir = state.projectDir;

  const srcDir = path.join(
    PKG_ROOT,
    state.appType === "browser"
      ? `template/${state.ui === "mantine" ? "nextjs-mantine" : "nextjs-shadcn"}`
      : "template/vite-wv",
  );

  if (noInstall) {
    logger.info("");
  } else {
    logger.info(`\nUsing: ${chalk.cyan.bold(pkgManager)}\n`);
  }

  const spinner = ora(`Scaffolding in: ${projectDir}...\n`).start();

  if (fs.existsSync(projectDir)) {
    const meaningfulEntries = getMeaningfulDirectoryEntries(projectDir);

    if (meaningfulEntries.length === 0) {
      if (projectName !== ".") {
        spinner.info(`${chalk.cyan.bold(projectName)} exists but is empty, continuing...\n`);
      }
    } else if (force) {
      spinner.info(
        `${chalk.yellow("Force mode enabled:")} clearing ${chalk.cyan.bold(projectName)} before scaffolding...\n`,
      );
      fs.emptyDirSync(projectDir);
      spinner.start();
      // continue to scaffold after clearing
    } else if (isNonInteractiveMode()) {
      spinner.fail(
        `${chalk.redBright.bold("Error:")} ${chalk.cyan.bold(
          projectName,
        )} already exists and isn't empty. Remove the existing files or choose a different directory.`,
      );
      throw new Error(
        `Cannot initialize into a non-empty directory in non-interactive mode: ${meaningfulEntries.join(", ")}`,
      );
    } else {
      spinner.stopAndPersist();
      const overwriteDir = await p.select({
        message: `${chalk.redBright.bold("Warning:")} ${chalk.cyan.bold(
          projectName,
        )} already exists and isn't empty. How would you like to proceed?`,
        options: [
          {
            label: "Abort installation (recommended)",
            value: "abort",
          },
          {
            label: "Clear the directory and continue installation",
            value: "clear",
          },
          {
            label: "Continue installation and overwrite conflicting files",
            value: "overwrite",
          },
        ],
        initialValue: "abort",
      });
      if (overwriteDir === "abort") {
        spinner.fail("Aborting installation...");
        process.exit(1);
      }

      const overwriteAction = overwriteDir === "clear" ? "clear the directory" : "overwrite conflicting files";

      const confirmOverwriteDir = await p.confirm({
        message: `Are you sure you want to ${overwriteAction}?`,
        initialValue: false,
      });

      if (!confirmOverwriteDir) {
        spinner.fail("Aborting installation...");
        process.exit(1);
      }

      if (overwriteDir === "clear") {
        spinner.info(`Emptying ${chalk.cyan.bold(projectName)} and creating new ProofKit app..\n`);
        fs.emptyDirSync(projectDir);
      }
    }
  }

  spinner.start();

  // Copy the main template
  fs.copySync(srcDir, projectDir);

  // Rename gitignore
  fs.renameSync(path.join(projectDir, "_gitignore"), path.join(projectDir, ".gitignore"));

  const scaffoldedName = projectName === "." ? "App" : chalk.cyan.bold(projectName);

  spinner.succeed(`${scaffoldedName} ${chalk.green("scaffolded successfully!")}\n`);
};
