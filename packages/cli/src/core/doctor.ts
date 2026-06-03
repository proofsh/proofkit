import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import { Effect } from "effect";
import { parse as parseJsonc } from "jsonc-parser/lib/esm/main.js";
import { DOCS_URL } from "~/consts.js";
import { CliContext, ConsoleService, FileSystemService } from "~/core/context.js";

interface TypegenConfigEntry {
  type?: string;
  path?: string;
  fmMcp?: { enabled?: boolean; connectedFileName?: string };
  layouts?: unknown[];
  tables?: unknown[];
  envNames?: {
    server?: string;
    db?: string;
    auth?: {
      apiKey?: string;
      username?: string;
      password?: string;
    };
  };
}

function pushUnique(target: string[], value: string | undefined) {
  if (value && !target.includes(value)) {
    target.push(value);
  }
}

function isTypegenConfigLike(value: unknown): value is {
  config: TypegenConfigEntry | TypegenConfigEntry[];
} {
  return value !== null && typeof value === "object" && "config" in value;
}

export const runDoctor = Effect.gen(function* () {
  const cliContext = yield* CliContext;
  const fs = yield* FileSystemService;
  const consoleService = yield* ConsoleService;
  const cwd = cliContext.cwd;
  const readJsonSafe = <T>(targetPath: string) =>
    fs.readJson<T>(targetPath).pipe(
      Effect.match({
        onFailure: () => undefined,
        onSuccess: (value) => value,
      }),
    );
  const readFileSafe = (targetPath: string) =>
    fs.readFile(targetPath).pipe(
      Effect.match({
        onFailure: () => undefined,
        onSuccess: (value) => value,
      }),
    );

  const settingsPath = path.join(cwd, "proofkit.json");
  if (!(yield* fs.exists(settingsPath))) {
    consoleService.note(
      [
        "No ProofKit project found in this directory.",
        "",
        "Next steps:",
        "- Run `proofkit init` to create a new project",
        `- Docs: ${DOCS_URL}/docs/cli`,
      ].join("\n"),
      "Doctor",
    );
    return;
  }

  const findings: { level: "ok" | "warn" | "error"; message: string }[] = [];

  let settings:
    | {
        appType?: string;
        envFile?: string;
        dataSources?: {
          type?: string;
          envNames?: {
            database?: string;
            server?: string;
            apiKey?: string;
          };
        }[];
      }
    | undefined;

  settings = yield* readJsonSafe<typeof settings>(settingsPath);
  if (settings) {
    findings.push({ level: "ok", message: "Found `proofkit.json`." });
  } else {
    findings.push({
      level: "error",
      message: "Could not read `proofkit.json`.",
    });
  }

  const packageJsonPath = path.join(cwd, "package.json");
  let packageJson:
    | {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      }
    | undefined;

  if (yield* fs.exists(packageJsonPath)) {
    const nextPackageJson = yield* readJsonSafe<NonNullable<typeof packageJson>>(packageJsonPath);
    if (nextPackageJson) {
      packageJson = nextPackageJson;
      const allDeps = {
        ...(nextPackageJson.dependencies ?? {}),
        ...(nextPackageJson.devDependencies ?? {}),
      };

      if (allDeps["@proofkit/typegen"]) {
        findings.push({ level: "ok", message: "Found `@proofkit/typegen`." });
      } else {
        findings.push({
          level: "warn",
          message: "Missing `@proofkit/typegen` dependency.",
        });
      }

      if (nextPackageJson.scripts?.typegen) {
        findings.push({ level: "ok", message: "Found `typegen` script." });
      } else {
        findings.push({
          level: "warn",
          message: "Missing `typegen` script in `package.json`.",
        });
      }

      if (nextPackageJson.scripts?.["typegen:ui"]) {
        findings.push({ level: "ok", message: "Found `typegen:ui` script." });
      }
    } else {
      findings.push({
        level: "error",
        message: "Could not read `package.json`.",
      });
    }
  } else {
    findings.push({ level: "error", message: "Missing `package.json`." });
  }

  const typegenConfigPath = path.join(cwd, "proofkit-typegen.config.jsonc");
  let parsedTypegenConfig:
    | {
        config: TypegenConfigEntry | TypegenConfigEntry[];
      }
    | undefined;

  if (yield* fs.exists(typegenConfigPath)) {
    const raw = yield* readFileSafe(typegenConfigPath);
    if (raw) {
      const parsed = parseJsonc(raw);
      if (isTypegenConfigLike(parsed)) {
        parsedTypegenConfig = parsed;
        findings.push({
          level: "ok",
          message: "Typegen config is present and valid.",
        });

        const configEntries = Array.isArray(parsed.config) ? parsed.config : [parsed.config];
        for (const entry of configEntries) {
          const outputPath = path.join(cwd, entry.path ?? "schema");
          if (yield* fs.exists(outputPath)) {
            findings.push({
              level: "ok",
              message: `Generated path exists: \`${entry.path ?? "schema"}\`.`,
            });
          } else {
            findings.push({
              level: "warn",
              message: `Generated path missing: \`${entry.path ?? "schema"}\`. Run \`npx @proofkit/typegen\`.`,
            });
          }

          if (entry.type === "fmdapi" && (entry.layouts?.length ?? 0) === 0) {
            findings.push({
              level: "warn",
              message: "Typegen config has no layouts yet. Use `npx @proofkit/typegen ui`.",
            });
          }

          if (entry.type === "fmodata" && (entry.tables?.length ?? 0) === 0) {
            findings.push({
              level: "warn",
              message: "Typegen config has no tables yet. Use `npx @proofkit/typegen ui`.",
            });
          }

          if (entry.type === "fmdapi" && entry.fmMcp?.enabled && !entry.fmMcp.connectedFileName) {
            findings.push({
              level: "warn",
              message: "FM MCP is enabled but no connected file is pinned yet.",
            });
          }
        }
      } else {
        findings.push({
          level: "error",
          message: "Typegen config exists but is invalid. Open `npx @proofkit/typegen ui` or fix the JSONC file.",
        });
      }
    } else {
      findings.push({
        level: "error",
        message: "Could not read `proofkit-typegen.config.jsonc`.",
      });
    }
  } else {
    findings.push({
      level: "warn",
      message: "Missing `proofkit-typegen.config.jsonc`. Run `npx @proofkit/typegen init`.",
    });
  }

  const envCandidates = [
    settings?.envFile ? path.join(cwd, settings.envFile) : undefined,
    path.join(cwd, ".env.local"),
    path.join(cwd, ".env"),
  ].filter((value): value is string => Boolean(value));

  let resolvedEnvPath: string | undefined;
  for (const candidate of envCandidates) {
    if (yield* fs.exists(candidate)) {
      resolvedEnvPath = candidate;
      break;
    }
  }

  const expectedEnvNames: string[] = [];
  for (const source of settings?.dataSources ?? []) {
    if (source.type !== "fm") {
      continue;
    }
    pushUnique(expectedEnvNames, source.envNames?.server);
    pushUnique(expectedEnvNames, source.envNames?.database);
    pushUnique(expectedEnvNames, source.envNames?.apiKey);
  }

  let configEntries: TypegenConfigEntry[] = [];
  if (parsedTypegenConfig) {
    configEntries = Array.isArray(parsedTypegenConfig.config)
      ? parsedTypegenConfig.config
      : [parsedTypegenConfig.config];
  }

  for (const entry of configEntries) {
    pushUnique(expectedEnvNames, entry.envNames?.server);
    pushUnique(expectedEnvNames, entry.envNames?.db);
    pushUnique(expectedEnvNames, entry.envNames?.auth?.apiKey);
    pushUnique(expectedEnvNames, entry.envNames?.auth?.username);
    pushUnique(expectedEnvNames, entry.envNames?.auth?.password);
  }

  if (expectedEnvNames.length > 0) {
    if (resolvedEnvPath) {
      const envRaw = yield* readFileSafe(resolvedEnvPath);
      if (envRaw) {
        const env = parseDotenv(envRaw);
        const missing = expectedEnvNames.filter((name) => !(name in env));
        if (missing.length > 0) {
          findings.push({
            level: "warn",
            message: `Missing env vars in \`${path.basename(resolvedEnvPath)}\`: ${missing.join(", ")}.`,
          });
        } else {
          findings.push({
            level: "ok",
            message: `Expected env vars found in \`${path.basename(resolvedEnvPath)}\`.`,
          });
        }
      } else {
        findings.push({
          level: "error",
          message: `Could not read env file \`${path.basename(resolvedEnvPath)}\`.`,
        });
      }
    } else {
      findings.push({
        level: "warn",
        message: `No env file found. Expected vars: ${expectedEnvNames.join(", ")}.`,
      });
    }
  }

  const errors = findings.filter((finding) => finding.level === "error");
  const warnings = findings.filter((finding) => finding.level === "warn");
  const oks = findings.filter((finding) => finding.level === "ok");

  const lines = [
    `Checks: ${oks.length} ok, ${warnings.length} warn, ${errors.length} error`,
    "",
    ...findings.map((finding) => {
      let prefix = "ERR";
      if (finding.level === "ok") {
        prefix = "OK";
      } else if (finding.level === "warn") {
        prefix = "WARN";
      }
      return `- [${prefix}] ${finding.message}`;
    }),
    "",
    "Next steps:",
    "- Run `npx @proofkit/typegen init` if typegen config is missing",
    "- Run `npx @proofkit/typegen ui` to edit typegen config",
    "- Run `npx @proofkit/typegen` to regenerate generated files",
    `- Docs: ${DOCS_URL}/docs/typegen`,
  ];

  if (settings?.appType === "webviewer") {
    lines.splice(lines.length - 1, 0, "- For webviewer projects, make sure local FM MCP is running before typegen");
  }

  consoleService.note(lines.join("\n"), "Doctor");
});
