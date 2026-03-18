import { resolve } from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
const envPath = resolve(currentDirectory, "../.env");

dotenv.config({ path: envPath });

const defaultFmHttpBaseUrl = process.env.FM_HTTP_BASE_URL ?? "http://127.0.0.1:1365";

function stripFileExtension(fileName) {
  return fileName.replace(/\.fmp12$/i, "");
}

async function getConnectedFiles(baseUrl = defaultFmHttpBaseUrl) {
  const healthResponse = await fetch(`${baseUrl}/health`).catch(() => null);
  if (!healthResponse?.ok) {
    return [];
  }

  const connectedFiles = await fetch(`${baseUrl}/connectedFiles`)
    .then((response) => (response.ok ? response.json() : []))
    .catch(() => []);

  return Array.isArray(connectedFiles) ? connectedFiles : [];
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
        source: "fm-http",
      };
    }

    if (connectedFiles.length > 0) {
      throw new Error(
        `FM_DATABASE is set to "${process.env.FM_DATABASE}" but no matching connected file was found via FM HTTP.`,
      );
    }
  }

  if (connectedFiles.length === 1) {
    return {
      fileName: stripFileExtension(connectedFiles[0]),
      host: "$",
      source: "fm-http",
    };
  }

  if (connectedFiles.length > 1) {
    throw new Error(
      `Multiple FileMaker files are connected via FM HTTP (${connectedFiles.join(", ")}). Set FM_DATABASE to choose one.`,
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

export function buildFmpUrl({ host, fileName, scriptName, parameter }) {
  const params = new URLSearchParams({ script: scriptName });
  if (parameter) {
    params.set("param", parameter);
  }

  return `fmp://${host}/${encodeURIComponent(fileName)}?${params.toString()}`;
}
