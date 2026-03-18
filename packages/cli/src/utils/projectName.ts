import path from "node:path";

const TRAILING_SLASHES_REGEX = /\/+$/;
const VALID_APP_NAME_REGEX = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

function trimTrailingSlashes(value: string) {
  return value.replace(TRAILING_SLASHES_REGEX, "");
}

export function parseNameAndPath(projectName: string): [scopedAppName: string, appDir: string] {
  const normalized = trimTrailingSlashes(projectName);
  const segments = normalized.split("/");
  let scopedAppName = segments.at(-1) ?? "";

  if (scopedAppName === ".") {
    scopedAppName = path.basename(path.resolve(process.cwd()));
  }

  const scopeIndex = segments.findIndex((segment) => segment.startsWith("@"));
  if (scopeIndex !== -1) {
    scopedAppName = segments.slice(scopeIndex).join("/");
  }

  const appDir = segments.filter((segment) => !segment.startsWith("@")).join("/");

  return [scopedAppName, appDir];
}

export function validateAppName(projectName: string) {
  const normalized = trimTrailingSlashes(projectName);
  const segments = normalized.split("/");
  const scopeIndex = segments.findIndex((segment) => segment.startsWith("@"));
  let scopedAppName = segments.at(-1);

  if (scopeIndex !== -1) {
    scopedAppName = segments.slice(scopeIndex).join("/");
  }

  if (normalized === "." || VALID_APP_NAME_REGEX.test(scopedAppName ?? "")) {
    return;
  }

  return "Name must consist of only lowercase alphanumeric characters, '-', and '_'";
}
