import open from "open";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { buildFmpUrl, resolveFileMakerTarget } from "./filemaker.js";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
const thePath = resolve(currentDirectory, "../dist", "index.html");
const target = await resolveFileMakerTarget();

if (!target) {
  console.error(
    "Could not resolve a FileMaker file. Start the local FM HTTP proxy with a connected file, or set FM_SERVER and FM_DATABASE in .env.",
  );
  process.exit(1);
}

await open(
  buildFmpUrl({
    host: target.host,
    fileName: target.fileName,
    scriptName: "UploadWebviewerWidget",
    parameter: thePath,
  }),
);
