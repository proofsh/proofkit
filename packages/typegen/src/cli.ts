#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { confirm } from "@clack/prompts";
import { program } from "@commander-js/extra-typings";
import chalk from "chalk";
import { config } from "dotenv";
import fs from "fs-extra";
import { parse } from "jsonc-parser";
import { startServer } from "./server";
import { generateTypedClients } from "./typegen";
import { typegenConfig } from "./types";

const defaultConfigPaths = ["proofkit-typegen.config.jsonc", "proofkit-typegen.config.json"];
const oldConfigPaths = ["fmschema.config.mjs", "fmschema.config.js"];
interface ConfigArgs {
  configLocation: string;
  resetOverrides?: boolean;
}

function init({ configLocation }: ConfigArgs) {
  console.log();
  if (fs.existsSync(configLocation)) {
    console.log(chalk.yellow(`⚠️ ${path.basename(configLocation)} already exists`));
  } else {
    const stubFile = fs.readFileSync(
      path.resolve(
        typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url)),
        "../../stubs/proofkit-typegen.config.jsonc",
      ),
      "utf8",
    );
    fs.writeFileSync(configLocation, stubFile, "utf8");
    console.log(`✅ Created config file: ${path.basename(configLocation)}`);
  }
}

async function runCodegen({ configLocation, resetOverrides = false }: ConfigArgs) {
  if (!fs.existsSync(configLocation)) {
    // but check if they have the old config and just need to upgrade...
    let hasOldConfig = false;
    for (const oldConfigPath of oldConfigPaths) {
      if (fs.existsSync(oldConfigPath)) {
        hasOldConfig = true;
        break;
      }
    }
    if (hasOldConfig) {
      console.log(
        chalk.yellow(
          "⚠️ You have an old config file from the @proofgeist/fmdapi package. Please upgrade to @proofkit/typegen by running `npx @proofgeist/fmdapi@latest upgrade`",
        ),
      );
      process.exit(1);
    } else {
      console.error(chalk.red(`Could not find ${path.basename(configLocation)} at the root of your project.`));
      console.log();

      const runInitNow = await confirm({
        message: "Would you like to initialize a new config file?",
        initialValue: true,
        active: "Yes",
        inactive: "No",
      });
      if (runInitNow) {
        init({ configLocation });
        process.exit(0);
      }
      process.exit(1);
    }
  }
  await fs.access(configLocation, fs.constants.R_OK).catch(() => {
    console.error(
      chalk.red(`You do not have read access to ${path.basename(configLocation)} at the root of your project.`),
    );
    return process.exit(1);
  });

  console.log(`🔍 Reading config from ${configLocation}`);

  const configRaw = fs.readFileSync(configLocation, "utf8");
  const configParsed = typegenConfig.safeParse(parse(configRaw));

  if (!configParsed.success) {
    console.error(chalk.red(`Error reading the config object from ${path.basename(configLocation)}.`));
    console.error(configParsed.error);
    return process.exit(1);
  }

  const result = await generateTypedClients(configParsed.data.config, {
    resetOverrides,
    postGenerateCommand: configParsed.data.postGenerateCommand,
    configPath: configLocation,
  }).catch((err: unknown) => {
    console.error(err);
    return process.exit(1);
  });
  if (result) {
    if (result.totalCount === 0) {
      console.log("⚠️ No layouts found to generate types for");
    } else if (result.totalCount === result.successCount) {
      console.log(`✅ Generated ${result.successCount} layout${result.successCount === 1 ? "" : "s"}`);
    } else if (result.errorCount === result.totalCount) {
      console.log("❌ Failed to generate any layouts");
    } else {
      console.log(`⚠️ Generated ${result.successCount} of ${result.totalCount} layouts`);
    }
  }
}

program
  .command("generate", { isDefault: true })
  .option("--config <filename>", "optional config file name")
  .option("--env-path <path>", "optional path to your .env file")
  .option(
    "--reset-overrides",
    "Recreate the overrides file(s), even if they already exist. Most useful when upgrading from @proofgeist/fmdapi",
    false,
  )
  .option("--skip-env-check", "(deprecated) Ignore loading environment variables from a file.", false)
  .action(async (options) => {
    const configPath = getConfigPath(options.config);
    const configLocation = path.toNamespacedPath(path.resolve(configPath ?? defaultConfigPaths[0] ?? ""));

    if (options.skipEnvCheck) {
      console.log(chalk.yellow("⚠️ You no longer need to use --skip-env-check"));
    }
    parseEnvs(options.envPath);

    // default command
    await runCodegen({
      configLocation,
      resetOverrides: options.resetOverrides,
    });
  });

program
  .command("init")
  .option("--config <filename>", "optional config file name")
  .action((options) => {
    const configLocation = path.toNamespacedPath(path.resolve(options.config ?? defaultConfigPaths[0] ?? ""));
    console.log(configLocation);
    init({ configLocation });
  });

program
  .command("ui")
  .description("Launch the configuration UI")
  .option("--port <number>", "Port for the UI server")
  .option("--config <filename>", "optional config file name")
  .option("--no-open", "Don't automatically open the browser")
  .option("--env-path <path>", "optional path to your .env file")
  .action(async (options) => {
    const configPath = getConfigPath(options.config);
    const configLocation = configPath ?? defaultConfigPaths[0] ?? "";

    // Load environment variables before starting the server
    parseEnvs(options.envPath);

    let port: number | null = null;
    if (options.port) {
      port = Number.parseInt(options.port, 10);
      if (Number.isNaN(port) || port < 1 || port > 65_535) {
        console.error(chalk.red("Invalid port number"));
        return process.exit(1);
      }
    }

    try {
      const server = await startServer({
        port,
        cwd: process.cwd(),
        configPath: configLocation,
      });

      const url = `http://localhost:${server.port}`;
      console.log();
      console.log(chalk.green(`🚀 Config UI ready at ${url}`));
      console.log();

      // Auto-open browser
      if (options.open !== false) {
        try {
          const { default: open } = await import("open");
          await open(url);
        } catch (_err) {
          // Ignore errors opening browser
        }
      }

      // Handle graceful shutdown
      process.on("SIGINT", () => {
        console.log();
        console.log(chalk.yellow("Shutting down server..."));
        server.close();
        process.exit(0);
      });

      process.on("SIGTERM", () => {
        server.close();
        process.exit(0);
      });
    } catch (err) {
      console.error(chalk.red("Failed to start server:"));
      console.error(err);
      process.exit(1);
    }
  });

program.parse();

function parseEnvs(envPath?: string | undefined) {
  let actualEnvPath = envPath;
  if (!(actualEnvPath && fs.existsSync(actualEnvPath))) {
    const possiblePaths = [".env.local", ".env"];
    for (const path of possiblePaths) {
      if (fs.existsSync(path)) {
        actualEnvPath = path;
        break;
      }
    }
  }

  // this should fail silently.
  // if we can't resolve the right env vars, they will be logged as errors later
  config({ path: actualEnvPath });
  // if (envRes.error) {
  //   console.log(
  //     chalk.red(
  //       `Could not resolve your environment variables.\n${envRes.error.message}\n`,
  //     ),
  //   );
  // }
}

function getConfigPath(configPath?: string): string | null {
  if (configPath) {
    // If a config path is specified, check if it exists
    try {
      fs.accessSync(configPath, fs.constants.F_OK);
      return configPath;
    } catch (_e) {
      // If it doesn't exist, continue to default paths
    }
  }

  // Try default paths in order
  for (const path of defaultConfigPaths) {
    try {
      fs.accessSync(path, fs.constants.F_OK);
      return path;
    } catch (_e) {
      // If path doesn't exist, try the next one
    }
  }
  return null;
}
