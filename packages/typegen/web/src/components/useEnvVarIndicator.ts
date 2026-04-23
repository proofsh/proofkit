import { useFormContext, useWatch } from "react-hook-form";
import { defaultEnvNames } from "../../../src/constants";
import type { SingleConfig } from "../lib/config-utils";
import { useEnvValue } from "../lib/envValues";

export function useEnvVarIndicator(index: number) {
  const { control } = useFormContext<{ config: SingleConfig[] }>();

  // Watch all env name values to check if they're set (not default)
  const envNamesServer = useWatch({
    control,
    name: `config.${index}.envNames.server` as const,
  });
  const envNamesDb = useWatch({
    control,
    name: `config.${index}.envNames.db` as const,
  });
  const envNamesAuth = useWatch({
    control,
    name: `config.${index}.envNames.auth` as const,
  });

  // Determine which env name to use for each field
  const serverEnvName = envNamesServer && envNamesServer.trim() !== "" ? envNamesServer : defaultEnvNames.server;
  const dbEnvName = envNamesDb && envNamesDb.trim() !== "" ? envNamesDb : defaultEnvNames.db;

  // Determine auth env name based on auth type
  let authEnvName: string | undefined;
  if (envNamesAuth && typeof envNamesAuth === "object") {
    if ("apiKey" in envNamesAuth && envNamesAuth.apiKey && envNamesAuth.apiKey.trim() !== "") {
      authEnvName = envNamesAuth.apiKey;
    } else if (
      "clarisIdUsername" in envNamesAuth &&
      envNamesAuth.clarisIdUsername &&
      envNamesAuth.clarisIdUsername.trim() !== ""
    ) {
      authEnvName = envNamesAuth.clarisIdUsername;
    } else if ("username" in envNamesAuth && envNamesAuth.username && envNamesAuth.username.trim() !== "") {
      authEnvName = envNamesAuth.username;
    }
  }
  // If no custom auth env name, we'll need to check based on auth type selector
  // This will be handled in the component since it needs the authTypeSelector state

  // Check if env values resolve to undefined
  const { data: serverValue, isLoading: serverLoading } = useEnvValue(serverEnvName);
  const { data: dbValue, isLoading: dbLoading } = useEnvValue(dbEnvName);

  // Check if any values are set (not default)
  const hasCustomValues =
    (envNamesServer && envNamesServer.trim() !== "") ||
    (envNamesDb && envNamesDb.trim() !== "") ||
    (envNamesAuth &&
      typeof envNamesAuth === "object" &&
      (("apiKey" in envNamesAuth && envNamesAuth.apiKey && envNamesAuth.apiKey.trim() !== "") ||
        ("clarisIdUsername" in envNamesAuth &&
          envNamesAuth.clarisIdUsername &&
          envNamesAuth.clarisIdUsername.trim() !== "") ||
        ("clarisIdPassword" in envNamesAuth &&
          envNamesAuth.clarisIdPassword &&
          envNamesAuth.clarisIdPassword.trim() !== "") ||
        ("username" in envNamesAuth && envNamesAuth.username && envNamesAuth.username.trim() !== "") ||
        ("password" in envNamesAuth && envNamesAuth.password && envNamesAuth.password.trim() !== "")));

  return {
    hasCustomValues,
    serverValue,
    serverLoading,
    dbValue,
    dbLoading,
    envNamesAuth,
    authEnvName,
  };
}
