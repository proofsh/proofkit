import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const distPath = path.dirname(__filename);
export const PKG_ROOT = path.join(distPath, "../");

export const DEFAULT_APP_NAME = "my-proofkit-app";
export const cliName = "proofkit";
export const npmName = "@proofkit/cli";
export const DOCS_URL = "https://proofkit.dev";

export const AGENT_INSTRUCTIONS = [
  "Use the ProofKit docs as the primary reference for this project: https://proofkit.dev/docs",
  "Before doing any AI-assisted development here, run `npx @tanstack/intent@latest install` in the project root to load skills relevant to this project",
].join("\n");

// Registry URL is injected at build time via tsdown define.
declare const __REGISTRY_URL__: string;
export const DEFAULT_REGISTRY_URL =
  typeof __REGISTRY_URL__ !== "undefined" && __REGISTRY_URL__ ? __REGISTRY_URL__ : "https://proofkit.dev";
const TITLE_ASCII = `
 _______                             ___  ___  ____    _   _
|_   __ \\                          .' ..]|_  ||_  _|  (_) / |_
  | |__) |_ .--.   .--.    .--.   _| |_    | |_/ /    __ \`| |-'
  |  ___/[ \`/'\`\\]/ .'\`\\ \\/ .'\`\\ \\'-| |-'   |  __'.   [  | | |
 _| |_    | |    | \\__. || \\__. |  | |    _| | \\  \\_  | | | |,
|_____|  [___]    '.__.'  '.__.'  [___]  |____||____|[___]\\__/
`;
export function getTitleText(version: string) {
  const versionText = `v${version}`;
  const lineWidth = 61;
  const padding = Math.max(lineWidth - versionText.length, 0);
  return `${TITLE_ASCII}${" ".repeat(padding)}${versionText}\n`;
}
function resolveTemplateRoot(): string {
  const candidates = [path.join(PKG_ROOT, "template"), path.resolve(PKG_ROOT, "../cli/template")] as const;

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export const TEMPLATE_ROOT = resolveTemplateRoot();
