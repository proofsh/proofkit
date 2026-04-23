import chalk from "chalk";
import type { z } from "zod/v4";
import { defaultEnvNames, defaultFmMcpBaseUrl } from "./constants";
import type { typegenConfigSingle } from "./types";

type EnvNames = z.infer<typeof typegenConfigSingle>["envNames"];

export interface EnvValues {
  server: string | undefined;
  db: string | undefined;
  apiKey: string | undefined;
  clarisIdUsername: string | undefined;
  clarisIdPassword: string | undefined;
  username: string | undefined;
  password: string | undefined;
  fmMcpBaseUrl: string | undefined;
  fmMcpConnectedFileName: string | undefined;
}

type StandardAuth =
  | { apiKey: string }
  | { username: string; password: string }
  | { clarisId: { username: string; password: string } };

export type EnvValidationResult =
  | {
      success: true;
      mode: "standard";
      server: string;
      db: string;
      auth: StandardAuth;
    }
  | {
      success: true;
      mode: "fmMcp";
      baseUrl: string;
      connectedFileName: string;
    }
  | {
      success: false;
      errorMessage: string;
    };

interface EnvValidationOptions {
  fmMcp?: boolean;
  allowClarisId?: boolean;
  fmMcpConfig?: { baseUrl?: string; connectedFileName?: string };
}

/**
 * Gets environment variable values for FileMaker connection.
 * Supports both fmdapi and fmodata config types.
 *
 * @param envNames - Optional custom environment variable names
 * @returns Object containing all environment variable values
 */
export function getEnvValues(envNames?: EnvNames): EnvValues {
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

  const fmMcpBaseUrlEnvName =
    envNames?.fmMcp && "baseUrl" in envNames.fmMcp
      ? getEnvName(envNames.fmMcp.baseUrl, defaultEnvNames.fmMcpBaseUrl)
      : defaultEnvNames.fmMcpBaseUrl;
  const fmMcpConnectedFileNameEnvName =
    envNames?.fmMcp && "connectedFileName" in envNames.fmMcp
      ? getEnvName(envNames.fmMcp.connectedFileName, defaultEnvNames.fmMcpConnectedFileName)
      : defaultEnvNames.fmMcpConnectedFileName;

  const fmMcpBaseUrl = process.env[fmMcpBaseUrlEnvName];
  const fmMcpConnectedFileName = process.env[fmMcpConnectedFileNameEnvName];

  return {
    server,
    db,
    apiKey,
    clarisIdUsername,
    clarisIdPassword,
    username,
    password,
    fmMcpBaseUrl,
    fmMcpConnectedFileName,
  };
}

/**
 * Validates environment values and returns a result with either success data or error message.
 * Follows the same validation pattern as getEnvVarsFromConfig for consistency.
 */
export function validateEnvValues(
  envValues: EnvValues,
  envNames?: EnvNames,
  options?: EnvValidationOptions,
): EnvValidationResult {
  const {
    server,
    db,
    apiKey,
    clarisIdUsername,
    clarisIdPassword,
    username,
    password,
    fmMcpBaseUrl,
    fmMcpConnectedFileName,
  } = envValues;

  if (options?.fmMcp) {
    const resolvedBaseUrl = options.fmMcpConfig?.baseUrl || fmMcpBaseUrl || defaultFmMcpBaseUrl;
    const resolvedConnectedFileName = options.fmMcpConfig?.connectedFileName || fmMcpConnectedFileName;

    return {
      success: true,
      mode: "fmMcp",
      baseUrl: resolvedBaseUrl,
      connectedFileName: resolvedConnectedFileName ?? "",
    };
  }

  const getEnvName = (customName: string | undefined, defaultName: string) =>
    customName && customName.trim() !== "" ? customName : defaultName;

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

    const missingVars: string[] = [];
    if (!server) {
      missingVars.push(getEnvName(envNames?.server, defaultEnvNames.server));
    }
    if (!db) {
      missingVars.push(getEnvName(envNames?.db, defaultEnvNames.db));
    }

    if (!hasAnyAuth) {
      const apiKeyName = getEnvName(
        envNames?.auth && "apiKey" in envNames.auth ? envNames.auth.apiKey : undefined,
        defaultEnvNames.apiKey,
      );
      const clarisIdUsernameName = getEnvName(
        envNames?.auth && "clarisIdUsername" in envNames.auth ? envNames.auth.clarisIdUsername : undefined,
        defaultEnvNames.clarisIdUsername,
      );
      const clarisIdPasswordName = getEnvName(
        envNames?.auth && "clarisIdPassword" in envNames.auth ? envNames.auth.clarisIdPassword : undefined,
        defaultEnvNames.clarisIdPassword,
      );
      const usernameName = getEnvName(
        envNames?.auth && "username" in envNames.auth ? envNames.auth.username : undefined,
        defaultEnvNames.username,
      );
      const passwordName = getEnvName(
        envNames?.auth && "password" in envNames.auth ? envNames.auth.password : undefined,
        defaultEnvNames.password,
      );

      missingVars.push(
        `${apiKeyName} (or ${clarisIdUsernameName} and ${clarisIdPasswordName}, or ${usernameName} and ${passwordName})`,
      );
    }

    return {
      success: false,
      errorMessage: `Missing required environment variables: ${missingVars.join(", ")}`,
    };
  }

  if (options?.allowClarisId && clarisIdUsername && !clarisIdPassword) {
    const clarisIdPasswordName = getEnvName(
      envNames?.auth && "clarisIdPassword" in envNames.auth ? envNames.auth.clarisIdPassword : undefined,
      defaultEnvNames.clarisIdPassword,
    );

    return {
      success: false,
      errorMessage: `Password is required when using Claris ID authentication. Missing: ${clarisIdPasswordName}`,
    };
  }

  if (username && !password) {
    const passwordName = getEnvName(
      envNames?.auth && "password" in envNames.auth ? envNames.auth.password : undefined,
      defaultEnvNames.password,
    );

    return {
      success: false,
      errorMessage: `Password is required when using username authentication. Missing: ${passwordName}`,
    };
  }

  let auth: StandardAuth;
  if (apiKey) {
    auth = { apiKey };
  } else if (hasClarisIdAuth) {
    auth = {
      clarisId: {
        username: clarisIdUsername ?? "",
        password: clarisIdPassword ?? "",
      },
    };
  } else {
    auth = { username: username ?? "", password: password ?? "" };
  }

  return {
    success: true,
    mode: "standard",
    server,
    db,
    auth,
  };
}

/**
 * Validates environment values and logs errors using chalk (for fmdapi compatibility).
 */
export function validateAndLogEnvValues(
  envValues: EnvValues,
  envNames?: EnvNames,
  options?: EnvValidationOptions,
): EnvValidationResult | undefined {
  const result = validateEnvValues(envValues, envNames, options);

  if (!result.success) {
    console.log(chalk.red("ERROR: Could not get all required config values"));
    console.log("Ensure the following environment variables are set:");

    const getEnvName = (customName: string | undefined, defaultName: string) =>
      customName && customName.trim() !== "" ? customName : defaultName;

    if (options?.fmMcp) {
      if (!envValues.fmMcpBaseUrl) {
        console.log(
          getEnvName(
            envNames?.fmMcp && "baseUrl" in envNames.fmMcp ? envNames.fmMcp.baseUrl : undefined,
            defaultEnvNames.fmMcpBaseUrl,
          ),
        );
      }
      if (!envValues.fmMcpConnectedFileName) {
        console.log(
          getEnvName(
            envNames?.fmMcp && "connectedFileName" in envNames.fmMcp ? envNames.fmMcp.connectedFileName : undefined,
            defaultEnvNames.fmMcpConnectedFileName,
          ),
        );
      }
      console.log();
      return undefined;
    }

    const { server, db, apiKey, clarisIdUsername, clarisIdPassword, username, password } = envValues;
    const hasClarisIdAuth = !!(options?.allowClarisId && clarisIdUsername);
    const hasAnyAuth = !!(apiKey || hasClarisIdAuth || username);

    if (!server) {
      console.log(getEnvName(envNames?.server, defaultEnvNames.server));
    }
    if (!db) {
      console.log(getEnvName(envNames?.db, defaultEnvNames.db));
    }

    if (!hasAnyAuth) {
      const apiKeyNameToLog = getEnvName(
        envNames?.auth && "apiKey" in envNames.auth ? envNames.auth.apiKey : undefined,
        defaultEnvNames.apiKey,
      );
      const clarisIdUsernameNameToLog = getEnvName(
        envNames?.auth && "clarisIdUsername" in envNames.auth ? envNames.auth.clarisIdUsername : undefined,
        defaultEnvNames.clarisIdUsername,
      );
      const clarisIdPasswordNameToLog = getEnvName(
        envNames?.auth && "clarisIdPassword" in envNames.auth ? envNames.auth.clarisIdPassword : undefined,
        defaultEnvNames.clarisIdPassword,
      );
      const usernameNameToLog = getEnvName(
        envNames?.auth && "username" in envNames.auth ? envNames.auth.username : undefined,
        defaultEnvNames.username,
      );
      const passwordNameToLog = getEnvName(
        envNames?.auth && "password" in envNames.auth ? envNames.auth.password : undefined,
        defaultEnvNames.password,
      );

      console.log(
        `${apiKeyNameToLog} (or ${clarisIdUsernameNameToLog} and ${clarisIdPasswordNameToLog}, or ${usernameNameToLog} and ${passwordNameToLog})`,
      );
    } else if (options?.allowClarisId && clarisIdUsername && !clarisIdPassword) {
      console.log(
        getEnvName(
          envNames?.auth && "clarisIdPassword" in envNames.auth ? envNames.auth.clarisIdPassword : undefined,
          defaultEnvNames.clarisIdPassword,
        ),
      );
    } else if (username && !password) {
      console.log(
        getEnvName(
          envNames?.auth && "password" in envNames.auth ? envNames.auth.password : undefined,
          defaultEnvNames.password,
        ),
      );
    }

    console.log();
    return undefined;
  }

  return result;
}
