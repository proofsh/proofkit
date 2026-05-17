import path from "node:path";
import type { OttoAPIKey } from "@proofkit/fmdapi/adapters/otto";
import fs from "fs-extra";
import { parse } from "jsonc-parser";
import type { z } from "zod/v4";
import { defaultEnvNames, defaultFmMcpBaseUrl } from "../constants";
import { getFmMcpSessionId } from "../fmMcpSession";
import { rethrowMissingDependency } from "../optionalDeps";
import { typegenConfig, type typegenConfigSingle } from "../types";
import type { ApiContext } from "./app";

interface LocalLayoutOrFolder {
  name: string;
  isFolder?: boolean;
  folderLayoutNames?: LocalLayoutOrFolder[];
  table?: string;
}

export interface CreateClientResult {
  client: {
    layouts?: () => Promise<{
      layouts: LocalLayoutOrFolder[];
    }>;
  };
  config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }>;
  server: string;
  db: string;
  authType: "apiKey" | "username" | "fmMcp";
}

export interface CreateClientError {
  error: string;
  statusCode: number;
  details?: Record<string, unknown>;
  kind?: "missing_env" | "adapter_error" | "connection_error" | "unknown";
  suspectedField?: "server" | "db" | "auth";
  fmErrorCode?: string;
  message?: string;
}

type SingleConfig = z.infer<typeof typegenConfigSingle>;

type FmdapiConfig = Extract<SingleConfig, { type: "fmdapi" }>;

type FmodataConfig = Extract<SingleConfig, { type: "fmodata" }>;

interface ApiKeyAuth {
  apiKey: OttoAPIKey;
}

interface UsernameAuth {
  username: string;
  password: string;
}

interface ClarisIdAuth {
  clarisId: {
    username: string;
    password: string;
  };
}

type SupportedAuth = ApiKeyAuth | UsernameAuth | ClarisIdAuth;

const trailingSlashesRegex = /\/+$/;
const defaultAuthorizeTimeoutMs = 125_000;
export const fmMcpUiIdleTimeoutSeconds = 900;

const getStatusReason = (status: unknown): string => {
  if (status === "rejected") {
    return "authorization rejected";
  }
  if (status === "timeout") {
    return "authorization timed out";
  }
  if (status === "file_not_connected") {
    return "file not connected";
  }
  return typeof status === "string" ? status : "authorization failed";
};

const authorizeFmMcpSession = async (options: {
  baseUrl: string;
  connectedFileName: string;
  sessionId: string;
  clientName: string;
  clientDescription: string;
  idleTimeoutSeconds: number;
  authorizationTimeoutMs?: number;
  disableInteractiveAuthorization?: boolean;
}) => {
  if (options.disableInteractiveAuthorization) {
    throw new Error("interactive authorization disabled");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.authorizationTimeoutMs ?? defaultAuthorizeTimeoutMs);
  try {
    const res = await fetch(`${options.baseUrl.replace(trailingSlashesRegex, "")}/authorizeSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: options.sessionId,
        fileName: options.connectedFileName,
        clientName: options.clientName,
        clientDescription: options.clientDescription,
        idleTimeoutSeconds: options.idleTimeoutSeconds,
      }),
      signal: controller.signal,
    });
    const payload = (await res.json().catch(() => null)) as { status?: unknown; error?: unknown } | null;
    if (res.ok && payload?.status === "approved") {
      return;
    }
    const reason = typeof payload?.error === "string" ? payload.error : getStatusReason(payload?.status);
    throw new Error(reason);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("authorization timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};

const getProjectName = (cwd: string) => {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8")) as { name?: unknown };
    if (typeof packageJson.name === "string" && packageJson.name.trim() !== "") {
      return packageJson.name;
    }
  } catch {
    // Fall back to folder name when the UI server runs outside a package root.
  }
  return path.basename(cwd);
};

export const getFmMcpUiClientIdentity = (cwd: string) => {
  const projectName = getProjectName(cwd);
  return {
    clientName: `ProofKit Typegen UI (${projectName})`,
    clientDescription:
      "ProofKit Typegen UI wants to read layout metadata from your FileMaker file to help configure generated field names and field types.",
  };
};

type EnvVarsResult =
  | CreateClientError
  | {
      server: string;
      db: string;
      authType: "apiKey" | "username" | "clarisId";
      auth: SupportedAuth;
    };

export interface OdataClientResult {
  db: {
    listTableNames: () => Promise<string[]>;
  };
  connection: {
    listDatabaseNames: () => Promise<string[]>;
  };
  server: string;
  dbName: string;
  authType: "apiKey" | "username" | "clarisId";
}

export interface OdataClientError {
  error: string;
  statusCode: number;
  details?: Record<string, unknown>;
  kind?: "missing_env" | "adapter_error" | "connection_error" | "unknown";
  suspectedField?: "server" | "db" | "auth";
  message?: string;
}

function getEnvVarsFromConfig(
  envNames: SingleConfig["envNames"],
  options?: { allowClarisId?: boolean },
): EnvVarsResult {
  const getEnvName = (customName: string | undefined, defaultName: string) =>
    customName && customName.trim() !== "" ? customName : defaultName;

  const server = process.env[getEnvName(envNames?.server, defaultEnvNames.server)];
  const db = process.env[getEnvName(envNames?.db, defaultEnvNames.db)];

  const apiKeyEnvName =
    envNames?.auth && "apiKey" in envNames.auth
      ? getEnvName(envNames.auth.apiKey, defaultEnvNames.apiKey)
      : defaultEnvNames.apiKey;
  const clarisIdUsernameEnvName =
    envNames?.auth && "clarisIdUsername" in envNames.auth
      ? getEnvName(envNames.auth.clarisIdUsername, defaultEnvNames.clarisIdUsername)
      : defaultEnvNames.clarisIdUsername;
  const clarisIdPasswordEnvName =
    envNames?.auth && "clarisIdPassword" in envNames.auth
      ? getEnvName(envNames.auth.clarisIdPassword, defaultEnvNames.clarisIdPassword)
      : defaultEnvNames.clarisIdPassword;
  const usernameEnvName =
    envNames?.auth && "username" in envNames.auth
      ? getEnvName(envNames.auth.username, defaultEnvNames.username)
      : defaultEnvNames.username;
  const passwordEnvName =
    envNames?.auth && "password" in envNames.auth
      ? getEnvName(envNames.auth.password, defaultEnvNames.password)
      : defaultEnvNames.password;

  const apiKey = process.env[apiKeyEnvName];
  const clarisIdUsername = process.env[clarisIdUsernameEnvName];
  const clarisIdPassword = process.env[clarisIdPasswordEnvName];
  const username = process.env[usernameEnvName];
  const password = process.env[passwordEnvName];
  const hasClarisIdAuth = !!(options?.allowClarisId && clarisIdUsername);
  const hasAnyAuth = !!(apiKey || hasClarisIdAuth || username);

  if (!(server && db && hasAnyAuth)) {
    const missingDetails: {
      server?: boolean;
      db?: boolean;
      auth?: boolean;
      password?: boolean;
      clarisIdPassword?: boolean;
    } = {
      server: !server,
      db: !db,
      auth: !hasAnyAuth,
    };

    if (server && db && username && !password) {
      missingDetails.password = true;
    }
    if (server && db && options?.allowClarisId && clarisIdUsername && !clarisIdPassword) {
      missingDetails.clarisIdPassword = true;
    }

    return {
      error: "Missing required environment variables",
      statusCode: 400,
      kind: "missing_env",
      details: {
        missing: missingDetails,
      },
      suspectedField: (() => {
        if (!server) {
          return "server";
        }
        if (!db) {
          return "db";
        }
        if (!hasAnyAuth) {
          return "auth";
        }
        return undefined;
      })(),
      message: (() => {
        if (!server) {
          return "Server URL environment variable is missing";
        }
        if (!db) {
          return "Database name environment variable is missing";
        }
        return "Authentication credentials environment variable is missing";
      })(),
    };
  }

  if (options?.allowClarisId && clarisIdUsername && !clarisIdPassword) {
    return {
      error: "Password is required when using Claris ID authentication",
      statusCode: 400,
      kind: "missing_env",
      details: {
        missing: {
          clarisIdPassword: true,
        },
      },
      suspectedField: "auth",
      message: "Claris ID password environment variable is missing",
    };
  }

  if (username && !password) {
    return {
      error: "Password is required when using username authentication",
      statusCode: 400,
      kind: "missing_env",
      details: {
        missing: {
          password: true,
        },
      },
      suspectedField: "auth",
      message: "Password environment variable is missing",
    };
  }

  let authType: "apiKey" | "username" | "clarisId";
  let auth: SupportedAuth;
  if (apiKey) {
    authType = "apiKey";
    auth = { apiKey: apiKey as OttoAPIKey };
  } else if (hasClarisIdAuth) {
    authType = "clarisId";
    auth = {
      clarisId: {
        username: clarisIdUsername ?? "",
        password: clarisIdPassword ?? "",
      },
    };
  } else {
    authType = "username";
    auth = { username: username ?? "", password: password ?? "" };
  }

  return {
    server,
    db,
    authType,
    auth,
  };
}

async function loadFmdapiDeps() {
  const [{ default: DataApi }, { FetchAdapter }, { FmMcpAdapter }, { OttoAdapter }, { memoryStore }] =
    await Promise.all([
      import("@proofkit/fmdapi").catch((error: unknown) =>
        rethrowMissingDependency(error, "@proofkit/fmdapi", "fmdapi UI features"),
      ),
      import("@proofkit/fmdapi/adapters/fetch").catch((error: unknown) =>
        rethrowMissingDependency(error, "@proofkit/fmdapi", "fmdapi UI features"),
      ),
      import("@proofkit/fmdapi/adapters/fm-mcp").catch((error: unknown) =>
        rethrowMissingDependency(error, "@proofkit/fmdapi", "fmdapi UI features"),
      ),
      import("@proofkit/fmdapi/adapters/otto").catch((error: unknown) =>
        rethrowMissingDependency(error, "@proofkit/fmdapi", "fmdapi UI features"),
      ),
      import("@proofkit/fmdapi/tokenStore/memory").catch((error: unknown) =>
        rethrowMissingDependency(error, "@proofkit/fmdapi", "fmdapi UI features"),
      ),
    ]);

  return { DataApi, FetchAdapter, FmMcpAdapter, OttoAdapter, memoryStore };
}

async function loadFmodataDeps() {
  const { FMServerConnection } = await import("@proofkit/fmodata").catch((error: unknown) =>
    rethrowMissingDependency(error, "@proofkit/fmodata", "fmodata UI features"),
  );

  return { FMServerConnection };
}

export async function createOdataClientFromConfig(
  config: FmodataConfig,
): Promise<OdataClientResult | OdataClientError> {
  const result = getEnvVarsFromConfig(config.envNames, { allowClarisId: true });
  if ("error" in result) {
    return result;
  }

  const { server, db: dbName, authType, auth } = result;

  try {
    const { FMServerConnection } = await loadFmodataDeps();
    const connection = new FMServerConnection({
      serverUrl: server,
      auth,
    });
    const db = connection.database(dbName);

    return { db, connection, server, dbName, authType };
  } catch (error) {
    if (error instanceof TypeError) {
      const message = error.message.toLowerCase();
      if (message.includes("invalid url") || message.includes("malformed")) {
        return {
          error: error.message,
          statusCode: 400,
          kind: "adapter_error",
          suspectedField: "server",
        };
      }
    }

    return {
      error: error instanceof Error ? error.message : "Failed to create OData client",
      statusCode: 500,
      kind: "unknown",
    };
  }
}

export async function createClientFromConfig(
  config: FmdapiConfig,
  options?: { projectRoot?: string },
): Promise<Omit<CreateClientResult, "config"> | CreateClientError> {
  let deps: Awaited<ReturnType<typeof loadFmdapiDeps>>;
  try {
    deps = await loadFmdapiDeps();
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load fmdapi",
      statusCode: 500,
      kind: "unknown",
    };
  }

  const { DataApi, FetchAdapter, FmMcpAdapter, OttoAdapter, memoryStore } = deps;

  if (config.fmMcp != null && config.fmMcp.enabled !== false) {
    const fmMcpObj = config.fmMcp;

    const getEnvName = (customName: string | undefined, defaultName: string) =>
      customName && customName.trim() !== "" ? customName : defaultName;

    const baseUrlEnvName = getEnvName(config.envNames?.fmMcp?.baseUrl, defaultEnvNames.fmMcpBaseUrl);
    const connectedFileNameEnvName = getEnvName(
      config.envNames?.fmMcp?.connectedFileName,
      defaultEnvNames.fmMcpConnectedFileName,
    );
    const persistentTokenEnvName = getEnvName(
      config.envNames?.fmMcp?.persistentToken,
      defaultEnvNames.fmMcpPersistentToken,
    );

    const baseUrl = fmMcpObj?.baseUrl || process.env[baseUrlEnvName] || defaultFmMcpBaseUrl;
    let connectedFileName = fmMcpObj?.connectedFileName || process.env[connectedFileNameEnvName];
    const persistentToken = fmMcpObj?.persistentToken || process.env[persistentTokenEnvName];
    const projectRoot = options?.projectRoot ?? process.cwd();
    const fmMcpClientIdentity = getFmMcpUiClientIdentity(projectRoot);

    if (!connectedFileName) {
      try {
        const res = await fetch(`${baseUrl.replace(trailingSlashesRegex, "")}/connectedFiles`);
        if (!res.ok) {
          return {
            error: "Failed to discover connected FileMaker files",
            statusCode: 400,
            kind: "connection_error",
            suspectedField: "server",
            message: `Could not read connected files from ${baseUrl}`,
          };
        }
        const connectedFiles = (await res.json()) as unknown;
        if (!(Array.isArray(connectedFiles) && connectedFiles.every((fileName) => typeof fileName === "string"))) {
          return {
            error: "Invalid connected files response",
            statusCode: 400,
            kind: "connection_error",
            suspectedField: "server",
            message: "FM MCP server returned invalid connected files",
          };
        }
        if (connectedFiles.length === 1) {
          connectedFileName = connectedFiles[0];
        } else if (connectedFiles.length > 1) {
          return {
            error: "Multiple connected FileMaker files found",
            statusCode: 400,
            kind: "missing_env",
            details: { connectedFiles },
            suspectedField: "db",
            message: `Set connectedFileName in your fmMcp config or ${connectedFileNameEnvName} env var`,
          };
        } else {
          return {
            error: "No connected FileMaker files found",
            statusCode: 400,
            kind: "missing_env",
            suspectedField: "db",
            message: "Connect a FileMaker file to the FM MCP server",
          };
        }
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "Failed to reach FM MCP server",
          statusCode: 400,
          kind: "connection_error",
          suspectedField: "server",
          message: `Could not reach FM MCP server at ${baseUrl}`,
        };
      }
    }

    if (!connectedFileName) {
      return {
        error: "Missing connectedFileName for FM MCP mode",
        statusCode: 400,
        kind: "missing_env",
        details: { missing: { connectedFileName: true } },
        suspectedField: "db",
        message: `Set connectedFileName in your fmMcp config or ${connectedFileNameEnvName} env var`,
      };
    }

    try {
      const resolvedConnectedFileName = connectedFileName;
      const clientName = fmMcpObj?.clientName ?? fmMcpClientIdentity.clientName;
      const clientDescription = fmMcpObj?.clientDescription ?? fmMcpClientIdentity.clientDescription;
      const sessionKey = {
        cwd: projectRoot,
        baseUrl,
        connectedFileName: resolvedConnectedFileName,
        clientName,
      };
      const sessionId = getFmMcpSessionId(sessionKey, persistentToken ?? fmMcpObj?.sessionId);
      const authorize = () =>
        authorizeFmMcpSession({
          baseUrl,
          connectedFileName: resolvedConnectedFileName,
          sessionId,
          clientName,
          clientDescription,
          idleTimeoutSeconds: fmMcpUiIdleTimeoutSeconds,
          authorizationTimeoutMs: fmMcpObj?.authorizationTimeoutMs,
          disableInteractiveAuthorization: fmMcpObj?.disableInteractiveAuthorization,
        });
      const client = DataApi({
        adapter: new FmMcpAdapter({
          baseUrl,
          connectedFileName: resolvedConnectedFileName,
          scriptName: fmMcpObj?.scriptName ?? config.webviewerScriptName,
          sessionId,
          clientName,
          clientDescription,
          idleTimeoutSeconds: fmMcpUiIdleTimeoutSeconds,
          authorizationTimeoutMs: fmMcpObj?.authorizationTimeoutMs,
          disableInteractiveAuthorization: fmMcpObj?.disableInteractiveAuthorization,
        }),
        layout: "",
      });
      const clientWithLayouts = {
        ...client,
        layouts: async () => {
          await authorize();
          return {
            layouts: config.layouts.map((layout) => ({
              name: layout.layoutName,
              table: layout.layoutName,
            })),
          };
        },
      };
      return {
        client: clientWithLayouts as CreateClientResult["client"],
        server: baseUrl,
        db: resolvedConnectedFileName,
        authType: "fmMcp",
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create FM MCP adapter";
      return {
        error: errorMessage,
        statusCode: 400,
        kind: "adapter_error",
        suspectedField: "server",
        message: errorMessage,
      };
    }
  }

  const result = getEnvVarsFromConfig(config.envNames);
  if ("error" in result) {
    return result;
  }

  const { server, db, auth } = result;

  try {
    if ("clarisId" in auth) {
      return {
        error: "Claris ID auth is not supported for fmdapi adapters",
        statusCode: 400,
        kind: "adapter_error",
        suspectedField: "auth",
        message: "Claris ID auth is not supported for fmdapi adapters",
      };
    }

    const resolvedAuthType: "apiKey" | "username" = "apiKey" in auth ? "apiKey" : "username";

    const client =
      "apiKey" in auth
        ? DataApi({
            adapter: new OttoAdapter({ auth, server, db }),
            layout: "",
          })
        : DataApi({
            adapter: new FetchAdapter({
              auth,
              server,
              db,
              tokenStore: memoryStore(),
            }),
            layout: "",
          });

    return {
      client: client as CreateClientResult["client"],
      server,
      db,
      authType: resolvedAuthType,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to create adapter";
    return {
      error: errorMessage,
      statusCode: 400,
      kind: "adapter_error",
      suspectedField: "auth",
      message: errorMessage,
    };
  }
}

export async function createDataApiClient(
  context: ApiContext,
  configIndex: number,
): Promise<CreateClientResult | CreateClientError> {
  const fullPath = path.resolve(context.cwd, context.configPath);

  if (!fs.existsSync(fullPath)) {
    return {
      error: "Config file not found",
      statusCode: 404,
    };
  }

  let parsed: z.infer<typeof typegenConfig>;
  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    const rawJson = parse(raw);
    parsed = typegenConfig.parse(rawJson);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to parse config",
      statusCode: 500,
    };
  }

  const configArray = Array.isArray(parsed.config) ? parsed.config : [parsed.config];
  const config = configArray[configIndex];

  if (!config) {
    return {
      error: "Config not found",
      statusCode: 404,
    };
  }

  if (config.type !== "fmdapi") {
    return {
      error: "Only fmdapi config type is supported",
      statusCode: 400,
    };
  }

  const result = await createClientFromConfig(config, { projectRoot: context.cwd });

  if ("error" in result) {
    return result;
  }

  return {
    ...result,
    config,
  };
}
