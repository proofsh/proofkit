import { readFileSync } from "node:fs";
import path from "node:path";
import { applyEdits, modify, parse as parseJsonc } from "jsonc-parser/lib/esm/main.js";
import { PKG_ROOT } from "~/consts.js";
import type { FileMakerEnvNames } from "~/core/types.js";
import type { PackageManager } from "~/utils/packageManager.js";

const commonFileMakerLayoutPrefixes = ["API_", "API ", "dapi_", "dapi"];
const TRAILING_SLASH_REGEX = /[^/]$/;
const WHITESPACE_REGEX = /\s/;
const DEFAULT_FM_MCP_BASE_URL = "http://127.0.0.1:1365";
const textFileExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".jsonc",
  ".md",
  ".css",
  ".scss",
  ".html",
  ".mjs",
  ".cjs",
]);

export function getDefaultSchemaName(layoutName: string) {
  let schemaName = layoutName.replace(/[-\s]/g, "_");
  for (const prefix of commonFileMakerLayoutPrefixes) {
    if (schemaName.startsWith(prefix)) {
      schemaName = schemaName.replace(prefix, "");
    }
  }
  return schemaName;
}

export function createDataSourceEnvNames(dataSourceName: string): FileMakerEnvNames {
  if (dataSourceName === "filemaker") {
    return {
      database: "FM_DATABASE",
      server: "FM_SERVER",
      apiKey: "OTTO_API_KEY",
    };
  }

  const upperName = dataSourceName.toUpperCase();
  return {
    database: `${upperName}_FM_DATABASE`,
    server: `${upperName}_FM_SERVER`,
    apiKey: `${upperName}_OTTO_API_KEY`,
  };
}

export function formatPackageManagerCommand(packageManager: PackageManager, command: string) {
  return ["npm", "bun"].includes(packageManager) ? `${packageManager} run ${command}` : `${packageManager} ${command}`;
}

export function parseCommandString(command: string) {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  let escaping = false;

  for (const char of command) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (WHITESPACE_REGEX.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += "\\";
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

export function getTemplatePackageCommand(packageManager: PackageManager) {
  if (packageManager === "npm") {
    return "npm run";
  }
  return packageManager;
}

export function getTemplatePackageExecuteCommand(packageManager: PackageManager) {
  if (packageManager === "npm") {
    return "npx";
  }
  if (packageManager === "pnpm") {
    return "pnpx";
  }
  if (packageManager === "bun") {
    return "bunx";
  }
  return `${packageManager} dlx`;
}

export function normalizeImportAlias(importAlias: string) {
  return importAlias.replace(/\*/g, "").replace(TRAILING_SLASH_REGEX, "$&/");
}

export async function replaceTextInFiles(
  fs: {
    readdir: (path: string) => Promise<string[]>;
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
  },
  rootDir: string,
  searchValue: string,
  replaceValue: string,
) {
  const entries = await fs.readdir(rootDir);
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry);
    const childEntries = await fs.readdir(fullPath).catch((error: unknown) => {
      const code =
        typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
          ? error.code
          : undefined;

      if (code === "ENOTDIR") {
        return undefined;
      }

      throw error;
    });
    if (childEntries) {
      await replaceTextInFiles(fs, fullPath, searchValue, replaceValue);
      continue;
    }

    const extension = path.extname(entry);
    if (!textFileExtensions.has(extension)) {
      continue;
    }

    const content = await fs.readFile(fullPath).catch(() => undefined);
    if (!content?.includes(searchValue)) {
      continue;
    }

    await fs.writeFile(fullPath, content.replaceAll(searchValue, replaceValue));
  }
}

export async function updateEnvSchemaFile(
  fs: {
    exists: (path: string) => Promise<boolean>;
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
  },
  projectDir: string,
  envEntries: Array<{ name: string; zodSchema: string }>,
) {
  const envFilePath = path.join(projectDir, "src/lib/env.ts");
  if (!(await fs.exists(envFilePath))) {
    return;
  }

  let content = await fs.readFile(envFilePath);
  const marker = "  server: {";
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) {
    return;
  }

  const insertIndex = content.indexOf("  },", markerIndex);
  if (insertIndex === -1) {
    return;
  }

  const additions = envEntries
    .filter((entry) => !content.includes(`${entry.name}:`))
    .map((entry) => `    ${entry.name}: ${entry.zodSchema},`)
    .join("\n");

  if (!additions) {
    return;
  }

  content = `${content.slice(0, insertIndex)}${additions}\n${content.slice(insertIndex)}`;
  await fs.writeFile(envFilePath, content);
}

interface TypegenFileContent {
  $schema?: string;
  config: Record<string, unknown>[] | Record<string, unknown>;
}

export async function updateTypegenConfig(
  fs: {
    exists: (path: string) => Promise<boolean>;
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
  },
  projectDir: string,
  options: {
    appType: "browser" | "webviewer";
    dataSourceName: string;
    envNames?: FileMakerEnvNames;
    fmMcpBaseUrl?: string;
    connectedFileName?: string;
    layoutName?: string;
    schemaName?: string;
  },
) {
  const configPath = path.join(projectDir, "proofkit-typegen.config.jsonc");
  const dsPath = `./src/config/schemas/${options.dataSourceName}`;
  const nextDataSource: Record<string, unknown> = {
    type: "fmdapi",
    layouts: [],
    path: dsPath,
    clearOldFiles: true,
    clientSuffix: "Layout",
  };

  if (options.envNames) {
    nextDataSource.envNames = {
      server: options.envNames.server,
      db: options.envNames.database,
      auth: { apiKey: options.envNames.apiKey },
    };
  }

  if (options.appType === "webviewer") {
    nextDataSource.webviewerScriptName = "ExecuteDataApi";
  }

  if (options.fmMcpBaseUrl || options.connectedFileName) {
    nextDataSource.fmMcp = {
      enabled: true,
      ...(options.fmMcpBaseUrl && options.fmMcpBaseUrl !== DEFAULT_FM_MCP_BASE_URL
        ? { baseUrl: options.fmMcpBaseUrl }
        : {}),
      ...(options.connectedFileName ? { connectedFileName: options.connectedFileName } : {}),
    };
  }

  const layout =
    options.layoutName && options.schemaName
      ? {
          layoutName: options.layoutName,
          schemaName: options.schemaName,
          valueLists: "allowEmpty",
        }
      : undefined;

  if (layout) {
    nextDataSource.layouts = [layout];
  }

  if (!(await fs.exists(configPath))) {
    const nextContent: TypegenFileContent = {
      $schema: "https://proofkit.proof.sh/typegen-config-schema.json",
      config: [nextDataSource],
    };
    await fs.writeFile(configPath, `${JSON.stringify(nextContent, null, 2)}\n`);
    return;
  }

  const original = await fs.readFile(configPath);
  const parsed = parseJsonc(original) as TypegenFileContent;
  const configArray = Array.isArray(parsed.config) ? parsed.config : [parsed.config];
  const existingIndex = configArray.findIndex((entry) => entry.path === dsPath);

  if (existingIndex === -1) {
    configArray.push(nextDataSource);
  } else {
    const existing = (configArray[existingIndex] ?? {}) as Record<string, unknown>;
    const existingLayouts = Array.isArray(existing.layouts) ? existing.layouts : [];
    let nextLayouts = existingLayouts;
    if (layout && !existingLayouts.some((item) => item?.layoutName === layout.layoutName)) {
      nextLayouts = [...existingLayouts, layout];
    }
    configArray[existingIndex] = {
      ...existing,
      ...nextDataSource,
      layouts: nextLayouts,
    };
  }

  const nextConfig = Array.isArray(parsed.config) ? configArray : (configArray[0] ?? nextDataSource);
  const edits = modify(original, ["config"], nextConfig, {
    formattingOptions: {
      insertSpaces: true,
      tabSize: 2,
      eol: "\n",
    },
  });
  await fs.writeFile(configPath, applyEdits(original, edits));
}

export function getScaffoldVersion() {
  const candidates = [path.resolve(PKG_ROOT, "package.json"), path.resolve(PKG_ROOT, "../cli/package.json")];

  for (const candidate of candidates) {
    try {
      const packageJson = JSON.parse(readFileSync(candidate, "utf8")) as { version?: string };
      if (packageJson.version && packageJson.version !== "0.0.0-private") {
        return packageJson.version;
      }
    } catch {
      // ignore and continue searching
    }
  }

  return "0.0.0-private";
}
