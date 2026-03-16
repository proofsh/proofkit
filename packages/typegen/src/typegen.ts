import path from "node:path";
import DataApi from "@proofkit/fmdapi";
import { FetchAdapter } from "@proofkit/fmdapi/adapters/fetch";
import { FmHttpAdapter } from "@proofkit/fmdapi/adapters/fm-http";
import { OttoAdapter, type OttoAPIKey } from "@proofkit/fmdapi/adapters/otto";
import { memoryStore } from "@proofkit/fmdapi/tokenStore/memory";
import chalk from "chalk";
import fs from "fs-extra";
import semver from "semver";
import { IndentationText, Project, ScriptKind } from "ts-morph";
import type { PackageJson } from "type-fest";
import type { z } from "zod/v4";
import { buildLayoutClient } from "./buildLayoutClient";
import { buildOverrideFile, buildSchema } from "./buildSchema";
import { commentHeader, defaultEnvNames, defaultFmHttpBaseUrl, overrideCommentHeader } from "./constants";
import { generateODataTablesSingle } from "./fmodata/typegen";
import { formatAndSaveSourceFiles, runPostGenerateCommand } from "./formatting";
import { getEnvValues, validateAndLogEnvValues } from "./getEnvValues";
import { getLayoutMetadata } from "./getLayoutMetadata";
import { type BuildSchemaArgs, typegenConfig, type typegenConfigSingle } from "./types";

type GlobalOptions = Omit<z.infer<typeof typegenConfig>, "config">;

export const generateTypedClients = async (
  config: z.infer<typeof typegenConfig>["config"],
  options?: GlobalOptions & { resetOverrides?: boolean; cwd?: string; configPath?: string },
): Promise<
  | {
      successCount: number;
      errorCount: number;
      totalCount: number;
      outputPaths: string[];
    }
  | undefined
> => {
  const parsedConfig = typegenConfig.safeParse({ config });
  if (!parsedConfig.success) {
    console.log(chalk.red("ERROR: Invalid config"));
    console.log(config);
    console.dir(parsedConfig.error, { depth: null });
    return;
  }

  const configArray = Array.isArray(parsedConfig.data.config) ? parsedConfig.data.config : [parsedConfig.data.config];
  const postGenerateCommand = options?.postGenerateCommand ?? parsedConfig.data.postGenerateCommand;

  const { resetOverrides = false, cwd = process.cwd() } = options ?? {};

  let totalSuccessCount = 0;
  let totalErrorCount = 0;
  let totalCount = 0;
  const outputPaths: string[] = [];

  const isConfigArray = Array.isArray(parsedConfig.data.config);
  for (let configIndex = 0; configIndex < configArray.length; configIndex++) {
    const singleConfig = configArray[configIndex];
    if (!singleConfig) continue;
    if (singleConfig.type === "fmdapi") {
      const result = await generateTypedClientsSingle(singleConfig, {
        resetOverrides,
        cwd,
        configPath: options?.configPath,
        configIndex: isConfigArray ? configIndex : undefined,
      });
      if (result) {
        totalSuccessCount += result.successCount;
        totalErrorCount += result.errorCount;
        totalCount += result.totalCount;
        if (result.outputPath) {
          outputPaths.push(result.outputPath);
        }
      }
    } else if (singleConfig.type === "fmodata") {
      const outputPath = await generateODataTablesSingle(singleConfig, { cwd });
      if (outputPath) {
        outputPaths.push(outputPath);
      }
    } else {
      console.log(chalk.red("ERROR: Invalid config type"));
    }
  }

  // Run post-generate command once after all configs have been processed
  await runPostGenerateCommand(postGenerateCommand, cwd);

  return { successCount: totalSuccessCount, errorCount: totalErrorCount, totalCount, outputPaths };
};

const generateTypedClientsSingle = async (
  config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }>,
  options?: GlobalOptions & { resetOverrides?: boolean; cwd?: string; configPath?: string; configIndex?: number },
) => {
  const {
    envNames,
    layouts,
    clientSuffix = "Client",

    generateClient = true,
    clearOldFiles = false,
    ...rest
  } = config;

  const { resetOverrides = false, cwd = process.cwd() } = options ?? {};

  const validator = rest.validator ?? "zod/v4";

  const rootDir = path.join(cwd, rest.path ?? "schema");

  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8")) as PackageJson;
    const fmdapiVersion = packageJson.dependencies?.["@proofkit/fmdapi"];
    if (fmdapiVersion && semver.valid(fmdapiVersion)) {
      const isAtLeast501 = semver.satisfies(fmdapiVersion, ">=5.0.1");
      if (!isAtLeast501) {
        console.log(
          chalk.yellow(
            "WARNING: @proofkit/typegen will generate types only compatible with @proofkit/fmdapi version 5.0.1 or higher. Please update to the latest version of @proofkit/fmdapi",
          ),
        );
      }
    }
  } catch (_e) {
    // ignore
  }

  const project = new Project({
    manipulationSettings: {
      indentationText: IndentationText.TwoSpaces,
    },
  });

  const isFmHttpMode = config.fmHttp != null && config.fmHttp.enabled !== false;
  const fmHttpObj = config.fmHttp ?? undefined;

  if (isFmHttpMode && !config.webviewerScriptName) {
    console.log(chalk.blue(`INFO: Generated clients will use WebViewerAdapter with script "${fmHttpObj?.scriptName ?? "execute_data_api"}".`));
  }

  const envValues = getEnvValues(envNames);
  const validationResult = validateAndLogEnvValues(envValues, envNames, {
    fmHttp: isFmHttpMode,
    fmHttpConfig: isFmHttpMode ? { baseUrl: fmHttpObj?.baseUrl, connectedFileName: fmHttpObj?.connectedFileName } : undefined,
  });

  if (!validationResult?.success) {
    return;
  }

  // Extract connection details based on mode
  let server: string | undefined;
  let db: string | undefined;
  let auth: { apiKey: OttoAPIKey } | { username: string; password: string } | undefined;
  let fmHttpBaseUrl: string | undefined;
  let fmHttpConnectedFileName: string | undefined;

  if (validationResult.mode === "fmHttp") {
    fmHttpBaseUrl = validationResult.baseUrl;
    fmHttpConnectedFileName = validationResult.connectedFileName;

    // Auto-discover connectedFileName if not provided
    if (!fmHttpConnectedFileName) {
      try {
        const res = await fetch(`${fmHttpBaseUrl}/connectedFiles`);
        if (res.ok) {
          const files = (await res.json()) as string[];
          if (files.length === 1) {
            fmHttpConnectedFileName = files[0];
            console.log(chalk.green(`Auto-discovered connected file: ${fmHttpConnectedFileName}`));

            // Write discovered connectedFileName back to config file
            if (options?.configPath) {
              const configFilePath = path.resolve(cwd, options.configPath);
              try {
                const raw = fs.readFileSync(configFilePath, "utf8");
                const { modify, applyEdits } = await import("jsonc-parser");
                const fmtOpts = { formattingOptions: { insertSpaces: true, tabSize: 2 } };
                // Build the JSON path: array configs use ["config", index, "fmHttp", ...], single uses ["config", "fmHttp", ...]
                const basePath = options.configIndex !== undefined
                  ? ["config", options.configIndex, "fmHttp"]
                  : ["config", "fmHttp"];

                // If fmHttp was `true` in the raw file, replace it with an object first
                let current = raw;
                const parsed = (await import("jsonc-parser")).parseTree(raw);
                if (parsed) {
                  const { findNodeAtLocation } = await import("jsonc-parser");
                  const fmHttpNode = findNodeAtLocation(parsed, basePath);
                  if (fmHttpNode?.type === "boolean") {
                    const replaceEdits = modify(current, basePath, { enabled: true, connectedFileName: fmHttpConnectedFileName }, fmtOpts);
                    current = applyEdits(current, replaceEdits);
                    fs.writeFileSync(configFilePath, current, "utf8");
                    console.log(chalk.green(`Updated config with connectedFileName: ${fmHttpConnectedFileName}`));
                  } else {
                    const edits = modify(current, [...basePath, "connectedFileName"], fmHttpConnectedFileName, fmtOpts);
                    current = applyEdits(current, edits);
                    fs.writeFileSync(configFilePath, current, "utf8");
                    console.log(chalk.green(`Updated config with connectedFileName: ${fmHttpConnectedFileName}`));
                  }
                }
              } catch (writeErr) {
                console.log(chalk.yellow(`Could not update config file: ${writeErr instanceof Error ? writeErr.message : String(writeErr)}`));
              }
            }
          } else if (files.length > 1) {
            console.log(chalk.red("ERROR: Multiple connected files found. Please specify connectedFileName in your fmHttp config."));
            console.log(chalk.yellow(`Connected files: ${files.join(", ")}`));
            return;
          } else {
            console.log(chalk.red("ERROR: No connected files found on the FM HTTP server."));
            return;
          }
        } else {
          console.log(chalk.red(`ERROR: Failed to auto-discover connected files from ${fmHttpBaseUrl}/connectedFiles`));
          return;
        }
      } catch (err) {
        console.log(chalk.red(`ERROR: Could not reach FM HTTP server at ${fmHttpBaseUrl}`));
        console.log(chalk.yellow("Ensure the FM HTTP server is running and accessible."));
        return;
      }
    }
  } else {
    server = validationResult.server;
    db = validationResult.db;
    const validatedAuth = validationResult.auth;
    auth = "apiKey" in validatedAuth ? { apiKey: validatedAuth.apiKey as OttoAPIKey } : validatedAuth;
  }

  await fs.ensureDir(rootDir);
  if (clearOldFiles) {
    fs.emptyDirSync(path.join(rootDir, "client"));
    fs.emptyDirSync(path.join(rootDir, "generated"));
  }
  const clientIndexFilePath = path.join(rootDir, "client", "index.ts");
  fs.rmSync(clientIndexFilePath, { force: true }); // ensure clean slate for this file

  let successCount = 0;
  let errorCount = 0;
  let totalCount = 0;

  for await (const item of layouts) {
    totalCount++;
    let client: ReturnType<typeof DataApi>;
    if (isFmHttpMode) {
      client = DataApi({
        adapter: new FmHttpAdapter({
          baseUrl: fmHttpBaseUrl as string,
          connectedFileName: fmHttpConnectedFileName as string,
          scriptName: fmHttpObj?.scriptName ?? config.webviewerScriptName,
        }),
        layout: item.layoutName,
      });
    } else if (auth && "apiKey" in auth) {
      client = DataApi({
        adapter: new OttoAdapter({ auth, server: server as string, db: db as string }),
        layout: item.layoutName,
      });
    } else {
      client = DataApi({
        adapter: new FetchAdapter({
          auth: auth as { username: string; password: string },
          server: server as string,
          db: db as string,
          tokenStore: memoryStore(),
        }),
        layout: item.layoutName,
      });
    }
    const result = await getLayoutMetadata({
      client,
      valueLists: item.valueLists,
    });

    if (!result) {
      errorCount++;
      continue;
    }

    const { schema, portalSchema, valueLists } = result;
    const args: BuildSchemaArgs = {
      schemaName: item.schemaName,
      schema,
      layoutName: item.layoutName,
      portalSchema,
      valueLists,
      type: validator === "zod" || validator === "zod/v4" || validator === "zod/v3" ? validator : "ts",
      strictNumbers: item.strictNumbers,
      webviewerScriptName: config?.type === "fmdapi" ? config.webviewerScriptName : undefined,
      fmHttp: config?.type === "fmdapi" ? !!config.fmHttp : undefined,
      envNames: (() => {
        // FM HTTP mode: only need baseUrl + connectedFileName
        if (isFmHttpMode) {
          return {
            fmHttp: {
              baseUrl: envNames?.fmHttp?.baseUrl ?? defaultEnvNames.fmHttpBaseUrl,
              connectedFileName: envNames?.fmHttp?.connectedFileName ?? defaultEnvNames.fmHttpConnectedFileName,
            },
          };
        }

        // Determine the intended auth type based on config AND runtime.
        // Priority:
        // 1. If user explicitly specified apiKey in config → use OttoAdapter
        // 2. If user explicitly specified username in config → use FetchAdapter
        // 3. If neither specified (defaults) → use what was actually used at runtime
        //
        // Note: We check for the VALUE being defined, not just the property existing,
        // because the Zod schema defines both apiKey and username as optional properties,
        // so both exist on the object but with undefined values when not specified.
        const configHasApiKey = envNames?.auth?.apiKey !== undefined;
        const configHasUsername = envNames?.auth?.username !== undefined;
        const runtimeUsedApiKey = auth ? "apiKey" in auth : false;

        // Use apiKey if: explicitly specified in config, OR not explicitly set to username AND runtime used apiKey
        const useApiKey = configHasApiKey || (!configHasUsername && runtimeUsedApiKey);

        // Determine the env var names to use in generated code
        const apiKeyEnvName = envNames?.auth?.apiKey ?? defaultEnvNames.apiKey;
        const usernameEnvName = envNames?.auth?.username ?? defaultEnvNames.username;
        const passwordEnvName = envNames?.auth?.password ?? defaultEnvNames.password;

        return {
          auth: useApiKey
            ? {
                apiKey: apiKeyEnvName,
                username: undefined,
                password: undefined,
              }
            : {
                apiKey: undefined,
                username: usernameEnvName,
                password: passwordEnvName,
              },
          db: envNames?.db ?? defaultEnvNames.db,
          server: envNames?.server ?? defaultEnvNames.server,
        };
      })(),
    };
    const schemaFile = project.createSourceFile(
      path.join(rootDir, "generated", `${item.schemaName}.ts`),
      { leadingTrivia: commentHeader },
      {
        overwrite: true,
        scriptKind: ScriptKind.TS,
      },
    );
    buildSchema(schemaFile, args);

    const overrideFilePath = path.join(rootDir, `${item.schemaName}.ts`);
    if (!fs.existsSync(overrideFilePath) || resetOverrides) {
      // only build the override file if it doesn't exist
      const overrideFile = project.createSourceFile(
        overrideFilePath,
        {
          leadingTrivia: overrideCommentHeader,
        },
        {
          overwrite: true,
          scriptKind: ScriptKind.TS,
        },
      );
      buildOverrideFile(overrideFile, schemaFile, args);
    }

    if (item.generateClient ?? generateClient) {
      await fs.ensureDir(path.join(rootDir, "client"));
      const layoutClientFile = project.createSourceFile(
        path.join(rootDir, "client", `${item.schemaName}.ts`),
        { leadingTrivia: commentHeader },
        {
          overwrite: true,
          scriptKind: ScriptKind.TS,
        },
      );
      buildLayoutClient(layoutClientFile, args);

      await fs.ensureFile(clientIndexFilePath);
      const clientIndexFile = project.addSourceFileAtPath(clientIndexFilePath);
      clientIndexFile.addExportDeclaration({
        namedExports: [{ name: "client", alias: `${item.schemaName}${clientSuffix}` }],
        moduleSpecifier: `./${item.schemaName}`,
      });
    } else {
      console.log(chalk.yellow(`Skipping client generation for ${item.schemaName} because generateClient is false`));
    }
    successCount++;
  }

  // Format and save files
  await formatAndSaveSourceFiles(project, cwd);

  return { successCount, errorCount, totalCount, outputPath: rootDir };
};
