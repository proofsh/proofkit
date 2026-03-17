import { Effect } from "effect";

import { DEFAULT_APP_NAME } from "~/consts.js";
import { CliContext, PromptService } from "~/core/context.js";
import type { AppType, CliFlags, DataSourceType, FileMakerInputs, InitRequest } from "~/core/types.js";
import { parseNameAndPath, validateAppName } from "~/utils/projectName.js";

const defaultFlags: CliFlags = {
  noGit: false,
  noInstall: false,
  force: false,
  default: false,
  CI: false,
  importAlias: "~/",
};

function validateFileMakerInputs(flags: CliFlags, nonInteractive: boolean) {
  const layoutWithoutSchema = Boolean(flags.layoutName) !== Boolean(flags.schemaName);
  if (layoutWithoutSchema) {
    throw new Error("Both --layoutName and --schemaName must be provided together.");
  }

  if (!nonInteractive || flags.dataSource !== "filemaker") {
    return;
  }

  const missingRequired = ["server", "fileName", "dataApiKey"].filter((field) => {
    if (field === "server") {
      return !flags.server;
    }
    if (field === "fileName") {
      return !flags.fileName;
    }
    return !flags.dataApiKey;
  });

  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required FileMaker inputs in non-interactive mode: ${missingRequired.map((field) => `--${field}`).join(", ")}`,
    );
  }
}

async function resolveFileMakerInputs(
  prompt: PromptService,
  flags: CliFlags,
  nonInteractive: boolean,
): Promise<FileMakerInputs | undefined> {
  if (flags.dataSource !== "filemaker") {
    return undefined;
  }

  validateFileMakerInputs(flags, nonInteractive);

  const server =
    flags.server ??
    (await prompt.text({
      message: "What is the URL of your FileMaker Server?",
      validate: (value) => {
        try {
          new URL(value.startsWith("http") ? value : `https://${value}`);
          return;
        } catch {
          return "Please enter a valid URL";
        }
      },
    }));

  const fileName =
    flags.fileName ??
    (await prompt.text({
      message: "What is the FileMaker file name?",
      validate: (value) => (value ? undefined : "A file name is required"),
    }));

  const dataApiKey =
    flags.dataApiKey ??
    (await prompt.text({
      message: "What is the Otto Data API key?",
      validate: (value) => (value ? undefined : "A data API key is required"),
    }));

  let layoutName = flags.layoutName;
  let schemaName = flags.schemaName;

  if (!(nonInteractive || layoutName || schemaName)) {
    const shouldCaptureLayout = await prompt.confirm({
      message: "Do you want to configure an initial layout for type generation now?",
      initialValue: false,
    });

    if (shouldCaptureLayout) {
      layoutName = await prompt.text({
        message: "What is the FileMaker layout name?",
        validate: (value) => (value ? undefined : "A layout name is required"),
      });
      schemaName = await prompt.text({
        message: "What should the generated schema be called?",
        validate: (value) => (value ? undefined : "A schema name is required"),
      });
    }
  }

  return {
    server,
    fileName,
    dataApiKey,
    layoutName,
    schemaName,
    adminApiKey: flags.adminApiKey,
  };
}

export const resolveInitRequest = (name?: string, rawFlags?: CliFlags) =>
  Effect.gen(function* () {
    const flags = { ...defaultFlags, ...rawFlags };
    const prompt = yield* PromptService;
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
              hint: "Set up env and typegen config now",
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

    const fileMaker = yield* Effect.promise(() =>
      resolveFileMakerInputs(prompt, { ...flags, dataSource }, nonInteractive),
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
      hasExplicitFileMakerInputs: Boolean(
        flags.server || flags.adminApiKey || flags.dataApiKey || flags.fileName || flags.layoutName || flags.schemaName,
      ),
    } satisfies InitRequest;
  });
