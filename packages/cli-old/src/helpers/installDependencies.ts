import chalk from "chalk";
import { execa, type StdoutStderrOption } from "execa";
import ora, { type Ora } from "ora";

import { state } from "~/state.js";
import { getUserPkgManager, type PackageManager } from "~/utils/getUserPkgManager.js";
import { logger } from "~/utils/logger.js";

const execWithSpinner = async (
  projectDir: string,
  pkgManager: PackageManager | "pnpx" | "bunx",
  options: {
    args?: string[];
    stdout?: StdoutStderrOption;
    onDataHandle?: (spinner: Ora) => (data: Buffer) => void;
    loadingMessage?: string;
  },
) => {
  const { onDataHandle, args = ["install"], stdout = "pipe" } = options;

  if (process.env.PROOFKIT_ENV === "development") {
    args.push("--prefer-offline");
  }

  const spinner = ora(options.loadingMessage ?? `Running ${pkgManager} ${args.join(" ")} ...`).start();
  const subprocess = execa(pkgManager, args, {
    cwd: projectDir,
    stdout,
    stderr: "pipe", // Capture stderr to get error messages
  });

  await new Promise<void>((res, rej) => {
    let stdoutOutput = "";
    let stderrOutput = "";

    if (onDataHandle) {
      subprocess.stdout?.on("data", onDataHandle(spinner));
    } else {
      // If no custom handler, capture stdout for error reporting
      subprocess.stdout?.on("data", (data) => {
        stdoutOutput += data.toString();
      });
    }

    // Capture stderr output for error reporting
    subprocess.stderr?.on("data", (data) => {
      stderrOutput += data.toString();
    });

    subprocess.on("error", (e) => rej(e));
    subprocess.on("close", (code) => {
      if (code === 0) {
        res();
      } else {
        // Combine stdout and stderr for complete error message
        const combinedOutput = [stdoutOutput, stderrOutput]
          .filter((output) => output.trim())
          .join("\n")
          .trim()
          // Remove spinner-related lines that aren't useful in error output
          .replace(/^- Checking registry\.$/gm, "")
          .replace(/^\s*$/gm, "") // Remove empty lines
          .trim();

        const errorMessage = combinedOutput || `Command failed with exit code ${code}: ${pkgManager} ${args.join(" ")}`;
        rej(new Error(errorMessage));
      }
    });
  });

  return spinner;
};

const runInstallCommand = async (pkgManager: PackageManager, projectDir: string): Promise<Ora | null> => {
  switch (pkgManager) {
    // When using npm, inherit the stderr stream so that the progress bar is shown
    case "npm":
      await execa(pkgManager, ["install"], {
        cwd: projectDir,
        stderr: "inherit",
      });

      return null;
    // When using yarn or pnpm, use the stdout stream and ora spinner to show the progress
    case "pnpm":
      return execWithSpinner(projectDir, pkgManager, {
        onDataHandle: (spinner) => (data) => {
          const text = data.toString();

          if (text.includes("Progress")) {
            spinner.text = text.includes("|") ? (text.split(" | ")[1] ?? "") : text;
          }
        },
      });
    case "yarn":
      return execWithSpinner(projectDir, pkgManager, {
        onDataHandle: (spinner) => (data) => {
          spinner.text = data.toString();
        },
      });
    // When using bun, the stdout stream is ignored and the spinner is shown
    case "bun":
      return execWithSpinner(projectDir, pkgManager, { stdout: "ignore" });
    default:
      throw new Error(`Unknown package manager: ${pkgManager}`);
  }
};

export const installDependencies = async (args?: { projectDir?: string }) => {
  const { projectDir = state.projectDir } = args ?? {};
  logger.info("Installing dependencies...");
  const pkgManager = getUserPkgManager();

  const installSpinner = await runInstallCommand(pkgManager, projectDir);

  // If the spinner was used to show the progress, use succeed method on it
  // If not, use the succeed on a new spinner
  (installSpinner ?? ora()).succeed(chalk.green("Successfully installed dependencies!\n"));
};

export const runExecCommand = async ({
  command,
  projectDir = state.projectDir,
  successMessage,
  errorMessage,
  loadingMessage,
}: {
  command: string[];
  projectDir?: string;
  successMessage?: string;
  errorMessage?: string;
  loadingMessage?: string;
}) => {
  let spinner: Ora | null = null;

  try {
    spinner = await _runExecCommand({
      projectDir,
      command,
      loadingMessage,
    });

    // If the spinner was used to show the progress, use succeed method on it
    // If not, use the succeed on a new spinner
    (spinner ?? ora()).succeed(
      chalk.green(successMessage ? `${successMessage}\n` : `Successfully ran ${command.join(" ")}!\n`),
    );
  } catch (error) {
    // If we have a spinner, fail it, otherwise just throw the error
    if (spinner) {
      const failMessage = errorMessage || `Failed to run ${command.join(" ")}`;
      spinner.fail(chalk.red(failMessage));
    }
    throw error;
  }
};

export const _runExecCommand = async ({
  projectDir,
  command,
  loadingMessage,
}: {
  projectDir: string;
  exec?: boolean;
  command: string[];
  loadingMessage?: string;
}): Promise<Ora | null> => {
  const pkgManager = getUserPkgManager();
  switch (pkgManager) {
    // When using npm, capture both stdout and stderr to show error messages
    case "npm": {
      const result = await execa("npx", [...command], {
        cwd: projectDir,
        stdout: "pipe",
        stderr: "pipe",
        reject: false,
      });

      if (result.exitCode !== 0) {
        // Combine stdout and stderr for complete error message
        const combinedOutput = [result.stdout, result.stderr]
          .filter((output) => output?.trim())
          .join("\n")
          .trim()
          // Remove spinner-related lines that aren't useful in error output
          .replace(/^- Checking registry\.$/gm, "")
          .replace(/^\s*$/gm, "") // Remove empty lines
          .trim();

        const errorMessage =
          combinedOutput || `Command failed with exit code ${result.exitCode}: npx ${command.join(" ")}`;
        throw new Error(errorMessage);
      }

      return null;
    }
    // When using yarn or pnpm, use the stdout stream and ora spinner to show the progress
    case "pnpm": {
      // For shadcn commands, don't use progress handler to capture full output
      const isInstallCommand = command.includes("install");
      return execWithSpinner(projectDir, "pnpm", {
        args: ["dlx", ...command],
        loadingMessage,
        onDataHandle: isInstallCommand
          ? (spinner) => (data) => {
              const text = data.toString();

              if (text.includes("Progress")) {
                spinner.text = text.includes("|") ? (text.split(" | ")[1] ?? "") : text;
              }
            }
          : undefined,
      });
    }
    case "yarn": {
      // For shadcn commands, don't use progress handler to capture full output
      const isYarnInstallCommand = command.includes("install");
      return execWithSpinner(projectDir, pkgManager, {
        args: [...command],
        loadingMessage,
        onDataHandle: isYarnInstallCommand
          ? (spinner) => (data) => {
              spinner.text = data.toString();
            }
          : undefined,
      });
    }
    // When using bun, the stdout stream is ignored and the spinner is shown
    case "bun":
      return execWithSpinner(projectDir, "bunx", {
        stdout: "ignore",
        args: [...command],
        loadingMessage,
      });
    default:
      throw new Error(`Unknown package manager: ${pkgManager}`);
  }
};

export function generateRandomSecret(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
