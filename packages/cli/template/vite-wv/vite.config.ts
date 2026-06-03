import path from "node:path";

import { fmBridge } from "@proofkit/webviewer/vite-plugins";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const currentDirectory = import.meta.dirname;

export default defineConfig({
	plugins: [fmBridge(), react(), tailwindcss(), viteSingleFile()],
	resolve: {
		alias: {
			"@": path.resolve(currentDirectory, "./src"),
		},
	},
	server: {
		port: 5175,
	},
});
