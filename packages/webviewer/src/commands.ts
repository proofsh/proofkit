declare const webViewerCommandRegistryBrand: unique symbol;

export interface WebViewerCommandRegistry {
  readonly [webViewerCommandRegistryBrand]?: never;
}

export type AnyWebViewerCommand = (...args: string[]) => unknown;

export type WebViewerCommandName = keyof WebViewerCommandRegistry & string;

export type WebViewerCommand<K extends WebViewerCommandName> = WebViewerCommandRegistry[K] extends AnyWebViewerCommand
  ? WebViewerCommandRegistry[K]
  : never;

export interface WebViewerCommandRegistryOptions {
  namespace?: string;
  missingCommand?: "buffer" | "drop" | "warn" | "throw";
  maxBufferedCallsPerCommand?: number;
  allowDirectAssignment?: boolean;
  onError?: (
    error: unknown,
    context: {
      name: string;
      phase: "call" | "replay";
    },
  ) => void;
  onWarn?: (message: string, context: { name?: string }) => void;
}

export interface WebViewerCommandRegistryHandle {
  namespace: string;
  target: Record<string, AnyWebViewerCommand>;
  clearPendingCalls: (name?: string) => void;
  listRegisteredCommands: () => string[];
  listPendingCommands: () => string[];
}

interface WebViewerCommandState {
  namespace: string;
  handlers: Map<string, AnyWebViewerCommand>;
  handlerWrappers: Map<string, AnyWebViewerCommand>;
  pendingCalls: Map<string, string[][]>;
  options: Required<
    Pick<WebViewerCommandRegistryOptions, "missingCommand" | "maxBufferedCallsPerCommand" | "allowDirectAssignment">
  > &
    Pick<WebViewerCommandRegistryOptions, "onError" | "onWarn">;
  target?: Record<string, AnyWebViewerCommand>;
  handle?: WebViewerCommandRegistryHandle;
}

const DEFAULT_NAMESPACE = "proofkit";
const DEFAULT_MAX_BUFFERED_CALLS = 100;
const targetState = new WeakMap<object, WebViewerCommandState>();
const states = new Map<string, WebViewerCommandState>();

let activeNamespace = DEFAULT_NAMESPACE;

const getWindow = (): (Window & typeof globalThis) | undefined => (typeof window === "undefined" ? undefined : window);

const warn = (state: WebViewerCommandState, message: string, context: { name?: string } = {}) => {
  if (state.options.onWarn) {
    state.options.onWarn(message, context);
    return;
  }
  console.warn(message);
};

const reportError = (
  state: WebViewerCommandState,
  error: unknown,
  context: {
    name: string;
    phase: "call" | "replay";
  },
) => {
  if (state.options.onError) {
    state.options.onError(error, context);
    return;
  }
  console.error(error);
};

const getState = (namespace: string): WebViewerCommandState => {
  const existing = states.get(namespace);
  if (existing) {
    return existing;
  }

  const state: WebViewerCommandState = {
    namespace,
    handlers: new Map(),
    handlerWrappers: new Map(),
    pendingCalls: new Map(),
    options: {
      missingCommand: "buffer",
      maxBufferedCallsPerCommand: DEFAULT_MAX_BUFFERED_CALLS,
      allowDirectAssignment: false,
    },
  };
  states.set(namespace, state);
  return state;
};

const applyOptions = (state: WebViewerCommandState, options: WebViewerCommandRegistryOptions = {}) => {
  state.options = {
    ...state.options,
    ...options,
    maxBufferedCallsPerCommand: options.maxBufferedCallsPerCommand ?? state.options.maxBufferedCallsPerCommand,
    missingCommand: options.missingCommand ?? state.options.missingCommand,
    allowDirectAssignment: options.allowDirectAssignment ?? state.options.allowDirectAssignment,
  };
};

const bufferCall = (state: WebViewerCommandState, name: string, args: string[]) => {
  const calls = state.pendingCalls.get(name) ?? [];
  calls.push(args);

  if (calls.length > state.options.maxBufferedCallsPerCommand) {
    calls.shift();
    warn(state, `[webviewer commands] dropping oldest buffered call for "${name}"`, { name });
  }

  state.pendingCalls.set(name, calls);
};

const getMissingCommand = (state: WebViewerCommandState, name: string): AnyWebViewerCommand => {
  switch (state.options.missingCommand) {
    case "drop":
      return () => undefined;
    case "warn":
      return () => {
        warn(state, `[webviewer commands] missing command "${name}"`, { name });
      };
    case "throw":
      return () => {
        throw new Error(`[webviewer commands] missing command "${name}"`);
      };
    case "buffer":
      return (...args: string[]) => {
        bufferCall(state, name, args);
      };
    default:
      return () => undefined;
  }
};

const getCommandWrapper = (state: WebViewerCommandState, name: string, handler: AnyWebViewerCommand) => {
  const existing = state.handlerWrappers.get(name);
  if (existing) {
    return existing;
  }

  const wrappedHandler: AnyWebViewerCommand = (...args) => {
    try {
      return handler(...args);
    } catch (error) {
      reportError(state, error, { name, phase: "call" });
      return undefined;
    }
  };
  state.handlerWrappers.set(name, wrappedHandler);
  return wrappedHandler;
};

const makeHandle = (state: WebViewerCommandState): WebViewerCommandRegistryHandle => ({
  namespace: state.namespace,
  target: state.target ?? {},
  clearPendingCalls: (name?: string) => {
    if (name) {
      state.pendingCalls.delete(name);
      return;
    }
    state.pendingCalls.clear();
  },
  listRegisteredCommands: () => [...state.handlers.keys()],
  listPendingCommands: () => [...state.pendingCalls.keys()],
});

const createProxy = (state: WebViewerCommandState): Record<string, AnyWebViewerCommand> =>
  new Proxy<Record<string, AnyWebViewerCommand>>(
    {},
    {
      get: (_target, property) => {
        if (typeof property !== "string") {
          return undefined;
        }

        const handler = state.handlers.get(property);
        if (handler) {
          return getCommandWrapper(state, property, handler);
        }

        return getMissingCommand(state, property);
      },
      has: (_target, property) => typeof property === "string" && state.handlers.has(property),
      ownKeys: () => [...state.handlers.keys()],
      getOwnPropertyDescriptor: (_target, property) => {
        if (typeof property !== "string" || !state.handlers.has(property)) {
          return undefined;
        }

        return {
          configurable: true,
          enumerable: true,
          value: getCommandWrapper(state, property, state.handlers.get(property) as AnyWebViewerCommand),
        };
      },
      set: (_target, property, value) => {
        if (typeof property !== "string") {
          return true;
        }

        if (!state.options.allowDirectAssignment) {
          warn(state, `[webviewer commands] direct assignment unsupported for "${property}"`, { name: property });
          return true;
        }

        if (typeof value !== "function") {
          warn(state, `[webviewer commands] direct assignment for "${property}" must be a function`, {
            name: property,
          });
          return true;
        }

        registerCommand(state, property, value as AnyWebViewerCommand);
        return true;
      },
    },
  );

const registerCommand = (state: WebViewerCommandState, name: string, fn: AnyWebViewerCommand) => {
  if (state.handlers.has(name)) {
    warn(state, `[webviewer commands] overwriting command "${name}"`, { name });
  }

  state.handlers.set(name, fn);
  state.handlerWrappers.delete(name);

  const pending = state.pendingCalls.get(name);
  if (!pending) {
    return;
  }

  state.pendingCalls.delete(name);
  for (const args of pending) {
    try {
      fn(...args);
    } catch (error) {
      reportError(state, error, { name, phase: "replay" });
    }
  }
};

export const initWebViewerCommands = (
  options: WebViewerCommandRegistryOptions = {},
): WebViewerCommandRegistryHandle | undefined => {
  const namespace = options.namespace ?? activeNamespace;
  activeNamespace = namespace;

  const state = getState(namespace);
  applyOptions(state, options);

  const browserWindow = getWindow();
  if (!browserWindow) {
    return undefined;
  }

  const globalTarget = browserWindow as unknown as Record<string, unknown>;
  const existing = globalTarget[namespace];

  if (existing !== undefined && existing !== null) {
    const existingState = targetState.get(existing);
    if (existingState) {
      applyOptions(existingState, options);
      existingState.handle ??= makeHandle(existingState);
      return existingState.handle;
    }

    warn(state, `[webviewer commands] window.${namespace} already exists; preserving existing value`);
    return undefined;
  }

  const target = createProxy(state);
  state.target = target;
  targetState.set(target, state);
  globalTarget[namespace] = target;
  state.handle = makeHandle(state);

  return state.handle;
};

export const registerWebViewerCommand = <K extends WebViewerCommandName>(
  name: K,
  fn: WebViewerCommand<K>,
): (() => void) => {
  initWebViewerCommands();
  const state = getState(activeNamespace);
  const handler = fn as AnyWebViewerCommand;
  registerCommand(state, name, handler);

  return () => {
    if (state.handlers.get(name) === handler) {
      state.handlers.delete(name);
      state.handlerWrappers.delete(name);
    }
  };
};

export const unregisterWebViewerCommand = (name: WebViewerCommandName) => {
  const state = getState(activeNamespace);
  state.handlers.delete(name);
  state.handlerWrappers.delete(name);
};

export const getWebViewerCommandRegistry = (): WebViewerCommandRegistryHandle | undefined =>
  getState(activeNamespace).handle;
