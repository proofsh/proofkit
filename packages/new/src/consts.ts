import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const distPath = path.dirname(__filename);
export const PKG_ROOT = path.join(distPath, "../");

export const DEFAULT_APP_NAME = "my-proofkit-app";
export const cliName = "proofkit-new";
export const TEMPLATE_ROOT = path.resolve(PKG_ROOT, "../../cli/template");
