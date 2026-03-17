import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const distPath = path.dirname(__filename);
export const PKG_ROOT = path.join(distPath, "../");

export const DEFAULT_APP_NAME = "my-proofkit-app";
export const cliName = "proofkit-new";

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
