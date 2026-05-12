import {
  BETTER_AUTH_VERSION,
  CLI_VERSION,
  FMDAPI_VERSION,
  TYPEGEN_VERSION,
  WEBVIEWER_VERSION,
} from "~/generated/package-versions.js";

export const getVersion = () => {
  return CLI_VERSION;
};

export const getFmdapiVersion = () => {
  return FMDAPI_VERSION;
};

export const getNodeMajorVersion = () => {
  const defaultVersion = "22";
  try {
    return process.versions.node.split(".")[0] ?? defaultVersion;
  } catch {
    return defaultVersion;
  }
};

export const getProofkitBetterAuthVersion = () => {
  return BETTER_AUTH_VERSION;
};

export const getProofkitWebviewerVersion = () => {
  return WEBVIEWER_VERSION;
};

export const getTypegenVersion = () => {
  return TYPEGEN_VERSION;
};

export const getProofkitDependencyVersion = (version: string) => `^${version}`;
