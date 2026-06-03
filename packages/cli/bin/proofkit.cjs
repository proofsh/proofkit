#!/usr/bin/env node
"use strict";

const { existsSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const BINARIES = {
	darwin: {
		arm64: "proofkit-darwin-arm64",
		x64: "proofkit-darwin-x64",
	},
	linux: {
		arm64: "proofkit-linux-arm64",
		x64: "proofkit-linux-x64",
	},
	win32: {
		arm64: "proofkit-windows-arm64.exe",
		x64: "proofkit-windows-x64.exe",
	},
};

function run(command, args) {
	const result = spawnSync(command, args, {
		stdio: "inherit",
		env: {
			...process.env,
			PROOFKIT_PKG_ROOT: path.resolve(__dirname, ".."),
		},
	});

	if (result.error) {
		throw result.error;
	}

	if (typeof result.status === "number") {
		process.exit(result.status);
	}

	process.exit(1);
}

if (process.env.PROOFKIT_DISABLE_BUNDLED_BINARY !== "1") {
	const binaryName = BINARIES[process.platform]?.[process.arch];
	if (binaryName) {
		const binaryPath = path.join(__dirname, binaryName);
		if (existsSync(binaryPath)) {
			run(binaryPath, process.argv.slice(2));
		}
	}
}

const fallbackPath = path.join(__dirname, "..", "dist", "index.js");
if (existsSync(fallbackPath)) {
	run(process.execPath, [fallbackPath, ...process.argv.slice(2)]);
}

console.error(
	`No ProofKit executable found for ${process.platform}-${process.arch}.`,
);
process.exit(1);
