import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import type { InitRequest } from "~/core/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function makeInitRequest(overrides: Partial<InitRequest> = {}): InitRequest {
  return {
    projectName: "demo-app",
    scopedAppName: "demo-app",
    appDir: "demo-app",
    appType: "browser",
    ui: "shadcn",
    dataSource: "none",
    packageManager: "pnpm",
    noInstall: false,
    noGit: false,
    force: false,
    cwd: "/tmp/workspace",
    importAlias: "~/",
    nonInteractive: true,
    debug: false,
    skipFileMakerSetup: false,
    hasExplicitFileMakerInputs: false,
    ...overrides,
  };
}

export function getSharedTemplateDir(templateName: "nextjs-shadcn" | "nextjs-mantine" | "vite-wv") {
  return path.resolve(__dirname, `../../cli/template/${templateName}`);
}

export async function readScaffoldArtifacts(projectDir: string) {
  const packageJson = await fs.readJson(path.join(projectDir, "package.json"));
  const proofkitJson = await fs.readJson(path.join(projectDir, "proofkit.json"));
  const envFile = await fs.readFile(path.join(projectDir, ".env"), "utf8");
  const typegenPath = path.join(projectDir, "proofkit-typegen.config.jsonc");
  const typegenConfig = (await fs.pathExists(typegenPath)) ? await fs.readFile(typegenPath, "utf8") : undefined;

  return {
    packageJson,
    proofkitJson,
    envFile,
    typegenConfig,
  };
}
