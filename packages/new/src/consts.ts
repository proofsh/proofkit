import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const distPath = path.dirname(__filename);
export const PKG_ROOT = path.join(distPath, "../");

export const DEFAULT_APP_NAME = "my-proofkit-app";
export const cliName = "proofkit-new";
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

  throw new Error(`Could not locate a template directory. Checked: ${candidates.join(", ")}`);
}

export const TEMPLATE_ROOT = resolveTemplateRoot();
