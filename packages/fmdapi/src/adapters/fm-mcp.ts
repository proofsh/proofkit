import type {
  CreateResponse,
  DeleteResponse,
  GetResponse,
  LayoutMetadataResponse,
  RawFMResponse,
  ScriptResponse,
  UpdateResponse,
} from "../client-types.js";
import { FileMakerError } from "../client-types.js";
import type {
  Adapter,
  CreateOptions,
  DeleteOptions,
  ExecuteScriptOptions,
  FindOptions,
  GetOptions,
  LayoutMetadataOptions,
  ListOptions,
  UpdateOptions,
} from "./core.js";

const TRAILING_SLASHES_REGEX = /\/+$/;
const DEFAULT_AUTHORIZE_TIMEOUT_MS = 125_000;
const SESSION_HEADER_NAME = "X-ProofKit-Session";
const CLIENT_HEADER_NAME = "X-ProofKit-Client";

const envValue = (name: string): string | undefined => {
  if (typeof process === "undefined") {
    return undefined;
  }
  return process.env[name];
};

const randomSessionId = (): string => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const statusReason = (status: unknown): string => {
  if (status === "rejected") {
    return "authorization rejected";
  }
  if (status === "timeout") {
    return "authorization timed out";
  }
  if (status === "file_not_connected") {
    return "file not connected";
  }
  return typeof status === "string" ? status : "authorization failed";
};

export interface FmMcpAdapterOptions {
  /** Base URL of the local FM MCP server (e.g. "http://localhost:3000") */
  baseUrl: string;
  /** Name of the connected FileMaker file */
  connectedFileName: string;
  /** Name of the FM script that executes Data API calls. Defaults to "execute_data_api" */
  scriptName?: string;
  /** Session ID sent to the bridge. Defaults to FM_MCP_SESSION_ID or a random ID. */
  sessionId?: string;
  /** Client name shown in FileMaker authorization prompts. Defaults to FM_MCP_CLIENT_NAME or "ProofKit Typegen". */
  clientName?: string;
  /** Client description shown in FileMaker authorization prompts. */
  clientDescription?: string;
  /** Timeout for /authorizeSession. Defaults to 125 seconds. */
  authorizationTimeoutMs?: number;
  /** If true, do not open FileMaker interactive authorization after a 401. */
  disableInteractiveAuthorization?: boolean;
}

export class FmMcpAdapter implements Adapter {
  protected baseUrl: string;
  protected connectedFileName: string;
  protected scriptName: string;
  protected sessionId: string;
  protected clientName: string;
  protected clientDescription: string;
  protected authorizationTimeoutMs: number;
  protected disableInteractiveAuthorization: boolean;
  protected pendingAuthorization?: Promise<void>;

  constructor(options: FmMcpAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(TRAILING_SLASHES_REGEX, "");
    this.connectedFileName = options.connectedFileName;
    this.scriptName = options.scriptName ?? "execute_data_api";
    this.sessionId = options.sessionId ?? envValue("FM_MCP_SESSION_ID") ?? randomSessionId();
    this.clientName = options.clientName ?? envValue("FM_MCP_CLIENT_NAME") ?? "ProofKit Typegen";
    this.clientDescription =
      options.clientDescription ??
      envValue("FM_MCP_CLIENT_DESCRIPTION") ??
      "ProofKit Typegen is requesting FileMaker bridge access.";
    this.authorizationTimeoutMs = options.authorizationTimeoutMs ?? DEFAULT_AUTHORIZE_TIMEOUT_MS;
    this.disableInteractiveAuthorization =
      options.disableInteractiveAuthorization ?? envValue("FM_MCP_DISABLE_INTERACTIVE_AUTHORIZATION") === "true";
  }

  protected sessionHeaders = (): Headers => {
    const headers = new Headers();
    headers.set(SESSION_HEADER_NAME, this.sessionId);
    headers.set(CLIENT_HEADER_NAME, this.clientName);
    return headers;
  };

  protected ensureAuthorized = (): Promise<void> => {
    if (this.pendingAuthorization) {
      return this.pendingAuthorization;
    }
    this.pendingAuthorization = this.requestAuthorization().finally(() => {
      this.pendingAuthorization = undefined;
    });
    return this.pendingAuthorization;
  };

  protected requestAuthorization = async (): Promise<void> => {
    if (this.disableInteractiveAuthorization) {
      throw new Error("interactive authorization disabled");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.authorizationTimeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/authorizeSession`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.sessionId,
          fileName: this.connectedFileName,
          clientName: this.clientName,
          clientDescription: this.clientDescription,
        }),
        signal: controller.signal,
      });
      const payload = (await res.json().catch(() => null)) as { status?: unknown; error?: unknown } | null;
      if (res.ok && payload?.status === "approved") {
        return;
      }
      const reason = typeof payload?.error === "string" ? payload.error : statusReason(payload?.status);
      throw new Error(reason);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("authorization timed out");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  };

  protected isUnauthorizedSession = async (res: Response): Promise<boolean> => {
    if (res.status !== 401) {
      return false;
    }
    const payload = (await res
      .clone()
      .json()
      .catch(() => null)) as { code?: unknown } | null;
    return payload?.code === "session_not_authorized";
  };

  protected request = async (params: {
    layout: string;
    body: object;
    action?: "read" | "metaData" | "create" | "update" | "delete";
    timeout?: number;
    fetchOptions?: RequestInit;
  }): Promise<unknown> => {
    const { action = "read", layout, body, fetchOptions = {} } = params;

    // Normalize underscore-prefixed keys to match FM script expectations
    const normalizedBody: Record<string, unknown> = { ...body } as Record<string, unknown>;
    if ("_offset" in normalizedBody) {
      normalizedBody.offset = normalizedBody._offset;
      normalizedBody._offset = undefined;
    }
    if ("_limit" in normalizedBody) {
      normalizedBody.limit = normalizedBody._limit;
      normalizedBody._limit = undefined;
    }
    if ("_sort" in normalizedBody) {
      normalizedBody.sort = normalizedBody._sort;
      normalizedBody._sort = undefined;
    }

    const scriptParam = JSON.stringify({
      ...normalizedBody,
      layouts: layout,
      action,
      version: "vLatest",
    });

    const controller = new AbortController();
    let timeout: NodeJS.Timeout | null = null;
    if (params.timeout) {
      timeout = setTimeout(() => controller.abort(), params.timeout);
    }

    const headers = new Headers(this.sessionHeaders());
    new Headers(fetchOptions?.headers).forEach((value, key) => {
      headers.set(key, value);
    });
    headers.set("Content-Type", "application/json");

    const postCallScript = () =>
      fetch(`${this.baseUrl}/callScript`, {
        ...fetchOptions,
        method: "POST",
        headers,
        body: JSON.stringify({
          connectedFileName: this.connectedFileName,
          scriptName: this.scriptName,
          data: scriptParam,
        }),
        signal: controller.signal,
      });

    let res: Response;
    try {
      res = await postCallScript();
      if (await this.isUnauthorizedSession(res)) {
        try {
          await this.ensureAuthorized();
        } catch (err) {
          const reason = err instanceof Error ? err.message : "authorization failed";
          throw new Error(`Not authorized to connect to FileMaker file "${this.connectedFileName}": ${reason}`);
        }
        res = await postCallScript();
      }
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }

    if (!res.ok) {
      throw new FileMakerError(String(res.status), `FM MCP request failed (${res.status}): ${await res.text()}`);
    }

    const raw = await res.json();
    // The /callScript response wraps the script result as a string or object
    let scriptResult: unknown;
    try {
      scriptResult = typeof raw.result === "string" ? JSON.parse(raw.result) : (raw.result ?? raw);
    } catch (err) {
      throw new FileMakerError(
        "500",
        `FM MCP response parse failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const respData = scriptResult as RawFMResponse;

    const errorCode = respData.messages?.[0]?.code;
    if (errorCode !== undefined && errorCode !== "0") {
      throw new FileMakerError(
        errorCode,
        `Filemaker Data API failed with (${errorCode}): ${JSON.stringify(respData, null, 2)}`,
      );
    }

    return respData.response;
  };

  list = async (opts: ListOptions): Promise<GetResponse> => {
    return (await this.request({
      body: opts.data,
      layout: opts.layout,
      timeout: opts.timeout,
      fetchOptions: opts.fetch,
    })) as GetResponse;
  };

  get = async (opts: GetOptions): Promise<GetResponse> => {
    return (await this.request({
      body: opts.data,
      layout: opts.layout,
      timeout: opts.timeout,
      fetchOptions: opts.fetch,
    })) as GetResponse;
  };

  find = async (opts: FindOptions): Promise<GetResponse> => {
    return (await this.request({
      body: opts.data,
      layout: opts.layout,
      timeout: opts.timeout,
      fetchOptions: opts.fetch,
    })) as GetResponse;
  };

  create = async (opts: CreateOptions): Promise<CreateResponse> => {
    return (await this.request({
      action: "create",
      body: opts.data,
      layout: opts.layout,
      timeout: opts.timeout,
      fetchOptions: opts.fetch,
    })) as CreateResponse;
  };

  update = async (opts: UpdateOptions): Promise<UpdateResponse> => {
    return (await this.request({
      action: "update",
      body: opts.data,
      layout: opts.layout,
      timeout: opts.timeout,
      fetchOptions: opts.fetch,
    })) as UpdateResponse;
  };

  delete = async (opts: DeleteOptions): Promise<DeleteResponse> => {
    return (await this.request({
      action: "delete",
      body: opts.data,
      layout: opts.layout,
      timeout: opts.timeout,
      fetchOptions: opts.fetch,
    })) as DeleteResponse;
  };

  layoutMetadata = async (opts: LayoutMetadataOptions): Promise<LayoutMetadataResponse> => {
    return (await this.request({
      action: "metaData",
      layout: opts.layout,
      body: {},
      timeout: opts.timeout,
      fetchOptions: opts.fetch,
    })) as LayoutMetadataResponse;
  };

  executeScript = async (opts: ExecuteScriptOptions): Promise<ScriptResponse> => {
    const postCallScript = () =>
      fetch(`${this.baseUrl}/callScript`, {
        method: "POST",
        headers: (() => {
          const headers = this.sessionHeaders();
          headers.set("Content-Type", "application/json");
          return headers;
        })(),
        body: JSON.stringify({
          connectedFileName: this.connectedFileName,
          scriptName: opts.script,
          data: opts.scriptParam,
        }),
      });

    let res = await postCallScript();
    if (await this.isUnauthorizedSession(res)) {
      try {
        await this.ensureAuthorized();
      } catch (err) {
        const reason = err instanceof Error ? err.message : "authorization failed";
        throw new Error(`Not authorized to connect to FileMaker file "${this.connectedFileName}": ${reason}`);
      }
      res = await postCallScript();
    }

    if (!res.ok) {
      throw new FileMakerError(String(res.status), `FM MCP executeScript failed (${res.status}): ${await res.text()}`);
    }

    const raw = await res.json();
    return {
      scriptResult: typeof raw.result === "string" ? raw.result : JSON.stringify(raw.result),
    } as ScriptResponse;
  };

  containerUpload = (): Promise<never> => {
    throw new Error("Container upload is not supported via FM MCP adapter");
  };
}
