import Script from "next/script";
import { createElement } from "react";

import {
  buildMockScriptUrl,
  buildNoConnectedFilesRuntimeScript,
  defaultFmMcpBaseUrl,
  discoverConnectedFileName,
  type FmBridgeOptions as InternalFmBridgeOptions,
  resolveWsUrl,
  trimToNull,
} from "./fm-bridge.js";

export interface FmBridgeOptions extends InternalFmBridgeOptions {}

export interface NextFmBridgeScriptProps {
  strategy: "beforeInteractive";
  src?: string;
  id?: string;
  dangerouslySetInnerHTML?: {
    __html: string;
  };
}

export interface ResolvedFmBridgeScriptProps {
  script: NextFmBridgeScriptProps | null;
}

const fallbackScriptId = "proofkit-fm-bridge-fallback";

export const getFmBridgeScriptProps = async (
  options: FmBridgeOptions = {},
): Promise<NextFmBridgeScriptProps | null> => {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const baseUrl = trimToNull(options.fmMcpBaseUrl) ?? defaultFmMcpBaseUrl;
  const wsUrl = resolveWsUrl(options);
  const debug = options.debug === true;
  const resolvedFileName = trimToNull(options.fileName) ?? (await discoverConnectedFileName(baseUrl));

  if (resolvedFileName) {
    return {
      strategy: "beforeInteractive",
      src: buildMockScriptUrl({
        baseUrl,
        fileName: resolvedFileName,
        wsUrl,
        debug,
      }),
    };
  }

  return {
    strategy: "beforeInteractive",
    id: fallbackScriptId,
    dangerouslySetInnerHTML: {
      __html: buildNoConnectedFilesRuntimeScript(baseUrl),
    },
  };
};

export const ResolvedFmBridgeScript = ({ script }: ResolvedFmBridgeScriptProps) => {
  if (!script) {
    return null;
  }

  return createElement(Script, script as unknown as Record<string, unknown>);
};

export const FmBridgeScript = async (options: FmBridgeOptions = {}) => {
  const script = await getFmBridgeScriptProps(options);
  if (!script) {
    return null;
  }

  return createElement(ResolvedFmBridgeScript, { script });
};
