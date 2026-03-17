import path from "node:path";
import fs from "fs-extra";
import type { PackageJson } from "type-fest";

import { PKG_ROOT } from "~/consts.js";

export const getVersion = () => {
  const packageJsonPath = path.join(PKG_ROOT, "package.json");

  const packageJsonContent = fs.readJSONSync(packageJsonPath) as PackageJson;

  return packageJsonContent.version ?? "1.0.0";
};

export const getFmdapiVersion = () => {
  return __FMDAPI_VERSION__;
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
  return __BETTER_AUTH_VERSION__;
};

export const getProofkitWebviewerVersion = () => {
  return __WEBVIEWER_VERSION__;
};

export const getTypegenVersion = () => {
  const packageJsonPath = path.join(PKG_ROOT, "packages", "typegen", "package.json");

  try {
    const packageJsonContent = fs.readJSONSync(packageJsonPath) as PackageJson;
    return packageJsonContent.version ?? "1.1.0-beta.16";
  } catch {
    return "1.1.0-beta.16";
  }
};
