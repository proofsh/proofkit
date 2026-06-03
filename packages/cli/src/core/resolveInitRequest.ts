import { Effect } from "effect";

import { DEFAULT_APP_NAME } from "~/consts.js";
import { CliContext, ConsoleService, FileMakerService, PackageManagerService, PromptService } from "~/core/context.js";
import {
  CliValidationError,
  FileMakerSetupError,
  isCliError,
  NonInteractiveInputError,
  UserCancelledError,
} from "~/core/errors.js";
import type { AppType, CliFlags, DataSourceType, FileMakerInputs, InitRequest } from "~/core/types.js";
import { createDataSourceEnvNames, getDefaultSchemaName } from "~/utils/projectFiles.js";
import { parseNameAndPath, validateAppName } from "~/utils/projectName.js";

const defaultFlags: CliFlags = {
  noGit: false,
  noInstall: false,
  force: false,
  default: false,
  CI: false,
  importAlias: "~/",
};

function compareSemver(left: string, right: string) {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10) || 0);

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

function resolveLayoutNameMatch(layouts: string[], requestedLayoutName: string) {
  const exactMatch = layouts.find((layout) => layout === requestedLayoutName);
  if (exactMatch) {
    return exactMatch;
  }

  const normalizedRequestedLayoutName = requestedLayoutName.toLocaleLowerCase();
  return layouts.find((layout) => layout.toLocaleLowerCase() === normalizedRequestedLayoutName);
}

function validateLayoutInputs(flags: CliFlags) {
  const hasLayoutName = Boolean(flags.layoutName);
  const hasSchemaName = Boolean(flags.schemaName);

  if (hasLayoutName !== hasSchemaName) {
    return Effect.fail(
      new CliValidationError({
        message: "Both --layout-name and --schema-name must be provided together.",
      }),
    );
  }

  return Effect.void;
}

function promptEffect<A>(message: string, run: () => Promise<A>) {
  return Effect.tryPromise({
    try: run,
    catch: (cause) =>
      isCliError(cause)
        ? cause
        : new CliValidationError({
            message,
            cause,
          }),
  });
}

function getMissingFlags(values: [flag: string, value: unknown][]) {
  return values.filter(([, value]) => !value).map(([flag]) => flag);
}

function createMissingInputsMessage(scope: string, flags: string[]) {
  return `Missing required ${scope} inputs in non-interactive mode: ${flags.join(", ")}.`;
}

function resolvePackageManager({
  cwd,
  packageManager,
  nonInteractive,
}: {
  cwd: string;
  packageManager: "npm" | "pnpm" | "yarn" | "bun";
  nonInteractive: boolean;
}) {
  return Effect.gen(function* () {
    if (packageManager !== "npm") {
      return packageManager;
    }

    const packageManagerService = yield* PackageManagerService;
    const prompt = yield* PromptService;
    const pnpmVersionResult = yield* Effect.either(packageManagerService.getVersion("pnpm", cwd));
    if (pnpmVersionResult._tag === "Right") {
      return "pnpm" as const;
    }

    if (nonInteractive) {
      return packageManager;
    }

    const packageManagerChoice = yield* promptEffect("Unable to choose package manager.", () =>
      prompt.select<"abort" | "continue">({
        message:
          "We strongly suggest you use PNPM instead of NPM to better secure yourself and the apps you build. https://pnpm.io/installation",
        options: [
          {
            value: "abort",
            label: "Abort",
            hint: "Install PNPM first",
          },
          {
            value: "continue",
            label: "Continue with NPM",
            hint: "Ignore this warning",
          },
        ],
      }),
    );

    if (packageManagerChoice === "abort") {
      return yield* Effect.fail(
        new UserCancelledError({
          message: "User aborted to install pnpm first.",
        }),
      );
    }

    return packageManager;
  });
}

function resolveHostedFileMakerInputs({
  prompt,
  fileMakerService,
  flags,
  nonInteractive,
}: {
  prompt: PromptService;
  fileMakerService: FileMakerService;
  flags: CliFlags;
  nonInteractive: boolean;
}) {
  return Effect.gen(function* () {
    yield* validateLayoutInputs(flags);

    if (!flags.server && nonInteractive) {
      return yield* Effect.fail(
        new NonInteractiveInputError({
          message: createMissingInputsMessage(
            "hosted FileMaker",
            getMissingFlags([
              ["--server", flags.server],
              ["--file-name", flags.fileName],
              ["--data-api-key", flags.dataApiKey],
            ]),
          ),
        }),
      );
    }

    const rawServer =
      flags.server ??
      (yield* promptEffect("Unable to read FileMaker Server URL.", () =>
        prompt.text({
          message: "What is the URL of your FileMaker Server?",
          validate: (value) => {
            try {
              const normalized = value.startsWith("http") ? value : `https://${value}`;
              new URL(normalized);
              return;
            } catch {
              return "Please enter a valid URL";
            }
          },
        }),
      ));

    const { normalizedUrl, versions } = yield* fileMakerService.validateHostedServerUrl(rawServer);
    const hostedUrl = new URL(normalizedUrl);
    const demoFileName = "ProofKitDemo.fmp12";

    let selectedFile = flags.fileName;
    let dataApiKey = flags.dataApiKey;
    let layoutName = flags.layoutName;
    let schemaName = flags.schemaName;
    let token: string | undefined;
    let files: Array<{ filename: string; status: string }> = [];

    const requireHostedToken = () =>
      token
        ? Effect.succeed(token)
        : Effect.fail(
            new FileMakerSetupError({
              message: "OttoFMS authentication is required for hosted setup.",
            }),
          );

    if (!(selectedFile && dataApiKey)) {
      if (!(flags.adminApiKey || (versions.ottoVersion && compareSemver(versions.ottoVersion, "4.7.0") >= 0))) {
        return yield* Effect.fail(
          new FileMakerSetupError({
            message:
              "OttoFMS 4.7.0 or later is required to auto-login. Upgrade OttoFMS or pass --admin-api-key for hosted setup.",
          }),
        );
      }
      token = flags.adminApiKey ?? (yield* fileMakerService.getOttoFMSToken({ url: hostedUrl })).token;
    }

    if (!selectedFile) {
      if (nonInteractive) {
        return yield* Effect.fail(
          new NonInteractiveInputError({
            message: createMissingInputsMessage(
              "FileMaker",
              getMissingFlags([
                ["--file-name", selectedFile],
                ["--data-api-key", dataApiKey],
              ]),
            ),
          }),
        );
      }

      files = yield* fileMakerService.listFiles({
        url: hostedUrl,
        token: yield* requireHostedToken(),
      });
      selectedFile = yield* promptEffect("Unable to choose a FileMaker file.", () =>
        prompt.searchSelect({
          message: "Which file would you like to connect to?",
          options: [
            {
              value: "$deploy-demo",
              label: "Deploy NEW ProofKit Demo File",
              hint: "Use OttoFMS to deploy a new file for testing",
              keywords: ["demo", "proofkit"],
            },
            ...files
              .slice()
              .sort((left, right) => left.filename.localeCompare(right.filename))
              .map((file) => ({
                value: file.filename,
                label: file.filename,
                hint: file.status,
                keywords: [file.filename],
              })),
          ],
        }),
      );
    }

    if (!selectedFile) {
      return yield* Effect.fail(
        new FileMakerSetupError({
          message: "No FileMaker file was selected.",
        }),
      );
    }

    if (selectedFile === "$deploy-demo") {
      if (files.length === 0) {
        files = yield* fileMakerService.listFiles({
          url: hostedUrl,
          token: yield* requireHostedToken(),
        });
      }
      const demoExists = files.some((file) => file.filename === demoFileName);
      const replaceDemo =
        demoExists && !nonInteractive
          ? yield* promptEffect("Unable to confirm ProofKit Demo replacement.", () =>
              prompt.confirm({
                message: "The demo file already exists. Do you want to replace it with a fresh copy?",
                initialValue: false,
              }),
            )
          : demoExists;
      const deployed = yield* fileMakerService.deployDemoFile({
        url: hostedUrl,
        token: yield* requireHostedToken(),
        operation: replaceDemo ? "replace" : "install",
      });
      selectedFile = deployed.filename;
      dataApiKey = deployed.apiKey;
      layoutName ??= "API_Contacts";
      schemaName ??= "Contacts";
    }

    if (!dataApiKey && nonInteractive) {
      return yield* Effect.fail(
        new NonInteractiveInputError({
          message: createMissingInputsMessage("FileMaker", getMissingFlags([["--data-api-key", dataApiKey]])),
        }),
      );
    }

    if (!dataApiKey) {
      const apiKeys = (yield* fileMakerService.listAPIKeys({
        url: hostedUrl,
        token: yield* requireHostedToken(),
      })).filter((apiKey: { database: string }) => apiKey.database === selectedFile);

      const selection =
        apiKeys.length === 0
          ? "create"
          : yield* promptEffect("Unable to choose an OttoFMS Data API key.", () =>
              prompt.searchSelect({
                message: "Which OttoFMS Data API key would you like to use?",
                options: [
                  ...apiKeys.map((apiKey: { key: string; label: string; user: string; database: string }) => ({
                    value: apiKey.key,
                    label: `${apiKey.label} - ${apiKey.user}`,
                    hint: `${apiKey.key.slice(0, 5)}...${apiKey.key.slice(-4)}`,
                    keywords: [apiKey.label, apiKey.user, apiKey.database],
                  })),
                  {
                    value: "create",
                    label: "Create a new API key",
                    hint: "Requires FileMaker credentials for this file",
                    keywords: ["create", "new"],
                  },
                ],
              }),
            );

      if (selection === "create") {
        const username = yield* promptEffect("Unable to read FileMaker account name.", () =>
          prompt.text({
            message: `Enter the account name for ${selectedFile}`,
            validate: (value) => (value ? undefined : "An account name is required"),
          }),
        );
        const password = yield* promptEffect("Unable to read FileMaker account password.", () =>
          prompt.password({
            message: `Enter the password for ${username}`,
            validate: (value) => (value ? undefined : "A password is required"),
          }),
        );
        if (!selectedFile) {
          return yield* Effect.fail(
            new FileMakerSetupError({
              message: "No FileMaker file was selected.",
            }),
          );
        }
        dataApiKey = (yield* fileMakerService.createDataAPIKeyWithCredentials({
          url: hostedUrl,
          filename: selectedFile,
          username,
          password,
        })).apiKey;
      } else {
        dataApiKey = selection;
      }
    }

    if (!dataApiKey) {
      return yield* Effect.fail(
        new FileMakerSetupError({
          message: "No FileMaker Data API key was selected.",
        }),
      );
    }

    const resolvedFileName = selectedFile;
    if (!resolvedFileName) {
      return yield* Effect.fail(
        new FileMakerSetupError({
          message: "No FileMaker file was selected.",
        }),
      );
    }

    const layouts = yield* fileMakerService.listLayouts({
      dataApiKey,
      fmFile: resolvedFileName,
      server: hostedUrl.origin,
    });

    if (layoutName) {
      const matchedLayoutName = resolveLayoutNameMatch(layouts, layoutName);
      if (!matchedLayoutName) {
        return yield* Effect.fail(
          new FileMakerSetupError({
            message: `Layout "${layoutName}" was not found in ${resolvedFileName}.`,
          }),
        );
      }

      layoutName = matchedLayoutName;
    }

    if (!(nonInteractive || layoutName || schemaName)) {
      const shouldConfigureLayout = yield* promptEffect("Unable to confirm initial layout setup.", () =>
        prompt.confirm({
          message: "Do you want to configure an initial layout for type generation now?",
          initialValue: false,
        }),
      );

      if (shouldConfigureLayout) {
        layoutName = yield* promptEffect("Unable to choose a FileMaker layout.", () =>
          prompt.searchSelect({
            message: "Select a layout to read data from",
            options: layouts.map((layout: string) => ({
              value: layout,
              label: layout,
              keywords: [layout],
            })),
          }),
        );

        const resolvedLayoutName = layoutName;
        if (!resolvedLayoutName) {
          return yield* Effect.fail(
            new FileMakerSetupError({
              message: "No FileMaker layout was selected.",
            }),
          );
        }
        schemaName = yield* promptEffect("Unable to read generated schema name.", () =>
          prompt.text({
            message: "What should the generated schema be called?",
            defaultValue: getDefaultSchemaName(resolvedLayoutName),
            validate: (value) => (value ? undefined : "A schema name is required"),
          }),
        );
      }
    }

    if (!selectedFile) {
      return yield* Effect.fail(
        new FileMakerSetupError({
          message: "No FileMaker file was selected.",
        }),
      );
    }
    if (!dataApiKey) {
      return yield* Effect.fail(
        new FileMakerSetupError({
          message: "No FileMaker Data API key was selected.",
        }),
      );
    }

    return {
      mode: "hosted-otto",
      dataSourceName: "filemaker",
      envNames: createDataSourceEnvNames("filemaker"),
      server: hostedUrl.origin,
      fileName: selectedFile,
      dataApiKey,
      layoutName,
      schemaName,
      adminApiKey: flags.adminApiKey,
      fmsVersion: versions.fmsVersion,
      ottoVersion: versions.ottoVersion,
    } satisfies FileMakerInputs;
  });
}

function resolveFileMakerInputs({
  prompt,
  console,
  fileMakerService,
  flags,
  appType,
  nonInteractive,
  projectName,
  proofkitToken,
}: {
  prompt: PromptService;
  console: ConsoleService;
  fileMakerService: FileMakerService;
  flags: CliFlags;
  appType: AppType;
  nonInteractive: boolean;
  projectName: string;
  proofkitToken?: string;
}) {
  return Effect.gen(function* () {
    if (flags.dataSource !== "filemaker") {
      return { fileMaker: undefined, skipFileMakerSetup: false };
    }

    yield* validateLayoutInputs(flags);

    if (appType === "webviewer" && !flags.server) {
      const resolveLocalFmMcpFile = (connectedFiles: string[]) =>
        Effect.gen(function* () {
          const availableFiles = connectedFiles.filter(Boolean);
          if (availableFiles.length === 0) {
            return undefined;
          }

          if (flags.fileName) {
            if (availableFiles.includes(flags.fileName)) {
              return flags.fileName;
            }

            return yield* Effect.fail(
              new FileMakerSetupError({
                message: `FileMaker file "${flags.fileName}" is not currently connected to the ProofKit plugin. Connected files: ${availableFiles.join(", ")}.`,
              }),
            );
          }

          if (availableFiles.length === 1) {
            return availableFiles[0];
          }

          if (nonInteractive) {
            return yield* Effect.fail(
              new NonInteractiveInputError({
                message: `Multiple FileMaker files are connected to the ProofKit plugin. Pass --file-name with one of: ${availableFiles.join(", ")}.`,
              }),
            );
          }

          return yield* promptEffect("Unable to choose a local FileMaker file.", () =>
            prompt.searchSelect({
              message: "Multiple FileMaker files are open. Which file should ProofKit use?",
              options: availableFiles.map((fileName) => ({
                value: fileName,
                label: fileName,
                hint: "Connected via ProofKit plugin",
                keywords: [fileName],
              })),
            }),
          );
        });

      while (true) {
        const localFmMcp = yield* fileMakerService.detectLocalFmMcp();
        yield* fileMakerService.installLocalWebViewerAddon();
        const selectedFile = localFmMcp.healthy ? yield* resolveLocalFmMcpFile(localFmMcp.connectedFiles) : undefined;
        if (localFmMcp.healthy && selectedFile) {
          if (!(nonInteractive || proofkitToken)) {
            yield* fileMakerService.authorizeLocalFmMcp({
              baseUrl: localFmMcp.baseUrl,
              fileName: selectedFile,
              interactive: true,
              clientName: `ProofKit CLI (${projectName})`,
              clientDescription:
                "ProofKit CLI wants to read layouts from your FileMaker file to help set up your project.",
            });
          }
          console.info(`Using ProofKit plugin file: ${selectedFile}`);
          return {
            fileMaker: {
              mode: "local-fm-mcp",
              dataSourceName: "filemaker",
              envNames: createDataSourceEnvNames("filemaker"),
              fmMcpBaseUrl: localFmMcp.baseUrl,
              fileName: selectedFile,
              layoutName: flags.layoutName,
              schemaName: flags.schemaName,
              proofkitToken,
            } satisfies FileMakerInputs,
            skipFileMakerSetup: false,
          };
        }

        if (nonInteractive) {
          if (localFmMcp.healthy) {
            return yield* Effect.fail(
              new NonInteractiveInputError({
                message:
                  "ProofKit plugin was detected, but no FileMaker file is connected. Install the ProofKit plugin, install the ProofKit Web Viewer add-on in your FileMaker file, then run the add-on connection script and rerun. Or pass --server.",
              }),
            );
          }

          return yield* Effect.fail(
            new NonInteractiveInputError({
              message:
                "ProofKit plugin was not detected and no FileMaker server was provided. Install the ProofKit plugin, then rerun. Or pass --server.",
            }),
          );
        }

        const fallbackAction = yield* promptEffect("Unable to choose FileMaker setup fallback.", () =>
          prompt.select({
            message: localFmMcp.healthy
              ? "ProofKit plugin is installed, but no FileMaker file is connected yet. Install the ProofKit Web Viewer add-on in your FileMaker file, run the add-on connection script, then choose how to continue."
              : "ProofKit plugin was not detected. How would you like to continue?",
            options: [
              {
                value: "retry",
                label: "Try again",
                hint: localFmMcp.healthy
                  ? "Check again after opening a FileMaker file"
                  : "Retry ProofKit plugin detection",
              },
              {
                value: "hosted",
                label: "Continue with hosted setup",
                hint: "Use OttoFMS and a hosted FileMaker server",
              },
              {
                value: "skip",
                label: "Skip for now",
                hint: "Create the project and configure FileMaker later",
              },
            ],
          }),
        );

        if (fallbackAction === "retry") {
          continue;
        }

        if (fallbackAction === "skip") {
          return {
            fileMaker: undefined,
            skipFileMakerSetup: true,
          };
        }

        break;
      }
    }

    return {
      fileMaker: yield* resolveHostedFileMakerInputs({
        prompt,
        fileMakerService,
        flags,
        nonInteractive,
      }),
      skipFileMakerSetup: false,
    };
  });
}

export const resolveInitRequest = (name?: string, rawFlags?: CliFlags) =>
  Effect.gen(function* () {
    const flags = { ...defaultFlags, ...rawFlags };
    const proofkitToken = flags.proofkitToken?.trim() || process.env.FM_MCP_SESSION_ID?.trim();
    const prompt = yield* PromptService;
    const console = yield* ConsoleService;
    const fileMakerService = yield* FileMakerService;
    const cliContext = yield* CliContext;
    const nonInteractive = cliContext.nonInteractive || flags.CI || flags.nonInteractive === true;
    const packageManager = yield* resolvePackageManager({
      cwd: cliContext.cwd,
      packageManager: cliContext.packageManager,
      nonInteractive,
    });

    let projectName = name;
    if (!projectName) {
      if (nonInteractive) {
        return yield* Effect.fail(
          new NonInteractiveInputError({
            message: "Project name is required in non-interactive mode.",
          }),
        );
      }

      projectName = yield* promptEffect("Unable to read project name.", () =>
        prompt.text({
          message: "What will your project be called?",
          defaultValue: DEFAULT_APP_NAME,
          validate: validateAppName,
        }),
      );
    }

    if (!projectName) {
      return yield* Effect.fail(
        new CliValidationError({
          message: "Project name is required.",
        }),
      );
    }

    const validationError = validateAppName(projectName);
    if (validationError) {
      return yield* Effect.fail(
        new CliValidationError({
          message: validationError,
        }),
      );
    }

    let appType: AppType = flags.appType ?? "browser";
    if (!(flags.appType || nonInteractive)) {
      appType = yield* promptEffect("Unable to choose app type.", () =>
        prompt.select<AppType>({
          message: "What kind of app do you want to build?",
          options: [
            {
              value: "browser",
              label: "Web App for Browsers",
              hint: "Uses Next.js and hosted deployment",
            },
            {
              value: "webviewer",
              label: "FileMaker Web Viewer",
              hint: "Uses Vite for FileMaker web viewers",
            },
          ],
        }),
      );
    }

    const hasExplicitFileMakerInputs = Boolean(
      flags.server || flags.adminApiKey || flags.dataApiKey || flags.fileName || flags.layoutName || flags.schemaName,
    );

    let dataSource: DataSourceType = "none";
    if (flags.dataSource) {
      dataSource = flags.dataSource;
    } else if (appType === "webviewer") {
      dataSource = hasExplicitFileMakerInputs || !(nonInteractive && !flags.server) ? "filemaker" : "none";
    }

    if (!(nonInteractive || flags.dataSource) && appType !== "webviewer") {
      dataSource = yield* promptEffect("Unable to choose data source setup.", () =>
        prompt.select<DataSourceType>({
          message: "Do you want to connect to a FileMaker Database now?",
          options: [
            {
              value: "filemaker",
              label: "Yes",
              hint: "Set up env, datasource config, and typegen now",
            },
            {
              value: "none",
              label: "No",
              hint: "You can add a data source later",
            },
          ],
        }),
      );
    }

    if (nonInteractive && !flags.dataSource && hasExplicitFileMakerInputs) {
      return yield* Effect.fail(
        new NonInteractiveInputError({
          message: "FileMaker flags require --data-source filemaker in non-interactive mode.",
        }),
      );
    }

    if (nonInteractive && dataSource !== "filemaker" && hasExplicitFileMakerInputs) {
      return yield* Effect.fail(
        new NonInteractiveInputError({
          message: "FileMaker flags require --data-source filemaker in non-interactive mode.",
        }),
      );
    }

    const [scopedAppName, appDir] = parseNameAndPath(projectName);

    const { fileMaker, skipFileMakerSetup } = yield* resolveFileMakerInputs({
      prompt,
      console,
      fileMakerService,
      flags: { ...flags, dataSource },
      appType,
      nonInteractive,
      projectName: scopedAppName,
      proofkitToken,
    });

    return {
      projectName,
      scopedAppName,
      appDir,
      appType,
      ui: flags.ui ?? "shadcn",
      dataSource,
      packageManager,
      noInstall: flags.noInstall,
      noGit: flags.noGit,
      force: flags.force,
      cwd: cliContext.cwd,
      importAlias: flags.importAlias,
      nonInteractive,
      debug: cliContext.debug,
      proofkitToken,
      fileMaker,
      skipFileMakerSetup,
      hasExplicitFileMakerInputs,
    } satisfies InitRequest;
  });
