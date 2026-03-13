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

export interface FmHttpAdapterOptions {
  /** Base URL of the local FM HTTP server (e.g. "http://localhost:3000") */
  baseUrl: string;
  /** Name of the connected FileMaker file */
  connectedFileName: string;
  /** Name of the FM script that executes Data API calls. Defaults to "execute_data_api" */
  scriptName?: string;
}

export class FmHttpAdapter implements Adapter {
  protected baseUrl: string;
  protected connectedFileName: string;
  protected scriptName: string;

  constructor(options: FmHttpAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(TRAILING_SLASHES_REGEX, "");
    this.connectedFileName = options.connectedFileName;
    this.scriptName = options.scriptName ?? "execute_data_api";
  }

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

    const headers = new Headers(fetchOptions?.headers);
    headers.set("Content-Type", "application/json");

    const res = await fetch(`${this.baseUrl}/callScript`, {
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

    if (timeout) {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new FileMakerError(String(res.status), `FM HTTP request failed (${res.status}): ${await res.text()}`);
    }

    const raw = await res.json();
    // The /callScript response wraps the script result as a string or object
    let scriptResult: unknown;
    try {
      scriptResult = typeof raw.result === "string" ? JSON.parse(raw.result) : (raw.result ?? raw);
    } catch (err) {
      throw new FileMakerError(
        "500",
        `FM HTTP response parse failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const respData = scriptResult as RawFMResponse;

    if (respData.messages?.[0].code !== "0") {
      throw new FileMakerError(
        respData?.messages?.[0].code ?? "500",
        `Filemaker Data API failed with (${respData.messages?.[0].code}): ${JSON.stringify(respData, null, 2)}`,
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
    const res = await fetch(`${this.baseUrl}/callScript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectedFileName: this.connectedFileName,
        scriptName: opts.script,
        data: opts.scriptParam,
      }),
    });

    if (!res.ok) {
      throw new FileMakerError(String(res.status), `FM HTTP executeScript failed (${res.status}): ${await res.text()}`);
    }

    const raw = await res.json();
    return {
      scriptResult: typeof raw.result === "string" ? raw.result : JSON.stringify(raw.result),
    } as ScriptResponse;
  };

  containerUpload = (): Promise<never> => {
    throw new Error("Container upload is not supported via FM HTTP adapter");
  };
}
