import path from "node:path";
import { generateTypedClients } from "@proofkit/typegen";
import type { typegenConfigSingle } from "@proofkit/typegen/config";
import { config as dotenvConfig } from "dotenv";
import fs from "fs-extra";
import { applyEdits, modify, parse as parseJsonc } from "jsonc-parser";
import { SyntaxKind } from "ts-morph";
import type { z } from "zod/v4";

import { state } from "~/state.js";
import { logger } from "~/utils/logger.js";
import type { envNamesSchema } from "~/utils/parseSettings.js";
import { getNewProject } from "~/utils/ts-morph.js";

// Input schema for functions like addLayout
// This might be different from the layout config stored in the file
interface Schema {
  layoutName: string;
  schemaName: string;
  valueLists?: "strict" | "allowEmpty" | "ignore";
  generateClient?: boolean;
  strictNumbers?: boolean;
}

// For any data source configuration object (fmdapi or fmodata)
type AnyDataSourceConfig = z.infer<typeof typegenConfigSingle>;
// For a single fmdapi data source configuration object
type FmdapiDataSourceConfig = Extract<AnyDataSourceConfig, { type: "fmdapi" }>;
// For a single layout configuration object within a data source
type ImportedLayoutConfig = FmdapiDataSourceConfig["layouts"][number];

// This type represents the actual structure of the JSONC file, including $schema
interface FullProofkitTypegenJsonFile {
  $schema?: string;
  config: AnyDataSourceConfig | AnyDataSourceConfig[];
}

const typegenConfigFileName = "proofkit-typegen.config.jsonc";

// Helper function to normalize data sources by adding default type for backwards compatibility
// This mirrors the zod preprocess in @proofkit/typegen that defaults type to "fmdapi"
function normalizeDataSource(ds: AnyDataSourceConfig): AnyDataSourceConfig {
  if (!("type" in ds) || ds.type === undefined) {
    return { ...(ds as object), type: "fmdapi" } as AnyDataSourceConfig;
  }
  return ds;
}

function normalizeConfig(
  config: AnyDataSourceConfig | AnyDataSourceConfig[],
): AnyDataSourceConfig | AnyDataSourceConfig[] {
  if (Array.isArray(config)) {
    return config.map(normalizeDataSource);
  }
  return normalizeDataSource(config);
}

// Helper functions for JSON config
async function readJsonConfigFile(configPath: string): Promise<FullProofkitTypegenJsonFile | null> {
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    const fileContent = await fs.readFile(configPath, "utf8");
    const parsed = parseJsonc(fileContent) as FullProofkitTypegenJsonFile;
    // Normalize config to add default type for backwards compatibility
    if (parsed.config) {
      parsed.config = normalizeConfig(parsed.config);
    }
    return parsed;
  } catch (error) {
    console.error(`Error reading or parsing JSONC config at ${configPath}:`, error);
    // Return a default structure for the *file* if parsing fails but file exists
    return {
      $schema: "https://proofkit.dev/typegen-config-schema.json",
      config: [],
    };
  }
}

async function writeJsonConfigFile(configPath: string, fileContent: FullProofkitTypegenJsonFile) {
  // Check if file exists to preserve comments
  if (fs.existsSync(configPath)) {
    const originalText = await fs.readFile(configPath, "utf8");
    // Use jsonc-parser's modify function to preserve comments
    const edits = modify(originalText, ["config"], fileContent.config, {
      formattingOptions: {
        tabSize: 2,
        insertSpaces: true,
        eol: "\n",
      },
    });
    const modifiedText = applyEdits(originalText, edits);
    await fs.writeFile(configPath, modifiedText, "utf8");
  } else {
    // If file doesn't exist, create it with proper formatting
    await fs.writeJson(configPath, fileContent, { spaces: 2 });
  }
}

export async function addLayout({
  projectDir = process.cwd(),
  schemas,
  runCodegen = true,
  dataSourceName,
}: {
  projectDir?: string;
  schemas: Schema[];
  runCodegen?: boolean;
  dataSourceName: string;
}) {
  const jsonConfigPath = path.join(projectDir, typegenConfigFileName);
  let fileContent = await readJsonConfigFile(jsonConfigPath);

  if (!fileContent) {
    fileContent = {
      $schema: "https://proofkit.dev/typegen-config-schema.json",
      config: [],
    };
  }

  // Work with the 'config' property which is TypegenConfig['config']
  const configProperty = fileContent.config;

  let configArray: AnyDataSourceConfig[];
  if (Array.isArray(configProperty)) {
    configArray = configProperty;
  } else {
    configArray = [configProperty];
    fileContent.config = configArray; // Update fileContent to ensure it's an array for later ops
  }

  const layoutsToAdd: ImportedLayoutConfig[] = schemas.map((schema) => ({
    layoutName: schema.layoutName,
    schemaName: schema.schemaName,
    valueLists: schema.valueLists,
    generateClient: schema.generateClient,
    strictNumbers: schema.strictNumbers,
  }));

  let targetDataSource: FmdapiDataSourceConfig | undefined = configArray.find(
    (ds): ds is FmdapiDataSourceConfig =>
      ds.type === "fmdapi" &&
      (ds.path?.endsWith(dataSourceName) || ds.path?.endsWith(`${dataSourceName}/`) || ds.path === dataSourceName),
  );

  if (targetDataSource) {
    targetDataSource.layouts = targetDataSource.layouts || [];
  } else {
    targetDataSource = {
      type: "fmdapi",
      layouts: [],
      path: `./src/config/schemas/${dataSourceName}`,
      // other default properties for a new DataSourceConfig can be added here if needed
      envNames: undefined,
    };
    configArray.push(targetDataSource);
  }

  targetDataSource.layouts.push(...layoutsToAdd);
  // fileContent.config is already pointing to configArray if it was modified

  await writeJsonConfigFile(jsonConfigPath, fileContent);

  if (runCodegen) {
    await runCodegenCommand();
  }
}

export async function addConfig({
  config,
  projectDir,
  runCodegen = true,
}: {
  config: FmdapiDataSourceConfig | FmdapiDataSourceConfig[];
  projectDir: string;
  runCodegen?: boolean;
}) {
  const jsonConfigPath = path.join(projectDir, typegenConfigFileName);
  let fileContent = await readJsonConfigFile(jsonConfigPath);

  const configsToAdd = Array.isArray(config) ? config : [config];

  if (fileContent) {
    if (Array.isArray(fileContent.config)) {
      fileContent.config.push(...configsToAdd);
    } else {
      fileContent.config = [fileContent.config, ...configsToAdd];
    }
  } else {
    fileContent = {
      $schema: "https://proofkit.dev/typegen-config-schema.json",
      config: configsToAdd,
    };
  }

  await writeJsonConfigFile(jsonConfigPath, fileContent);

  if (runCodegen) {
    await runCodegenCommand();
  }
}

export async function ensureWebviewerFmHttpConfig({
  projectDir,
  connectedFileName,
  dataSourceName = "filemaker",
  baseUrl,
}: {
  projectDir: string;
  connectedFileName?: string;
  dataSourceName?: string;
  baseUrl?: string;
}) {
  const newConfig: FmdapiDataSourceConfig = {
    type: "fmdapi",
    path: `./src/config/schemas/${dataSourceName}`,
    clearOldFiles: true,
    clientSuffix: "Layout",
    webviewerScriptName: "ExecuteDataApi",
    envNames: undefined,
    layouts: [],
    fmHttp: {
      enabled: true,
      ...(baseUrl ? { baseUrl } : {}),
      ...(connectedFileName ? { connectedFileName } : {}),
    },
  };

  const jsonConfigPath = path.join(projectDir, typegenConfigFileName);
  let fileContent = await readJsonConfigFile(jsonConfigPath);

  if (!fileContent) {
    fileContent = {
      $schema: "https://proofkit.dev/typegen-config-schema.json",
      config: [newConfig],
    };
    await writeJsonConfigFile(jsonConfigPath, fileContent);
    return;
  }

  const configArray = Array.isArray(fileContent.config) ? fileContent.config : [fileContent.config];
  if (!Array.isArray(fileContent.config)) {
    fileContent.config = configArray;
  }

  const existingConfigIndex = configArray.findIndex(
    (config): config is FmdapiDataSourceConfig => config.type === "fmdapi" && config.path === newConfig.path,
  );

  if (existingConfigIndex === -1) {
    configArray.push(newConfig);
  } else {
    const existingConfig = configArray[existingConfigIndex] as FmdapiDataSourceConfig;
    configArray[existingConfigIndex] = {
      ...existingConfig,
      ...newConfig,
      layouts: existingConfig.layouts ?? [],
      fmHttp: {
        enabled: true,
        ...(existingConfig.fmHttp ?? {}),
        ...(newConfig.fmHttp ?? {}),
      },
    };
  }

  await writeJsonConfigFile(jsonConfigPath, fileContent);
}

export async function runCodegenCommand() {
  const projectDir = state.projectDir;
  const config = await readJsonConfigFile(path.join(projectDir, typegenConfigFileName));
  if (!config) {
    logger.info("no typegen config found, skipping typegen");
    return;
  }

  // make sure to load the .env file
  dotenvConfig({ path: path.join(projectDir, ".env") });
  await generateTypedClients(config.config, { cwd: projectDir });
}

export function getClientSuffix({
  projectDir = process.cwd(),
  dataSourceName,
}: {
  projectDir?: string;
  dataSourceName: string;
}): string {
  const jsonConfigPath = path.join(projectDir, typegenConfigFileName);
  if (!fs.existsSync(jsonConfigPath)) {
    return "Client";
  }
  try {
    const fileContent = fs.readFileSync(jsonConfigPath, "utf8");
    const parsed = parseJsonc(fileContent) as FullProofkitTypegenJsonFile;

    // Normalize config to add default type for backwards compatibility
    const normalizedConfig = normalizeConfig(parsed.config);
    const configToSearch = Array.isArray(normalizedConfig) ? normalizedConfig : [normalizedConfig];

    const targetDataSource = configToSearch.find(
      (ds): ds is FmdapiDataSourceConfig =>
        ds.type === "fmdapi" &&
        (ds.path?.endsWith(dataSourceName) || ds.path?.endsWith(`${dataSourceName}/`) || ds.path === dataSourceName),
    );
    return targetDataSource?.clientSuffix ?? "Client";
  } catch (error) {
    console.error(`Error reading or parsing JSONC config for getClientSuffix: ${jsonConfigPath}`, error);
    return "Client";
  }
}

export function getExistingSchemas({
  projectDir = process.cwd(),
  dataSourceName,
}: {
  projectDir?: string;
  dataSourceName: string;
}): { layout?: string; schemaName?: string }[] {
  const jsonConfigPath = path.join(projectDir, typegenConfigFileName);
  if (!fs.existsSync(jsonConfigPath)) {
    return [];
  }
  try {
    const fileContent = fs.readFileSync(jsonConfigPath, "utf8");
    const parsed = parseJsonc(fileContent) as FullProofkitTypegenJsonFile;

    // Normalize config to add default type for backwards compatibility
    const normalizedConfig = normalizeConfig(parsed.config);
    const configToSearch = Array.isArray(normalizedConfig) ? normalizedConfig : [normalizedConfig];

    const targetDataSource = configToSearch.find(
      (ds): ds is FmdapiDataSourceConfig =>
        ds.type === "fmdapi" &&
        (ds.path?.endsWith(dataSourceName) || ds.path?.endsWith(`${dataSourceName}/`) || ds.path === dataSourceName),
    );

    if (targetDataSource?.layouts) {
      return targetDataSource.layouts.map((layout) => ({
        layout: layout.layoutName,
        schemaName: layout.schemaName,
      }));
    }
    return [];
  } catch (error) {
    console.error(`Error reading or parsing JSONC config for getExistingSchemas: ${jsonConfigPath}`, error);
    return [];
  }
}

export async function addToFmschemaConfig({
  dataSourceName,
  envNames,
}: {
  dataSourceName: string;
  envNames?: z.infer<typeof envNamesSchema>;
}) {
  const projectDir = state.projectDir;
  const jsonConfigPath = path.join(projectDir, typegenConfigFileName);
  let fileContent = await readJsonConfigFile(jsonConfigPath);

  const newDataSource: FmdapiDataSourceConfig = {
    type: "fmdapi",
    layouts: [],
    path: `./src/config/schemas/${dataSourceName}`,
    envNames: undefined,
    clearOldFiles: true,
    clientSuffix: "Layout",
  };

  if (envNames) {
    newDataSource.envNames = {
      server: envNames.server,
      db: envNames.database,
      auth: { apiKey: envNames.apiKey },
    };
  }
  if (state.appType === "webviewer") {
    newDataSource.webviewerScriptName = "ExecuteDataApi";
  }

  if (fileContent) {
    let configArray: AnyDataSourceConfig[];
    if (Array.isArray(fileContent.config)) {
      configArray = fileContent.config;
    } else {
      configArray = [fileContent.config];
      fileContent.config = configArray;
    }

    const existingDsIndex = configArray.findIndex((ds) => ds.type === "fmdapi" && ds.path === newDataSource.path);
    if (existingDsIndex === -1) {
      configArray.push(newDataSource);
    } else {
      const existingConfig = configArray[existingDsIndex] as FmdapiDataSourceConfig;
      configArray[existingDsIndex] = {
        ...existingConfig,
        ...newDataSource,
        layouts: newDataSource.layouts.length > 0 ? newDataSource.layouts : existingConfig.layouts || [],
      };
    }
  } else {
    fileContent = {
      $schema: "https://proofkit.dev/typegen-config-schema.json",
      config: [newDataSource],
    };
  }
  await writeJsonConfigFile(jsonConfigPath, fileContent);
}

export function getFieldNamesForSchema({ schemaName, dataSourceName }: { schemaName: string; dataSourceName: string }) {
  const projectDir = state.projectDir;
  const project = getNewProject(projectDir);
  const sourceFilePath = path.join(projectDir, `src/config/schemas/${dataSourceName}/generated/${schemaName}.ts`);

  const sourceFilePathAlternative = path.join(projectDir, `src/config/schemas/${dataSourceName}/${schemaName}.ts`);

  let fileToUse = sourceFilePath;
  if (!fs.existsSync(sourceFilePath)) {
    if (fs.existsSync(sourceFilePathAlternative)) {
      fileToUse = sourceFilePathAlternative;
    } else {
      return [];
    }
  }
  const sourceFile = project.addSourceFileAtPath(fileToUse);

  const zodSchema = sourceFile.getVariableDeclaration(`Z${schemaName}`);
  if (zodSchema) {
    const properties = zodSchema
      .getInitializer()
      ?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression)
      ?.getProperties();
    return (
      properties?.map((pr) => pr.asKind(SyntaxKind.PropertyAssignment)?.getName()?.replace(/"/g, "")).filter(Boolean) ??
      []
    );
  }
  const typeAlias = sourceFile.getTypeAlias(`T${schemaName}`);
  const properties = typeAlias?.getFirstDescendantByKind(SyntaxKind.TypeLiteral)?.getProperties();
  return (
    properties?.map((pr) => pr.asKind(SyntaxKind.PropertySignature)?.getName()?.replace(/"/g, "")).filter(Boolean) ?? []
  );
}

export async function removeFromFmschemaConfig({ dataSourceName }: { dataSourceName: string }) {
  const projectDir = state.projectDir;
  const jsonConfigPath = path.join(projectDir, typegenConfigFileName);
  const fileContent = await readJsonConfigFile(jsonConfigPath);

  if (!fileContent) {
    return;
  }

  const pathToRemove = `./src/config/schemas/${dataSourceName}`;

  if (Array.isArray(fileContent.config)) {
    fileContent.config = fileContent.config.filter((ds) => !(ds.type === "fmdapi" && ds.path === pathToRemove));
  } else {
    const currentConfig = fileContent.config;
    if (currentConfig.type === "fmdapi" && currentConfig.path === pathToRemove) {
      fileContent.config = [];
    }
  }
  await writeJsonConfigFile(jsonConfigPath, fileContent);
}

export async function removeLayout({
  projectDir = state.projectDir,
  schemaName,
  dataSourceName,
  runCodegen = true,
}: {
  projectDir?: string;
  schemaName: string;
  dataSourceName: string;
  runCodegen?: boolean;
}) {
  const jsonConfigPath = path.join(projectDir, typegenConfigFileName);
  const fileContent = await readJsonConfigFile(jsonConfigPath);

  if (!fileContent) {
    throw new Error(`${typegenConfigFileName} not found, cannot remove layout.`);
  }

  let dataSourceModified = false;
  const targetDsPath = `./src/config/schemas/${dataSourceName}`;

  let configArray: AnyDataSourceConfig[];
  if (Array.isArray(fileContent.config)) {
    configArray = fileContent.config;
  } else {
    configArray = [fileContent.config];
    fileContent.config = configArray;
  }

  const targetDataSource = configArray.find(
    (ds): ds is FmdapiDataSourceConfig => ds.type === "fmdapi" && ds.path === targetDsPath,
  );

  if (targetDataSource?.layouts) {
    const initialCount = targetDataSource.layouts.length;
    targetDataSource.layouts = targetDataSource.layouts.filter((layout) => layout.schemaName !== schemaName);
    if (targetDataSource.layouts.length < initialCount) {
      dataSourceModified = true;
    }
  }

  if (dataSourceModified) {
    await writeJsonConfigFile(jsonConfigPath, fileContent);
  }

  const schemaFilePath = path.join(projectDir, "src", "config", "schemas", dataSourceName, `${schemaName}.ts`);
  if (fs.existsSync(schemaFilePath)) {
    fs.removeSync(schemaFilePath);
  }

  if (runCodegen && dataSourceModified) {
    await runCodegenCommand();
  }
}

// Make sure to remove unused imports like Project, SyntaxKind, etc. if they are no longer used anywhere.
// Also remove getNewProject and formatAndSaveSourceFiles from imports if they were only for config.
