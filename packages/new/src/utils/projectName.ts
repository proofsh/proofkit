import path from "node:path";

const trailingSlashPattern = /\/+$/;

function removeTrailingSlash(input: string) {
  return input.replace(trailingSlashPattern, "");
}

export function parseNameAndPath(rawInput: string) {
  const input = removeTrailingSlash(rawInput);
  const paths = input.split("/");

  let appName = paths.at(-1) ?? "";
  if (appName === ".") {
    appName = path.basename(path.resolve(process.cwd()));
  }

  const indexOfDelimiter = paths.findIndex((segment) => segment.startsWith("@"));
  if (indexOfDelimiter !== -1) {
    appName = paths.slice(indexOfDelimiter).join("/");
  }

  const appDir = paths.filter((segment) => !segment.startsWith("@")).join("/");
  return [appName, appDir] as const;
}

const validationRegExp = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

export function validateAppName(rawInput: string) {
  const input = removeTrailingSlash(rawInput);
  const paths = input.split("/");
  const indexOfDelimiter = paths.findIndex((segment) => segment.startsWith("@"));

  let appName = paths.at(-1);
  if (indexOfDelimiter !== -1) {
    appName = paths.slice(indexOfDelimiter).join("/");
  }

  if (input === "." || validationRegExp.test(appName ?? "")) {
    return;
  }

  return "Name must consist of only lowercase alphanumeric characters, '-', and '_'";
}
