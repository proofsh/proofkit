import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const readVersion = (packagePath) => {
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  return packageJson.version ?? "0.0.0-private";
};

const outputPath = path.join(packageRoot, "src", "generated", "package-versions.ts");
const content = [
  `export const CLI_VERSION = ${JSON.stringify(readVersion(path.join(packageRoot, "package.json")))} as const;`,
  `export const FMDAPI_VERSION = ${JSON.stringify(readVersion(path.join(packageRoot, "..", "fmdapi", "package.json")))} as const;`,
  `export const BETTER_AUTH_VERSION = ${JSON.stringify(
    readVersion(path.join(packageRoot, "..", "better-auth", "package.json")),
  )} as const;`,
  `export const WEBVIEWER_VERSION = ${JSON.stringify(
    readVersion(path.join(packageRoot, "..", "webviewer", "package.json")),
  )} as const;`,
  `export const TYPEGEN_VERSION = ${JSON.stringify(readVersion(path.join(packageRoot, "..", "typegen", "package.json")))} as const;`,
  "",
].join("\n");

writeFileSync(outputPath, content, "utf8");
