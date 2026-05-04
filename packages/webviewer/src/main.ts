import { v4 } from "uuid";

let webViewerName: string;
/**
 * @private
 * set the name of the Web Viewer to use for all fetches
 * @param name the Layout Object Name of the FileMaker Web Viewer to callback too
 */
function setWebViewerName(name: string) {
  webViewerName = name;
}

/**
 * globalSettings
 */
export const globalSettings = {
  /**
   *
   * set the name of the Web Viewer to use for all fetches
   * @param name the Layout Object Name of the FileMaker Web Viewer to callback too
   */
  setWebViewerName,
};

/**
 * Call a script in FileMaker, and get a response from the script either as a Promise or through a callback
 *
 * @param scriptName the name of the script to call. The script does have to follow conventions (see docs)
 * @param data optional script parameter, it can also just take a string
 */
export function fmFetch<T = unknown>(scriptName: string, data: string | object): Promise<T>;
export function fmFetch(
  scriptName: string,
  data: string | object,
  /**
   * @param cb callback function to call when the script is done
   */
  callback: () => void,
): void;
export function fmFetch(scriptName: string, data: string | object, callback?: () => void) {
  if (callback) {
    return _execScript(scriptName, data, callback);
  }
  return new Promise((resolve) => {
    _execScript(scriptName, data, (result) => {
      resolve(result);
    });
  });
}

const cbs: Record<string, (arg0?: unknown) => void> = {};

if (typeof window !== "undefined") {
  window.handleFmWVFetchCallback = (data: unknown, fetchId: string) => {
    setTimeout(() => {
      const cb = cbs[fetchId];
      delete cbs[fetchId];
      if (!cb) {
        console.error(`Callback is missing for fetchId: ${fetchId}`);
        return false;
      }
      let parsedData = data;
      try {
        if (typeof data === "string") {
          parsedData = JSON.parse(data);
        }
      } catch {
        // Ignore parse errors, use original data
      }
      cb(parsedData);
    }, 1);
    return true;
  };
}

/**
 * @private
 */
function _execScript(scriptName: string, data: unknown, cb: (arg0?: unknown) => void) {
  const fetchId = v4();
  cbs[fetchId] = cb;
  const param = {
    data,
    callback: { fetchId, fn: "handleFmWVFetchCallback", webViewerName },
  };
  callFMScript(scriptName, param);
}

/**
 * calls a FileMaker Script without a callback or a promise
 */
export function callFMScript<ScriptParams extends string | Record<string, unknown> = Record<string, unknown>>(
  scriptName: string,
  data?: ScriptParams,
  option?: FMScriptOption,
): void;
export function callFMScript<ScriptParams extends string | Record<string, unknown> = Record<string, unknown>>(
  scriptName: string,
  data?: ScriptParams,
  option?: FMScriptOption,
): void {
  let params = data as string;
  try {
    if (typeof data !== "string") {
      params = JSON.stringify(data);
    }
  } catch {
    // Ignore JSON stringify errors, use data as-is
  }

  if (!window.FileMaker) {
    throw new Error(
      `Could not call script, '${scriptName}'. 'window.FileMaker' was not available at the time this function was called.`,
    );
  }

  if (option) {
    window.FileMaker.PerformScriptWithOption(scriptName, params, option);
  } else {
    window.FileMaker.PerformScript(scriptName, params);
  }
}
export const FMScriptOption = {
  CONTINUE: "0",
  HALT: "1",
  EXIT: "2",
  RESUME: "3",
  PAUSE: "4",
  SUSPEND_AND_RESUME: "5",
} as const;
type FMScriptOption = (typeof FMScriptOption)[keyof typeof FMScriptOption];
