import { resolve } from "node:path";

import dotenv from "dotenv";

const currentDirectory = import.meta.dirname;
const envPath = resolve(currentDirectory, "../.env");

dotenv.config({ path: envPath });

const defaultFmMcpBaseUrl =
	process.env.FM_MCP_BASE_URL ?? "http://127.0.0.1:1365";

const stripFileExtension = (fileName) => fileName.replace(/\.fmp12$/iu, "");

const getConnectedFiles = async (baseUrl = defaultFmMcpBaseUrl) => {
	const healthResponse = await fetch(`${baseUrl}/health`).catch(() => null);
	if (!healthResponse?.ok) {
		return [];
	}

	const connectedFiles = await fetch(`${baseUrl}/connectedFiles`)
		.then((response) => (response.ok ? response.json() : []))
		.catch(() => []);

	return Array.isArray(connectedFiles) ? connectedFiles : [];
};

const isBridgeReachable = async (baseUrl = defaultFmMcpBaseUrl) => {
	const healthResponse = await fetch(`${baseUrl}/health`).catch(() => null);
	return healthResponse?.ok === true;
};

const normalizeTarget = (fileName) =>
	stripFileExtension(fileName).toLowerCase();

export const resolveFileMakerTarget = async () => {
	const connectedFiles = await getConnectedFiles();
	const targetFromEnv = process.env.FM_DATABASE
		? normalizeTarget(process.env.FM_DATABASE)
		: undefined;

	if (targetFromEnv) {
		const matches = connectedFiles.filter(
			(connectedFile) => normalizeTarget(connectedFile) === targetFromEnv,
		);
		if (matches.length === 1) {
			return {
				fileName: stripFileExtension(matches[0]),
				host: "$",
				source: "fm-mcp",
			};
		}

		if (connectedFiles.length > 0) {
			throw new Error(
				`FM_DATABASE is set to "${process.env.FM_DATABASE}" but no matching connected file was found via FM MCP.`,
			);
		}
	}

	if (connectedFiles.length === 1) {
		return {
			fileName: stripFileExtension(connectedFiles[0]),
			host: "$",
			source: "fm-mcp",
		};
	}

	if (connectedFiles.length > 1) {
		throw new Error(
			`Multiple FileMaker files are connected via FM MCP (${connectedFiles.join(", ")}). Set FM_DATABASE to choose one.`,
		);
	}

	const serverValue = process.env.FM_SERVER;
	const databaseValue = process.env.FM_DATABASE;

	if (serverValue && databaseValue) {
		let hostname;
		try {
			({ hostname } = new URL(serverValue));
		} catch {
			hostname = serverValue.replace(/^https?:\/\//u, "").replace(/\/.*$/u, "");
		}

		return {
			fileName: stripFileExtension(databaseValue),
			host: hostname,
			source: "env",
		};
	}

	return null;
};

export const callFileMakerScript = async ({
	baseUrl = defaultFmMcpBaseUrl,
	connectedFileName,
	scriptName,
	data,
}) => {
	const response = await fetch(`${baseUrl}/callScript`, {
		body: JSON.stringify({
			connectedFileName,
			data,
			scriptName,
		}),
		headers: { "content-type": "application/json" },
		method: "POST",
	}).catch((error) => {
		throw new Error(`Could not reach FM MCP bridge at ${baseUrl}/callScript.`, {
			cause: error,
		});
	});

	const payload = await response.json().catch(() => null);

	if (!response.ok) {
		const errorMessage =
			payload && typeof payload.error === "string"
				? payload.error
				: `HTTP ${response.status} from ${baseUrl}/callScript`;
		throw new Error(errorMessage);
	}

	if (
		!payload ||
		typeof payload.fetchId !== "string" ||
		!("result" in payload)
	) {
		throw new Error("Invalid response from FM MCP bridge /callScript.");
	}

	return payload;
};

export const deployHtml = async ({
	appName,
	path,
	scriptName = "deploy_html",
}) => {
	const target = await resolveFileMakerTarget();
	if (!target) {
		return {
			method: "none",
			target: null,
		};
	}

	const payload = { appName, path };
	const bridgeAvailable =
		target.source === "fm-mcp" && (await isBridgeReachable());

	if (bridgeAvailable) {
		try {
			const bridgeResult = await callFileMakerScript({
				connectedFileName: target.fileName,
				data: payload,
				scriptName,
			});
			return {
				method: "bridge",
				result: bridgeResult,
				target,
			};
		} catch (error) {
			if (target.host !== "$") {
				throw error;
			}
		}
	}

	const parameter = JSON.stringify(payload);
	return {
		method: "url",
		target,
		url: buildFmpUrl({
			fileName: target.fileName,
			host: target.host,
			parameter,
			scriptName,
		}),
	};
};

export const buildFmpUrl = ({ host, fileName, scriptName, parameter }) => {
	const params = new URLSearchParams({ script: scriptName });
	if (parameter) {
		params.set("param", parameter);
	}

	return `fmp://${host}/${encodeURIComponent(fileName)}?${params.toString()}`;
};
