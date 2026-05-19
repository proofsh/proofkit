import React from "react";

import {
  type AnyWebViewerCommand,
  initWebViewerCommands,
  registerWebViewerCommand,
  type WebViewerCommand,
  type WebViewerCommandName,
} from "./commands.js";

const ReactHooks = React as unknown as {
  useEffect: (effect: () => undefined | (() => void), deps: readonly unknown[]) => void;
  useRef: <T>(initialValue: T) => { current: T };
};

export const useWebViewerCommand = <K extends WebViewerCommandName>(name: K, fn: WebViewerCommand<K>) => {
  const latestFn = ReactHooks.useRef(fn);
  latestFn.current = fn;

  ReactHooks.useEffect(() => {
    initWebViewerCommands();
    return registerWebViewerCommand(name, ((...args: string[]) =>
      (latestFn.current as AnyWebViewerCommand)(...args)) as WebViewerCommand<K>);
  }, [name]);
};
