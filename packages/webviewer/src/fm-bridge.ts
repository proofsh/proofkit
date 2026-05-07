import type { HtmlTagDescriptor, Plugin } from "vite";

const TRAILING_SLASH_PATTERN = /\/$/;
const CONNECTED_FILES_TIMEOUT_MS = 5000;

export interface FmBridgeOptions {
  fileName?: string;
  fmMcpBaseUrl?: string;
  wsUrl?: string;
  debug?: boolean;
}

export const defaultFmMcpBaseUrl = "http://localhost:1365";
export const defaultWsUrl = "ws://localhost:1365/ws";

export const trimToNull = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeBaseUrl = (value: string): string => value.replace(TRAILING_SLASH_PATTERN, "");

export const buildNoConnectedFilesWarning = (connectedFilesUrl: string): string =>
  `fmBridge found no connected FileMaker files at ${connectedFilesUrl}. Dev server will continue. Connect a FileMaker webviewer to enable bridge forwarding.`;

export const buildNoConnectedFilesRuntimeError = (connectedFilesUrl: string): string =>
  `fmBridge could not forward message because no connected FileMaker file is available from ${connectedFilesUrl}.`;

export const buildMockScriptUrl = (options: {
  baseUrl: string;
  fileName: string;
  wsUrl: string;
  debug: boolean;
}): string => {
  const scriptUrl = new URL(`${normalizeBaseUrl(options.baseUrl)}/fm-mock.js`);
  scriptUrl.searchParams.set("fileName", options.fileName);
  scriptUrl.searchParams.set("wsUrl", options.wsUrl);

  if (options.debug) {
    scriptUrl.searchParams.set("debug", "true");
  }

  return scriptUrl.toString();
};

export const resolveWsUrl = (options: Pick<FmBridgeOptions, "fmMcpBaseUrl" | "wsUrl">): string => {
  const explicitWsUrl = trimToNull(options.wsUrl);
  if (explicitWsUrl) {
    return explicitWsUrl;
  }

  const baseUrl = normalizeBaseUrl(trimToNull(options.fmMcpBaseUrl) ?? defaultFmMcpBaseUrl);

  try {
    const parsed = new URL(baseUrl);
    const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${parsed.host}/ws`;
  } catch {
    return defaultWsUrl;
  }
};

export const discoverConnectedFileName = async (baseUrl: string): Promise<string | null> => {
  const connectedFilesUrl = `${normalizeBaseUrl(baseUrl)}/connectedFiles`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, CONNECTED_FILES_TIMEOUT_MS);
  const reachabilityErrorMessage = `fmBridge could not reach ${connectedFilesUrl}. Start fm-mcp and connect a FileMaker webviewer.`;

  let response: Response;
  try {
    response = await fetch(connectedFilesUrl, {
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(reachabilityErrorMessage, {
      cause: error,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(
      `fmBridge received HTTP ${response.status} from ${connectedFilesUrl}. Ensure fm-mcp is healthy and reachable.`,
    );
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error(`fmBridge expected an array response from ${connectedFilesUrl}.`);
  }

  const firstFileName = payload.find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

  if (!firstFileName) {
    return null;
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

  return {
    tag: "script",
    attrs: {
      src: buildMockScriptUrl({
        baseUrl: options.baseUrl,
        fileName: options.fileName,
        wsUrl: options.wsUrl,
        debug: options.debug,
      }),
    },
    injectTo: "head-prepend",
  };
};

export const buildNoConnectedFilesRuntimeScript = (baseUrl: string): string => {
  const connectedFilesUrl = `${normalizeBaseUrl(baseUrl)}/connectedFiles`;
  const errorMessage = buildNoConnectedFilesRuntimeError(connectedFilesUrl);

  return `
(() => {
  const errorMessage = ${JSON.stringify(errorMessage)};
  const report = () => {
    console.error(errorMessage);
    return undefined;
  };

  if (!window.filemaker) {
    const filemakerStub = function filemaker() {
      return report();
    };
    filemakerStub.performScript = report;
    filemakerStub.performScriptWithOption = report;
    window.filemaker = filemakerStub;
  }

  if (!window.FileMaker) {
    window.FileMaker = {
      PerformScript: report,
      PerformScriptWithOption: report,
    };
  }
})();
`.trim();
};

export const buildNoConnectedFilesScriptTag = (baseUrl: string): HtmlTagDescriptor => {
  return {
    tag: "script",
    injectTo: "head-prepend",
    children: buildNoConnectedFilesRuntimeScript(baseUrl),
  };
};

export const fmBridge = (options: FmBridgeOptions = {}): Plugin => {
  const baseUrl = trimToNull(options.fmMcpBaseUrl) ?? defaultFmMcpBaseUrl;
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
      if (!resolvedFileName) {
        console.warn(buildNoConnectedFilesWarning(`${normalizeBaseUrl(baseUrl)}/connectedFiles`));
      }
    },
    async transformIndexHtml() {
      if (!isServeMode) {
        return;
      }

      if (!resolvedFileName) {
        resolvedFileName = await discoverConnectedFileName(baseUrl);
      }

      const tag = resolvedFileName
        ? buildMockScriptTag({
            baseUrl,
            fileName: resolvedFileName,
            wsUrl,
            debug,
          })
        : buildNoConnectedFilesScriptTag(baseUrl);

      return tag ? [tag] : undefined;
    },
  };
};
