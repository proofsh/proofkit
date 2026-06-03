import { resolve } from "node:path";

import open from "open";

import packageJson from "../package.json" with { type: "json" };
import { deployHtml } from "./filemaker.js";

const currentDirectory = import.meta.dirname;
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
