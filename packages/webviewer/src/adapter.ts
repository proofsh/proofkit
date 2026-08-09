import type { clientTypes } from "@proofkit/fmdapi";
import { FileMakerError } from "@proofkit/fmdapi";
import type {
  Adapter,
  BaseRequest,
  ContainerUploadOptions,
  CreateOptions,
  DeleteOptions,
  FindOptions,
  GetOptions,
  LayoutMetadataOptions,
  ListOptions,
  UpdateOptions,
} from "@proofkit/fmdapi/dist/esm/adapters/core.js";
import { fmFetch } from "./main.js";

export type ExecuteScriptOptions = BaseRequest & {
  data: { script: string; scriptParam?: string };
};

type DataApiAction = "read" | "metaData" | "create" | "update" | "delete" | "duplicate";

export interface WebViewerAdapterBatchOptions {
  enabled?: boolean;
  windowMs?: number;
  maxSize?: number;
}

export interface WebViewerAdapterContainerOptions {
  /**
   * Name of the FileMaker script that writes container data.
   * @default "PK_container_upload"
   */
  scriptName?: string;
  /**
   * How long to wait for the container script before failing. An add-on that
   * predates the container script never calls back, so this is what turns a
   * hung promise into an actionable error. Set to 0 to wait indefinitely.
   * @default 60000
   */
  timeoutMs?: number;
  /**
   * Reject uploads larger than this before spending time encoding them.
   * Set to 0 to disable the check.
   * @default 20971520
   */
  maxFileBytes?: number;
}

export interface WebViewerAdapterOptions {
  scriptName: string;
  batch?: boolean | WebViewerAdapterBatchOptions;
  container?: WebViewerAdapterContainerOptions;
}

interface ResolvedBatchOptions {
  windowMs: number;
  maxSize: number;
}

interface DataApiScriptRequest extends Record<string, unknown> {
  action: DataApiAction;
  layouts: string;
  version: "vLatest";
}

interface QueuedBatchRequest {
  batchOptions: ResolvedBatchOptions;
  id: string;
  payload: DataApiScriptRequest;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

interface BatchScriptResponse extends Partial<clientTypes.RawFMResponse> {
  responses?: Array<clientTypes.RawFMResponse & { id?: string }>;
}

const DEFAULT_BATCH_WINDOW_MS = 8;
const DEFAULT_BATCH_MAX_SIZE = 20;
const BATCHING_DOCS_URL = "https://proofkit.dev/docs/webviewer/batching";
const LEGACY_BATCH_WARNING = `[ProofKit] ProofKit called the FileMaker script to execute Data API, but it did not support batching. Install the latest ProofKit add-on in your FileMaker file to get the updated script. Falling back to unbatched requests for this adapter. See ${BATCHING_DOCS_URL}`;

const DEFAULT_CONTAINER_SCRIPT_NAME = "PK_container_upload";
const DEFAULT_CONTAINER_TIMEOUT_MS = 60_000;
const DEFAULT_CONTAINER_MAX_FILE_BYTES = 20 * 1024 * 1024;
const BASE64_CHUNK_SIZE = 0x80_00;
const CONTAINERS_DOCS_URL = "https://proofkit.dev/docs/webviewer/containers";

function containerTimeoutMessage(scriptName: string, timeoutMs: number): string {
  return `[ProofKit] The FileMaker script "${scriptName}" did not respond within ${timeoutMs}ms. Install the latest ProofKit add-on in your FileMaker file to get the container upload script, or set the adapter's container.scriptName option if your script uses a different name. See ${CONTAINERS_DOCS_URL}`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  if (timeoutMs <= 0) {
    return await promise;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(index, index + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
}

/**
 * FileMaker's `Base64Decode` needs a file name with an extension, otherwise it
 * stores an untitled `.dat` that will not preview or export correctly.
 */
function getUploadFileName(file: Blob): string {
  const fileName = (file as File).name;
  if (typeof fileName === "string" && fileName.trim() !== "") {
    return fileName;
  }
  throw new Error(
    'Container upload requires a file name with an extension. Pass a `File` rather than a bare `Blob`, or wrap it: `new File([blob], "photo.png", { type: blob.type })`.',
  );
}

function resolveContainerRepetition(repetition: string | number | undefined): number {
  if (repetition === undefined) {
    return 1;
  }

  const value = typeof repetition === "string" ? Number(repetition) : repetition;
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`Container field repetition must be a positive number, received ${String(repetition)}`);
  }
  if (value > 1) {
    throw new Error(
      `Container field repetitions are not yet supported by the Web Viewer adapter (received repetition ${value}). Upload to repetition 1, or use a FileMaker script directly. See ${CONTAINERS_DOCS_URL}`,
    );
  }
  return 1;
}

function resolveContainerOptions(
  container: WebViewerAdapterContainerOptions | undefined,
): Required<WebViewerAdapterContainerOptions> {
  const scriptName = container?.scriptName?.trim();
  return {
    maxFileBytes: Math.max(0, container?.maxFileBytes ?? DEFAULT_CONTAINER_MAX_FILE_BYTES),
    scriptName: scriptName ? scriptName : DEFAULT_CONTAINER_SCRIPT_NAME,
    timeoutMs: Math.max(0, container?.timeoutMs ?? DEFAULT_CONTAINER_TIMEOUT_MS),
  };
}

function normalizeBatchMaxSize(maxSize: number | undefined): number {
  if (maxSize === undefined || !Number.isFinite(maxSize)) {
    return DEFAULT_BATCH_MAX_SIZE;
  }
  return Math.max(1, Math.trunc(maxSize));
}

function resolveBatchOptions(batch: WebViewerAdapterOptions["batch"]): ResolvedBatchOptions | undefined {
  if (batch === false) {
    return;
  }
  if (batch === undefined || batch === true) {
    return {
      maxSize: DEFAULT_BATCH_MAX_SIZE,
      windowMs: DEFAULT_BATCH_WINDOW_MS,
    };
  }
  if (batch.enabled === false) {
    return;
  }
  return {
    maxSize: normalizeBatchMaxSize(batch.maxSize),
    windowMs: Math.max(0, batch.windowMs ?? DEFAULT_BATCH_WINDOW_MS),
  };
}

function defaultBatchOptions(): ResolvedBatchOptions {
  return {
    maxSize: DEFAULT_BATCH_MAX_SIZE,
    windowMs: DEFAULT_BATCH_WINDOW_MS,
  };
}

function singleRequestBatchOptions(): ResolvedBatchOptions {
  return {
    maxSize: 1,
    windowMs: 0,
  };
}

function normalizeBody(body: object): Record<string, unknown> {
  const { _limit, _offset, _sort, ...normalizedBody } = body as Record<string, unknown>;
  if (_offset !== undefined) {
    normalizedBody.offset = _offset;
  }
  if (_limit !== undefined) {
    normalizedBody.limit = _limit;
  }
  if (_sort !== undefined) {
    normalizedBody.sort = _sort;
  }
  return normalizedBody;
}

function getPositiveInteger(value: unknown, fallback: number): number {
  const numericValue = typeof value === "string" ? Number(value) : value;
  if (typeof numericValue !== "number" || !Number.isFinite(numericValue) || numericValue < 1) {
    return fallback;
  }
  return Math.trunc(numericValue);
}

function getRangeValue(body: object, keys: string[], fallback: number): number {
  const bodyRecord = body as Record<string, unknown>;
  for (const key of keys) {
    if (bodyRecord[key] !== undefined) {
      return getPositiveInteger(bodyRecord[key], fallback);
    }
  }
  return fallback;
}

function createPagedBody(body: object, limit: number, offset: number): Record<string, unknown> {
  const pagedBody = Object.fromEntries(
    Object.entries(body as Record<string, unknown>).filter(([key]) => key !== "limit" && key !== "offset"),
  );
  pagedBody._limit = limit;
  if (offset > 1) {
    pagedBody._offset = offset;
  } else {
    pagedBody._offset = undefined;
  }
  return pagedBody;
}

function isLegacyBatchUnsupportedResponse(resp: BatchScriptResponse): boolean {
  return (
    resp.messages?.some((message) => {
      const normalizedMessage = String((message as { message?: unknown }).message ?? "").toLowerCase();
      return (
        message.code === "1708" && normalizedMessage.includes("unknown key") && normalizedMessage.includes("batch")
      );
    }) ?? false
  );
}

export class WebViewerAdapter implements Adapter {
  protected scriptName: string;
  private readonly containerOptions: Required<WebViewerAdapterContainerOptions>;
  private readonly batchOptions?: ResolvedBatchOptions;
  private batchDisabledByLegacyScript = false;
  private batchFlushInProgress = false;
  private batchRequestId = 0;
  private batchTimer?: ReturnType<typeof setTimeout>;
  private readonly batchQueue: QueuedBatchRequest[] = [];

  constructor(options: WebViewerAdapterOptions & { refreshToken?: boolean }) {
    this.scriptName = options.scriptName;
    this.batchOptions = resolveBatchOptions(options.batch);
    this.containerOptions = resolveContainerOptions(options.container);
  }

  protected request = (params: {
    batch?: boolean;
    body: object;
    action?: DataApiAction;
    layout: string;
  }): Promise<unknown> => {
    const payload = this.createScriptRequest(params);
    const batchOptions = this.getBatchOptionsForRequest(params.batch);

    if (batchOptions) {
      if (normalizeBatchMaxSize(batchOptions.maxSize) === 1) {
        return this.executeSingleBatchRequest(payload);
      }
      return this.enqueueBatchRequest(payload, batchOptions);
    }

    return this.executeSingleRequest(payload);
  };

  private getBatchOptionsForRequest(batch: boolean | undefined): ResolvedBatchOptions | undefined {
    if (this.batchDisabledByLegacyScript) {
      return;
    }
    if (batch === false) {
      return singleRequestBatchOptions();
    }
    if (batch === true) {
      return this.batchOptions ?? defaultBatchOptions();
    }
    return this.batchOptions ?? singleRequestBatchOptions();
  }

  private createScriptRequest(params: { layout: string; body: object; action?: DataApiAction }): DataApiScriptRequest {
    const { action = "read", layout, body } = params;
    return {
      ...normalizeBody(body),
      action,
      layouts: layout,
      version: "vLatest",
    };
  }

  private handleDataApiResponse(resp: clientTypes.RawFMResponse): unknown {
    if (resp.messages?.[0].code !== "0") {
      throw new FileMakerError(
        resp?.messages?.[0].code ?? "500",
        `Filemaker Data API failed with (${resp.messages?.[0].code}): ${JSON.stringify(resp, null, 2)}`,
      );
    }

    return resp.response;
  }

  private async executeSingleRequest(payload: DataApiScriptRequest): Promise<unknown> {
    const resp = await fmFetch<clientTypes.RawFMResponse>(this.scriptName, payload);
    return this.handleDataApiResponse(resp);
  }

  private executeSingleBatchRequest(payload: DataApiScriptRequest): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const request: QueuedBatchRequest = {
        batchOptions: singleRequestBatchOptions(),
        id: `batch-${this.batchRequestId}`,
        payload,
        resolve,
        reject,
      };
      this.batchRequestId++;

      this.executeBatchRequests([request]).catch((error: unknown) => {
        request.reject(error);
      });
    });
  }

  private enqueueBatchRequest(payload: DataApiScriptRequest, batchOptions: ResolvedBatchOptions): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        batchOptions,
        id: `batch-${this.batchRequestId}`,
        payload,
        resolve,
        reject,
      });
      this.batchRequestId++;

      if (this.batchQueue.length >= normalizeBatchMaxSize(batchOptions.maxSize)) {
        this.flushBatchQueue();
        return;
      }

      this.scheduleBatchFlush(batchOptions.windowMs);
    });
  }

  private scheduleBatchFlush(windowMs: number) {
    if (this.batchTimer) {
      return;
    }
    this.batchTimer = setTimeout(() => {
      this.flushBatchQueue();
    }, windowMs);
  }

  private flushBatchQueue() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    if (this.batchFlushInProgress) {
      return;
    }

    this.batchFlushInProgress = true;
    this.drainBatchQueue()
      .finally(() => {
        this.batchFlushInProgress = false;
        if (this.batchQueue.length > 0) {
          this.flushBatchQueue();
        }
      })
      .catch((error: unknown) => {
        this.rejectQueuedBatchRequests(error);
      });
  }

  private async drainBatchQueue() {
    while (this.batchQueue.length > 0) {
      const batchOptions = this.batchQueue[0]?.batchOptions ?? defaultBatchOptions();
      const requests = this.batchQueue.splice(0, normalizeBatchMaxSize(batchOptions.maxSize));
      if (this.batchDisabledByLegacyScript) {
        await this.executeUnbatchedRequests(requests);
        continue;
      }
      await this.executeBatchRequests(requests);
    }
  }

  private async executeBatchRequests(requests: QueuedBatchRequest[]) {
    try {
      const resp = await fmFetch<BatchScriptResponse>(this.scriptName, {
        batch: true,
        requests: requests.map((request) => ({
          id: request.id,
          ...request.payload,
        })),
      });

      if (isLegacyBatchUnsupportedResponse(resp)) {
        console.warn(LEGACY_BATCH_WARNING);
        this.batchDisabledByLegacyScript = true;
        await this.executeUnbatchedRequests(requests);
        return;
      }

      const responses = resp.responses;
      if (!Array.isArray(responses)) {
        throw new Error("FileMaker batch response must include a responses array");
      }

      const responsesById = new Map(responses.map((response) => [response.id, response]));

      for (const request of requests) {
        const response = responsesById.get(request.id);
        if (!response) {
          request.reject(new Error(`FileMaker batch response missing result for ${request.id}`));
          continue;
        }
        try {
          request.resolve(this.handleDataApiResponse(response));
        } catch (error) {
          request.reject(error);
        }
      }
    } catch (error) {
      for (const request of requests) {
        request.reject(error);
      }
    }
  }

  private async executeUnbatchedRequests(requests: QueuedBatchRequest[]) {
    await Promise.all(
      requests.map(async (request) => {
        try {
          request.resolve(await this.executeSingleRequest(request.payload));
        } catch (error) {
          request.reject(error);
        }
      }),
    );
  }

  private rejectQueuedBatchRequests(error: unknown) {
    const queuedRequests = this.batchQueue.splice(0);
    for (const request of queuedRequests) {
      request.reject(error);
    }
  }

  private async paginateAll(opts: ListOptions | FindOptions): Promise<clientTypes.GetResponse> {
    const { batch, data, layout } = opts;
    const limit = getRangeValue(data, ["_limit", "limit"], 100);
    const initialOffset = getRangeValue(data, ["_offset", "offset"], 1);
    const first = (await this.request({
      batch,
      body: createPagedBody(data, limit, initialOffset),
      layout,
    })) as clientTypes.GetResponse;
    const records = [...(first.data ?? [])];
    const foundCount = getPositiveInteger(first.dataInfo?.foundCount, records.length);
    const targetCount = Math.max(0, foundCount - (initialOffset - 1));
    let nextOffset = initialOffset + limit;

    if (records.length >= targetCount) {
      return {
        ...first,
        data: records,
        dataInfo: {
          ...first.dataInfo,
          returnedCount: records.length,
        },
      };
    }

    const pageBatchSize = this.getBatchOptionsForRequest(batch)?.maxSize ?? 1;

    while (records.length < targetCount) {
      const offsets: number[] = [];
      while (offsets.length < pageBatchSize && records.length + offsets.length * limit < targetCount) {
        offsets.push(nextOffset);
        nextOffset += limit;
      }

      if (offsets.length === 0) {
        break;
      }

      const pages = (await Promise.all(
        offsets.map((offset) =>
          this.request({
            batch,
            body: createPagedBody(data, limit, offset),
            layout,
          }),
        ),
      )) as clientTypes.GetResponse[];
      const receivedCount = pages.reduce((sum, page) => sum + (page.data?.length ?? 0), 0);
      for (const page of pages) {
        records.push(...(page.data ?? []));
      }
      if (receivedCount === 0) {
        break;
      }
    }

    return {
      ...first,
      data: records,
      dataInfo: {
        ...first.dataInfo,
        returnedCount: records.length,
      },
    };
  }

  list = async (opts: ListOptions): Promise<clientTypes.GetResponse> => {
    const { batch, data, layout } = opts;
    const resp = await this.request({
      batch,
      body: data,
      layout,
    });
    return resp as clientTypes.GetResponse;
  };

  listAll = (opts: ListOptions): Promise<clientTypes.GetResponse> => {
    return this.paginateAll(opts);
  };

  get = async (opts: GetOptions): Promise<clientTypes.GetResponse> => {
    const { batch, data, layout } = opts;
    const resp = await this.request({
      batch,
      body: data,
      layout,
    });
    return resp as clientTypes.GetResponse;
  };

  find = async (opts: FindOptions): Promise<clientTypes.GetResponse> => {
    const { batch, data, layout } = opts;
    const resp = await this.request({
      batch,
      body: data,
      layout,
    });
    return resp as clientTypes.GetResponse;
  };

  findAll = (opts: FindOptions): Promise<clientTypes.GetResponse> => {
    return this.paginateAll(opts);
  };

  create = async (opts: CreateOptions): Promise<clientTypes.CreateResponse> => {
    const { batch, data, layout } = opts;
    const resp = await this.request({
      action: "create",
      batch,
      body: data,
      layout,
    });
    return resp as clientTypes.CreateResponse;
  };

  update = async (opts: UpdateOptions): Promise<clientTypes.UpdateResponse> => {
    const { batch, data, layout } = opts;
    const resp = await this.request({
      action: "update",
      batch,
      layout,
      body: data,
    });
    return resp as clientTypes.UpdateResponse;
  };

  delete = async (opts: DeleteOptions): Promise<clientTypes.DeleteResponse> => {
    const { batch, data, layout } = opts;
    const resp = await this.request({
      action: "delete",
      batch,
      body: data,
      layout,
    });
    return resp as clientTypes.DeleteResponse;
  };

  layoutMetadata = async (opts: LayoutMetadataOptions): Promise<clientTypes.LayoutMetadataResponse> => {
    return (await this.request({
      action: "metaData",
      batch: opts.batch,
      layout: opts.layout,
      body: {},
    })) as clientTypes.LayoutMetadataResponse;
  };

  executeScript = (): Promise<never> => {
    throw new Error(
      "the `executeScript` method is not supported in the webviewer adapter. Use the `fmFetch` or `callFMScript` functions from @proofkit/webviewer instead.",
    );
  };

  /**
   * Uploads a file into a container field through the ProofKit add-on's
   * container script.
   *
   * The Data API uploads containers through a separate multipart endpoint that
   * the `Execute FileMaker Data API` script step does not expose, so this never
   * goes through the Data API script and never participates in batching. The
   * file is Base64-encoded and decoded back into the container by FileMaker.
   *
   * Requires FileMaker Pro 22.0 or later on the FileMaker side.
   */
  containerUpload = async (opts: ContainerUploadOptions): Promise<void> => {
    const { containerFieldName, file, modId, recordId, repetition } = opts.data;
    const { maxFileBytes, scriptName, timeoutMs } = this.containerOptions;

    const fileName = getUploadFileName(file);
    const resolvedRepetition = resolveContainerRepetition(repetition);

    if (maxFileBytes > 0 && file.size > maxFileBytes) {
      throw new Error(
        `Container upload is ${file.size} bytes, which exceeds the Web Viewer limit of ${maxFileBytes} bytes. Raise the adapter's container.maxFileBytes option, or move the file with a FileMaker script step instead. See ${CONTAINERS_DOCS_URL}`,
      );
    }

    const payload: Record<string, unknown> = {
      base64: await blobToBase64(file),
      containerFieldName: containerFieldName as string,
      fileName,
      layout: opts.layout,
      recordId,
      repetition: resolvedRepetition,
    };
    if (modId !== undefined) {
      payload.modId = modId;
    }

    const resp = await withTimeout(
      fmFetch<clientTypes.RawFMResponse>(scriptName, payload),
      timeoutMs,
      containerTimeoutMessage(scriptName, timeoutMs),
    );

    this.handleDataApiResponse(resp);
  };
}
