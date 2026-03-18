import { initEnvFile } from "~/installers/envVars.js";
import type { PackageManager } from "~/utils/getUserPkgManager.js";

// Turning this into a const allows the list to be iterated over for programmatically creating prompt options
// Should increase extensibility in the future
export const availablePackages = ["nextAuth", "trpc", "envVariables", "fmdapi", "webViewerFetch", "clerk"] as const;
export type AvailablePackages = (typeof availablePackages)[number];

export interface InstallerOptions {
  pkgManager: PackageManager;
  noInstall: boolean;
  packages?: PkgInstallerMap;
  projectName: string;
  scopedAppName: string;
}

export type Installer = (opts: InstallerOptions) => void;

export type PkgInstallerMap = {
  [pkg in AvailablePackages]?: {
    inUse: boolean;
    installer: Installer;
  };
};

export const buildPkgInstallerMap = (): PkgInstallerMap => ({
  envVariables: {
    inUse: true,
    installer: initEnvFile,
  },
});
