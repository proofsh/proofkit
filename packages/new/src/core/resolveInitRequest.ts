import { Effect } from "effect";

import { DEFAULT_APP_NAME } from "~/consts.js";
import { CliContext, FileMakerService, PromptService } from "~/core/context.js";
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

function validateLayoutInputs(flags: CliFlags) {
  const hasLayoutName = Boolean(flags.layoutName);
  const hasSchemaName = Boolean(flags.schemaName);

  if (hasLayoutName !== hasSchemaName) {
    throw new Error("Both --layout-name and --schema-name must be provided together.");
  }
}

async function resolveHostedFileMakerInputs({
  prompt,
  fileMakerService,
  flags,
  nonInteractive,
}: {
  prompt: PromptService;
  fileMakerService: FileMakerService;
  flags: CliFlags;
  nonInteractive: boolean;
}): Promise<FileMakerInputs> {
  validateLayoutInputs(flags);

  if (!flags.server && nonInteractive) {
    throw new Error(
      "Missing required hosted FileMaker inputs in non-interactive mode: --server, --file-name, and --data-api-key.",
    );
  }

  const rawServer =
    flags.server ??
    (await prompt.text({
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
    }));

  const { normalizedUrl, versions } = await fileMakerService.validateHostedServerUrl(rawServer);
  const hostedUrl = new URL(normalizedUrl);

  if (!(flags.adminApiKey || (versions.ottoVersion && compareSemver(versions.ottoVersion, "4.7.0") >= 0))) {
    throw new Error(
      "OttoFMS 4.7.0 or later is required to auto-login. Upgrade OttoFMS or pass --admin-api-key for hosted setup.",
    );
  }

  const token = flags.adminApiKey ?? (await fileMakerService.getOttoFMSToken({ url: hostedUrl })).token;
  const files = await fileMakerService.listFiles({ url: hostedUrl, token });
  const demoFileName = "ProofKitDemo.fmp12";

  if (files.length === 0) {
    throw new Error(`No hosted FileMaker files were found on ${hostedUrl.origin}.`);
  }

  let selectedFile = flags.fileName;
  if (!selectedFile) {
    if (nonInteractive) {
      throw new Error("Missing required FileMaker inputs in non-interactive mode: --file-name, --data-api-key.");
    }
    selectedFile = await prompt.searchSelect({
      message: "Which file would you like to connect to?",
      searchLabel: "Search files",
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
    });
  }

  let dataApiKey = flags.dataApiKey;
  let layoutName = flags.layoutName;
  let schemaName = flags.schemaName;

  if (selectedFile === "$deploy-demo") {
    const demoExists = files.some((file) => file.filename === demoFileName);
    const replaceDemo =
      demoExists && !nonInteractive
        ? await prompt.confirm({
            message: "The demo file already exists. Do you want to replace it with a fresh copy?",
            initialValue: false,
          })
        : demoExists;
    const deployed = await fileMakerService.deployDemoFile({
      url: hostedUrl,
      token,
      operation: replaceDemo ? "replace" : "install",
    });
    selectedFile = deployed.filename;
    dataApiKey = deployed.apiKey;
    layoutName ??= "API_Contacts";
    schemaName ??= "Contacts";
  }

  if (!selectedFile) {
    throw new Error("No FileMaker file was selected.");
  }

  if (!dataApiKey) {
    if (nonInteractive) {
      throw new Error("Missing required FileMaker inputs in non-interactive mode: --data-api-key.");
    }

    const apiKeys = (await fileMakerService.listAPIKeys({ url: hostedUrl, token })).filter(
      (apiKey) => apiKey.database === selectedFile,
    );

    const selection =
      apiKeys.length === 0
        ? "create"
        : await prompt.searchSelect({
            message: "Which OttoFMS Data API key would you like to use?",
            searchLabel: "Search API keys",
            options: [
              ...apiKeys.map((apiKey) => ({
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
          });

    if (selection === "create") {
      const username = await prompt.text({
        message: `Enter the account name for ${selectedFile}`,
        validate: (value) => (value ? undefined : "An account name is required"),
      });
      const password = await prompt.password({
        message: `Enter the password for ${username}`,
        validate: (value) => (value ? undefined : "A password is required"),
      });
      dataApiKey = (
        await fileMakerService.createDataAPIKeyWithCredentials({
          url: hostedUrl,
          filename: selectedFile,
          username,
          password,
        })
      ).apiKey;
    } else {
      dataApiKey = selection;
    }
  }

  const layouts = await fileMakerService.listLayouts({
    dataApiKey,
    fmFile: selectedFile,
    server: hostedUrl.origin,
  });

  if (layoutName && !layouts.includes(layoutName)) {
    throw new Error(`Layout "${layoutName}" was not found in ${selectedFile}.`);
  }

  if (!(nonInteractive || layoutName || schemaName)) {
    const shouldConfigureLayout = await prompt.confirm({
      message: "Do you want to configure an initial layout for type generation now?",
      initialValue: false,
    });

    if (shouldConfigureLayout) {
      layoutName = await prompt.searchSelect({
        message: "Select a layout to read data from",
        searchLabel: "Search layouts",
        options: layouts.map((layout) => ({
          value: layout,
          label: layout,
          keywords: [layout],
        })),
      });

      schemaName = await prompt.text({
        message: "What should the generated schema be called?",
        defaultValue: getDefaultSchemaName(layoutName),
        validate: (value) => (value ? undefined : "A schema name is required"),
      });
    }
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
  };
}

async function resolveFileMakerInputs({
  prompt,
  fileMakerService,
  flags,
  appType,
  nonInteractive,
}: {
  prompt: PromptService;
  fileMakerService: FileMakerService;
  flags: CliFlags;
  appType: AppType;
  nonInteractive: boolean;
}) {
  if (flags.dataSource !== "filemaker") {
    return { fileMaker: undefined, skipFileMakerSetup: false };
  }

  validateLayoutInputs(flags);

  if (appType === "webviewer" && !flags.server) {
    const localFmHttp = await fileMakerService.detectLocalFmHttp();
    if (localFmHttp.healthy && localFmHttp.connectedFiles[0]) {
      return {
        fileMaker: {
          mode: "local-fm-http",
          dataSourceName: "filemaker",
          envNames: createDataSourceEnvNames("filemaker"),
          fmHttpBaseUrl: localFmHttp.baseUrl,
          fileName: localFmHttp.connectedFiles[0],
          layoutName: flags.layoutName,
          schemaName: flags.schemaName,
        } satisfies FileMakerInputs,
        skipFileMakerSetup: false,
      };
    }

    if (nonInteractive) {
      throw new Error(
        "No local FM HTTP connection was detected and no FileMaker server was provided. Start FM HTTP locally or rerun with --server.",
      );
    }

    const fallbackAction = await prompt.select({
      message: "Local FM HTTP was not detected. How would you like to continue?",
      options: [
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
    });

    if (fallbackAction === "skip") {
      return {
        fileMaker: undefined,
        skipFileMakerSetup: true,
      };
    }
  }

  return {
    fileMaker: await resolveHostedFileMakerInputs({
      prompt,
      fileMakerService,
      flags,
      nonInteractive,
    }),
    skipFileMakerSetup: false,
  };
}

export const resolveInitRequest = (name?: string, rawFlags?: CliFlags) =>
  Effect.gen(function* () {
    const flags = { ...defaultFlags, ...rawFlags };
    const prompt = yield* PromptService;
    const fileMakerService = yield* FileMakerService;
    const cliContext = yield* CliContext;
    const nonInteractive = cliContext.nonInteractive || flags.CI || flags.nonInteractive === true;

    let projectName = name;
    if (!projectName) {
      if (nonInteractive) {
        return yield* Effect.fail(new Error("Project name is required in non-interactive mode."));
      }

      projectName = yield* Effect.promise(() =>
        prompt.text({
          message: "What will your project be called?",
          defaultValue: DEFAULT_APP_NAME,
          validate: validateAppName,
        }),
      );
    }

    if (!projectName) {
      return yield* Effect.fail(new Error("Project name is required."));
    }

    const validationError = validateAppName(projectName);
    if (validationError) {
      return yield* Effect.fail(new Error(validationError));
    }

    let appType: AppType = flags.appType ?? "browser";
    if (!(flags.appType || nonInteractive)) {
      appType = yield* Effect.promise(() =>
        prompt.select({
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
      ).pipe(Effect.map((value) => value as AppType));
    }

    let dataSource: DataSourceType = "none";
    if (flags.dataSource) {
      dataSource = flags.dataSource;
    } else if (appType === "webviewer") {
      dataSource = nonInteractive && !flags.server ? "none" : "filemaker";
    }

    if (!(nonInteractive || flags.dataSource) && appType !== "webviewer") {
      dataSource = yield* Effect.promise(() =>
        prompt.select({
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
      ).pipe(Effect.map((value) => value as DataSourceType));
    }

    const { fileMaker, skipFileMakerSetup } = yield* Effect.promise(() =>
      resolveFileMakerInputs({
        prompt,
        fileMakerService,
        flags: { ...flags, dataSource },
        appType,
        nonInteractive,
      }),
    );

    const [scopedAppName, appDir] = parseNameAndPath(projectName);

    return {
      projectName,
      scopedAppName,
      appDir,
      appType,
      ui: flags.ui ?? "shadcn",
      dataSource,
      packageManager: cliContext.packageManager,
      noInstall: flags.noInstall,
      noGit: flags.noGit,
      force: flags.force,
      cwd: cliContext.cwd,
      importAlias: flags.importAlias,
      nonInteractive,
      debug: cliContext.debug,
      fileMaker,
      skipFileMakerSetup,
      hasExplicitFileMakerInputs: Boolean(
        flags.server || flags.adminApiKey || flags.dataApiKey || flags.fileName || flags.layoutName || flags.schemaName,
      ),
    } satisfies InitRequest;
  });
