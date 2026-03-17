import type { HtmlTagDescriptor, Plugin } from "vite";

const TRAILING_SLASH_PATTERN = /\/$/;

export interface FmBridgeOptions {
  fileName?: string;
  fmHttpBaseUrl?: string;
  wsUrl?: string;
  debug?: boolean;
}

export const defaultFmHttpBaseUrl = "http://localhost:1365";
export const defaultWsUrl = "ws://localhost:1365/ws";

export const trimToNull = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeBaseUrl = (value: string): string => value.replace(TRAILING_SLASH_PATTERN, "");

export const resolveWsUrl = (options: Pick<FmBridgeOptions, "fmHttpBaseUrl" | "wsUrl">): string => {
  const explicitWsUrl = trimToNull(options.wsUrl);
  if (explicitWsUrl) {
    return explicitWsUrl;
  }

  const baseUrl = normalizeBaseUrl(trimToNull(options.fmHttpBaseUrl) ?? defaultFmHttpBaseUrl);

  try {
    const parsed = new URL(baseUrl);
    const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${parsed.host}/ws`;
  } catch {
    return defaultWsUrl;
  }
};

export const discoverConnectedFileName = async (baseUrl: string): Promise<string> => {
  const connectedFilesUrl = `${normalizeBaseUrl(baseUrl)}/connectedFiles`;

  let response: Response;
  try {
    response = await fetch(connectedFilesUrl);
  } catch (error) {
    throw new Error(`fmBridge could not reach ${connectedFilesUrl}. Start fm-http and connect a FileMaker webviewer.`, {
      cause: error,
    });
  }

  if (!response.ok) {
    throw new Error(
      `fmBridge received HTTP ${response.status} from ${connectedFilesUrl}. Ensure fm-http is healthy and reachable.`,
    );
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error(`fmBridge expected an array response from ${connectedFilesUrl}.`);
  }

  const firstFileName = payload.find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

  if (!firstFileName) {
    throw new Error(
      `fmBridge found no connected FileMaker files at ${connectedFilesUrl}. Open FileMaker and load /webviewer?fileName=YourFile.`,
    );
  }

  return firstFileName;
};

export const buildMockScriptTag = (options: {
  baseUrl: string;
  fileName: string | null;
  wsUrl: string;
  debug: boolean;
}): HtmlTagDescriptor | null => {
  if (!options.fileName) {
    return null;
  }

  const scriptUrl = new URL(`${normalizeBaseUrl(options.baseUrl)}/fm-mock.js`);
  scriptUrl.searchParams.set("fileName", options.fileName);
  scriptUrl.searchParams.set("wsUrl", options.wsUrl);

  if (options.debug) {
    scriptUrl.searchParams.set("debug", "true");
  }

  return {
    tag: "script",
    attrs: { src: scriptUrl.toString() },
    injectTo: "head-prepend",
  };
};

export const fmBridge = (options: FmBridgeOptions = {}): Plugin => {
  const baseUrl = trimToNull(options.fmHttpBaseUrl) ?? defaultFmHttpBaseUrl;
  const wsUrl = resolveWsUrl(options);
  const debug = options.debug === true;
  let resolvedFileName: string | null = trimToNull(options.fileName);
  let isServeMode = true;

  return {
    name: "proofkit-fm-bridge",
    apply(_config, { command }) {
      isServeMode = command === "serve";
      return isServeMode;
    },
    async configureServer() {
      if (!isServeMode) {
        return;
      }

      if (resolvedFileName) {
        return;
      }

      resolvedFileName = await discoverConnectedFileName(baseUrl);
    },
    async transformIndexHtml() {
      if (!isServeMode) {
        return;
      }

      if (!resolvedFileName) {
        resolvedFileName = await discoverConnectedFileName(baseUrl);
      }

      const tag = buildMockScriptTag({
        baseUrl,
        fileName: resolvedFileName,
        wsUrl,
        debug,
      });

      return tag ? [tag] : undefined;
    },
  };
};
