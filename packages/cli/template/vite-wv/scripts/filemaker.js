import { resolve } from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
const envPath = resolve(currentDirectory, "../.env");

dotenv.config({ path: envPath });

const defaultFmMcpBaseUrl = process.env.FM_MCP_BASE_URL ?? "http://127.0.0.1:1365";

function stripFileExtension(fileName) {
  return fileName.replace(/\.fmp12$/i, "");
}

async function getConnectedFiles(baseUrl = defaultFmMcpBaseUrl) {
  const healthResponse = await fetch(`${baseUrl}/health`).catch(() => null);
  if (!healthResponse?.ok) {
    return [];
  }

  const connectedFiles = await fetch(`${baseUrl}/connectedFiles`)
    .then((response) => (response.ok ? response.json() : []))
    .catch(() => []);

  return Array.isArray(connectedFiles) ? connectedFiles : [];
}

async function isBridgeReachable(baseUrl = defaultFmMcpBaseUrl) {
  const healthResponse = await fetch(`${baseUrl}/health`).catch(() => null);
  return healthResponse?.ok === true;
}

function normalizeTarget(fileName) {
  return stripFileExtension(fileName).toLowerCase();
}

export async function resolveFileMakerTarget() {
  const connectedFiles = await getConnectedFiles();
  const targetFromEnv = process.env.FM_DATABASE ? normalizeTarget(process.env.FM_DATABASE) : undefined;

  if (targetFromEnv) {
    const matches = connectedFiles.filter((connectedFile) => normalizeTarget(connectedFile) === targetFromEnv);
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
      hostname = new URL(serverValue).hostname;
    } catch {
      hostname = serverValue.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }

    return {
      fileName: stripFileExtension(databaseValue),
      host: hostname,
      source: "env",
    };
  }

  return null;
}

export async function callFileMakerScript({
  baseUrl = defaultFmMcpBaseUrl,
  connectedFileName,
  scriptName,
  data,
}) {
  const response = await fetch(`${baseUrl}/callScript`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      connectedFileName,
      scriptName,
      data,
    }),
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

  if (!payload || typeof payload.fetchId !== "string" || !("result" in payload)) {
    throw new Error("Invalid response from FM MCP bridge /callScript.");
  }

  return payload;
}

export async function deployHtml({
  appName,
  path,
  scriptName = "deploy_html",
}) {
  const target = await resolveFileMakerTarget();
  if (!target) {
    return {
      method: "none",
      target: null,
    };
  }

  const payload = { appName, path };
  const bridgeAvailable = target.source === "fm-mcp" && (await isBridgeReachable());

  if (bridgeAvailable) {
    try {
      const bridgeResult = await callFileMakerScript({
        connectedFileName: target.fileName,
        scriptName,
        data: payload,
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
      host: target.host,
      fileName: target.fileName,
      scriptName,
      parameter,
    }),
  };
}

export function buildFmpUrl({ host, fileName, scriptName, parameter }) {
  const params = new URLSearchParams({ script: scriptName });
  if (parameter) {
    params.set("param", parameter);
  }

  return `fmp://${host}/${encodeURIComponent(fileName)}?${params.toString()}`;
}
