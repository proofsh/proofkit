import path from "node:path";
import fs from "fs-extra";
import type { PackageJson } from "type-fest";

import { PKG_ROOT } from "~/consts.js";

export const getVersion = () => {
  const packageJsonPath = path.join(PKG_ROOT, "package.json");

  const packageJsonContent = fs.readJSONSync(packageJsonPath) as PackageJson;

  return packageJsonContent.version ?? "1.0.0";
};

const readSiblingPackageVersion = (packagePath: string) => {
  const packageJsonPath = path.resolve(PKG_ROOT, "..", packagePath, "package.json");
  const packageJsonContent = fs.readJSONSync(packageJsonPath) as PackageJson;
  return packageJsonContent.version ?? "1.0.0";
};

export const getFmdapiVersion = () => {
  return typeof __FMDAPI_VERSION__ === "undefined" ? readSiblingPackageVersion("fmdapi") : __FMDAPI_VERSION__;
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
  return typeof __BETTER_AUTH_VERSION__ === "undefined"
    ? readSiblingPackageVersion("better-auth")
    : __BETTER_AUTH_VERSION__;
};

export const getProofkitWebviewerVersion = () => {
  return typeof __WEBVIEWER_VERSION__ === "undefined" ? readSiblingPackageVersion("webviewer") : __WEBVIEWER_VERSION__;
};

export const getTypegenVersion = () => {
  return typeof __TYPEGEN_VERSION__ === "undefined" ? readSiblingPackageVersion("typegen") : __TYPEGEN_VERSION__;
};

export const getProofkitDependencyVersion = (version: string) => `^${version}`;
