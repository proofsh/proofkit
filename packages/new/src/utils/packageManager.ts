export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export function detectUserPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent;
  if (userAgent?.startsWith("yarn")) {
    return "yarn";
  }
  if (userAgent?.startsWith("pnpm")) {
    return "pnpm";
  }
  if (userAgent?.startsWith("bun")) {
    return "bun";
  }
  if (userAgent?.startsWith("npm")) {
    return "npm";
  }
  return "pnpm";
}

export function formatRunCommand(pkgManager: PackageManager, script: string) {
  return pkgManager === "npm" || pkgManager === "bun" ? `${pkgManager} run ${script}` : `${pkgManager} ${script}`;
}
