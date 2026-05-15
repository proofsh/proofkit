import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const distPath = path.dirname(__filename);
export const PKG_ROOT = process.env.PROOFKIT_PKG_ROOT ?? path.join(distPath, "../");

export const DEFAULT_APP_NAME = "my-proofkit-app";
export const NODE_RUNTIME_VERSION = "^24.11.0";
export const cliName = "proofkit";
export const npmName = "@proofkit/cli";
export const DOCS_URL = "https://proofkit.proof.sh";

export function getAgentInstructions() {
  return "Use the ProofKit docs as the primary reference for this project: https://proofkit.proof.sh/docs";
}

// Registry URL is injected at build time via tsdown define.
declare const __REGISTRY_URL__: string;
export const DEFAULT_REGISTRY_URL =
  typeof __REGISTRY_URL__ !== "undefined" && __REGISTRY_URL__ ? __REGISTRY_URL__ : "https://proofkit.proof.sh";
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
