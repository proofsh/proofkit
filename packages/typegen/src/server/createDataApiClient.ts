import path from "node:path";
import DataApi from "@proofkit/fmdapi";
import { FetchAdapter } from "@proofkit/fmdapi/adapters/fetch";
import { FmHttpAdapter } from "@proofkit/fmdapi/adapters/fm-http";
import { OttoAdapter, type OttoAPIKey } from "@proofkit/fmdapi/adapters/otto";
import { memoryStore } from "@proofkit/fmdapi/tokenStore/memory";
import { type Database, FMServerConnection } from "@proofkit/fmodata";
import fs from "fs-extra";
import { parse } from "jsonc-parser";
import type { z } from "zod/v4";
import { defaultEnvNames } from "../constants";
import { typegenConfig, type typegenConfigSingle } from "../types";
import type { ApiContext } from "./app";

export interface CreateClientResult {
  // biome-ignore lint/suspicious/noExplicitAny: DataApi is a generic type
  client: ReturnType<typeof DataApi<any, any, any, any>>;
  config: Extract<z.infer<typeof typegenConfigSingle>, { type: "fmdapi" }>;
  server: string;
  db: string;
  authType: "apiKey" | "username" | "fmHttp";
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

type EnvVarsResult =
  | CreateClientError
  | {
      server: string;
      db: string;
      authType: "apiKey" | "username";
      auth: { apiKey: OttoAPIKey } | { username: string; password: string };
    };

function getEnvVarsFromConfig(envNames: SingleConfig["envNames"]): EnvVarsResult {
  // Helper to get env name, treating empty strings as undefined
  const getEnvName = (customName: string | undefined, defaultName: string) =>
    customName && customName.trim() !== "" ? customName : defaultName;

  // Resolve environment variables
  const server = process.env[getEnvName(envNames?.server, defaultEnvNames.server)];
  const db = process.env[getEnvName(envNames?.db, defaultEnvNames.db)];

  // Always attempt to read all auth methods from environment variables,
  // regardless of which type is specified in envNames.auth
  const apiKeyEnvName =
    envNames?.auth && "apiKey" in envNames.auth
      ? getEnvName(envNames.auth.apiKey, defaultEnvNames.apiKey)
      : defaultEnvNames.apiKey;
  const usernameEnvName =
    envNames?.auth && "username" in envNames.auth
      ? getEnvName(envNames.auth.username, defaultEnvNames.username)
      : defaultEnvNames.username;
  const passwordEnvName =
    envNames?.auth && "password" in envNames.auth
      ? getEnvName(envNames.auth.password, defaultEnvNames.password)
      : defaultEnvNames.password;

  const apiKey = process.env[apiKeyEnvName];
  const username = process.env[usernameEnvName];
  const password = process.env[passwordEnvName];

  // Validate required env vars
  if (!(server && db && (apiKey || username))) {
    console.error("Missing required environment variables", {
      server,
      db,
      apiKey,
      username,
    });

    // Build missing details object
    const missingDetails: {
      server?: boolean;
      db?: boolean;
      auth?: boolean;
      password?: boolean;
    } = {
      server: !server,
      db: !db,
      auth: !(apiKey || username),
    };

    // Only report password as missing if server and db are both present,
    // and username is set but password is missing. This ensures we don't
    // incorrectly report password as missing when the actual error is about
    // missing server or database.
    if (server && db && username && !password) {
      missingDetails.password = true;
    }

    return {
      error: "Missing required environment variables",
      statusCode: 400,
      kind: "missing_env" as const,
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
        if (!(apiKey || username)) {
          return "auth";
        }
        return undefined;
      })() as "server" | "db" | "auth" | undefined,
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

  // Validate password if username is provided
  if (username && !password) {
    return {
      error: "Password is required when using username authentication",
      statusCode: 400,
      kind: "missing_env" as const,
      details: {
        missing: {
          password: true,
        },
      },
      suspectedField: "auth" as const,
      message: "Password environment variable is missing",
    };
  }

  return {
    server,
    db,
    authType: (apiKey ? "apiKey" : "username") as "apiKey" | "username",
    auth: apiKey ? { apiKey: apiKey as OttoAPIKey } : { username: username ?? "", password: password ?? "" },
  };
}

export interface OdataClientResult {
  db: Database;
  connection: FMServerConnection;
  server: string;
  dbName: string;
  authType: "apiKey" | "username";
}

export interface OdataClientError {
  error: string;
  statusCode: number;
  kind?: "missing_env" | "adapter_error" | "connection_error" | "unknown";
  suspectedField?: "server" | "db" | "auth";
}

export function createOdataClientFromConfig(config: FmodataConfig): OdataClientResult | OdataClientError {
  const result = getEnvVarsFromConfig(config.envNames);
  if ("error" in result) {
    return result;
  }
  const { server, db: dbName, authType, auth } = result;

  const connection = new FMServerConnection({
    serverUrl: server,
    auth,
  });

  const db = connection.database(dbName);

  return { db, connection, server, dbName, authType };
}

/**
 * Creates a DataApi client from an in-memory config object
 * @param config The fmdapi config object
 * @returns The client, server, and db, or an error object
 */
export function createClientFromConfig(config: FmdapiConfig): Omit<CreateClientResult, "config"> | CreateClientError {
  // FM HTTP mode
  if (config.fmHttp) {
    const getEnvName = (customName: string | undefined, defaultName: string) =>
      customName && customName.trim() !== "" ? customName : defaultName;

    const baseUrl = process.env[getEnvName(config.envNames?.fmHttp?.baseUrl, defaultEnvNames.fmHttpBaseUrl)];
    const connectedFileName =
      process.env[getEnvName(config.envNames?.fmHttp?.connectedFileName, defaultEnvNames.fmHttpConnectedFileName)];

    if (!(baseUrl && connectedFileName)) {
      const missing: string[] = [];
      if (!baseUrl) {
        missing.push(getEnvName(config.envNames?.fmHttp?.baseUrl, defaultEnvNames.fmHttpBaseUrl));
      }
      if (!connectedFileName) {
        missing.push(getEnvName(config.envNames?.fmHttp?.connectedFileName, defaultEnvNames.fmHttpConnectedFileName));
      }
      return {
        error: "Missing required environment variables for FM HTTP mode",
        statusCode: 400,
        kind: "missing_env",
        details: { missing: { baseUrl: !baseUrl, connectedFileName: !connectedFileName } },
        suspectedField: baseUrl ? "db" : "server",
        message: `Missing: ${missing.join(", ")}`,
      };
    }

    try {
      // biome-ignore lint/suspicious/noExplicitAny: DataApi is a generic type
      const client: ReturnType<typeof DataApi<any, any, any, any>> = DataApi({
        adapter: new FmHttpAdapter({
          baseUrl,
          connectedFileName,
          scriptName: config.fmHttp.scriptName,
        }),
        layout: "",
      });
      return { client, server: baseUrl, db: connectedFileName, authType: "fmHttp" };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create FM HTTP adapter";
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
  const { server, db, authType, auth } = result;

  // Create DataApi client with error handling for adapter construction
  // biome-ignore lint/suspicious/noExplicitAny: DataApi is a generic type
  let client: ReturnType<typeof DataApi<any, any, any, OttoAdapter>>;
  try {
    client =
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
  } catch (err) {
    // Handle adapter construction errors (e.g., invalid API key format, empty username/password)
    const errorMessage = err instanceof Error ? err.message : "Failed to create adapter";
    return {
      error: errorMessage,
      statusCode: 400,
      kind: "adapter_error",
      suspectedField: "auth",
      message: errorMessage,
    };
  }

  return {
    client,
    server,
    db,
    authType,
  };
}

/**
 * Creates a DataApi client from a config index
 * @param context The API context with cwd and configPath
 * @param configIndex The index of the config to use
 * @returns The client, config, server, and db, or an error object
 */
export function createDataApiClient(context: ApiContext, configIndex: number): CreateClientResult | CreateClientError {
  // Read and parse config file
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

  // Get config at index
  const configArray = Array.isArray(parsed.config) ? parsed.config : [parsed.config];
  const config = configArray[configIndex];

  if (!config) {
    return {
      error: "Config not found",
      statusCode: 404,
    };
  }

  // Validate config type
  if (config.type !== "fmdapi") {
    return {
      error: "Only fmdapi config type is supported",
      statusCode: 400,
    };
  }

  // Use the extracted helper function
  const result = createClientFromConfig(config);

  // Check if result is an error
  if ("error" in result) {
    return result;
  }

  return {
    ...result,
    config,
  };
}
