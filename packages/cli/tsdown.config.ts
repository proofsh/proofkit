import path from "node:path";
import { fileURLToPath } from "node:url";
import fsExtra from "fs-extra";
import { defineConfig } from "tsdown";

const { readJSONSync } = fsExtra;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.npm_lifecycle_event === "dev";

const readPackageVersion = (packagePath: string) => {
  const packageJsonPath = path.join(__dirname, "..", packagePath, "package.json");
  const packageJson = readJSONSync(packageJsonPath);
  if (!packageJson.version) {
    throw new Error(`No version found in ${packageJsonPath}`);
  }
  return packageJson.version;
};

const FMDAPI_VERSION = readPackageVersion("fmdapi");
const BETTER_AUTH_VERSION = readPackageVersion("better-auth");
const WEBVIEWER_VERSION = readPackageVersion("webviewer");
const TYPEGEN_VERSION = readPackageVersion("typegen");
const versionDefines = {
  __FMDAPI_VERSION__: JSON.stringify(FMDAPI_VERSION),
  __BETTER_AUTH_VERSION__: JSON.stringify(BETTER_AUTH_VERSION),
  __WEBVIEWER_VERSION__: JSON.stringify(WEBVIEWER_VERSION),
  __TYPEGEN_VERSION__: JSON.stringify(TYPEGEN_VERSION),
};

export default defineConfig({
  clean: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  minify: !isDev,
  target: "esnext",
  outDir: "dist",
  nodeProtocol: false,
  plugins: [
    {
      name: "proofkit-version-defines",
      transform(code) {
        let nextCode = code;
        for (const [name, value] of Object.entries(versionDefines)) {
          nextCode = nextCode.replaceAll(name, value);
        }
        return nextCode === code ? null : { code: nextCode, map: null };
      },
    },
  ],
});
