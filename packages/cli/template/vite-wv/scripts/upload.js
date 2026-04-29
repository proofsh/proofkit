import open from "open";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { deployHtml } from "./filemaker.js";
import packageJson from "../package.json" with { type: "json" };

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
const thePath = resolve(currentDirectory, "../dist", "index.html");
const deployment = await deployHtml({
  appName: packageJson.name,
  path: thePath,
});

if (deployment.method === "none") {
  console.error(
    "Could not resolve a FileMaker file. Start the local FM MCP proxy with a connected file, or set FM_SERVER and FM_DATABASE in .env.",
  );
  process.exit(1);
}

if (deployment.method === "bridge") {
  console.log("Deployed via FM MCP bridge.");
  process.exit(0);
}

await open(deployment.url);
