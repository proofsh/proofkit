import type { clientTypes } from "@proofkit/fmdapi";
import { FileMakerError } from "@proofkit/fmdapi";
import type {
  Adapter,
  BaseRequest,
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

type DataApiAction = "read" | "readAll" | "metaData" | "create" | "update" | "delete" | "duplicate" | "findAll";

export interface WebViewerAdapterBatchOptions {
  enabled?: boolean;
  windowMs?: number;
  maxSize?: number;
}

export interface WebViewerAdapterOptions {
  scriptName: string;
  batch?: boolean | WebViewerAdapterBatchOptions;
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
  id: string;
  payload: DataApiScriptRequest;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

interface BatchScriptResponse {
  responses?: Array<clientTypes.RawFMResponse & { id?: string }>;
}

const DEFAULT_BATCH_WINDOW_MS = 8;
const DEFAULT_BATCH_MAX_SIZE = 20;

function normalizeBatchMaxSize(maxSize: number | undefined): number {
  if (maxSize === undefined || !Number.isFinite(maxSize)) {
    return DEFAULT_BATCH_MAX_SIZE;
  }
  return Math.max(1, Math.trunc(maxSize));
}

function resolveBatchOptions(batch: WebViewerAdapterOptions["batch"]): ResolvedBatchOptions | undefined {
  if (!batch) {
    return;
  }
  if (batch === true) {
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

export class WebViewerAdapter implements Adapter {
  protected scriptName: string;
  private readonly batchOptions?: ResolvedBatchOptions;
  private batchFlushInProgress = false;
  private batchRequestId = 0;
  private batchTimer?: ReturnType<typeof setTimeout>;
  private readonly batchQueue: QueuedBatchRequest[] = [];

  constructor(options: WebViewerAdapterOptions & { refreshToken?: boolean }) {
    this.scriptName = options.scriptName;
    this.batchOptions = resolveBatchOptions(options.batch);
  }

  protected request = (params: { layout: string; body: object; action?: DataApiAction }): Promise<unknown> => {
    const payload = this.createScriptRequest(params);

    if (this.batchOptions) {
      return this.enqueueBatchRequest(payload);
    }

    return this.executeSingleRequest(payload);
  };

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

  private enqueueBatchRequest(payload: DataApiScriptRequest): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        id: `batch-${this.batchRequestId}`,
        payload,
        resolve,
        reject,
      });
      this.batchRequestId++;

      if (this.batchQueue.length >= normalizeBatchMaxSize(this.batchOptions?.maxSize)) {
        this.flushBatchQueue();
        return;
      }

      this.scheduleBatchFlush(this.batchOptions?.windowMs ?? DEFAULT_BATCH_WINDOW_MS);
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
    const batchOptions = this.batchOptions;
    if (!batchOptions) {
      return;
    }

    while (this.batchQueue.length > 0) {
      const requests = this.batchQueue.splice(0, normalizeBatchMaxSize(batchOptions.maxSize));
      await this.executeBatchRequests(requests);
    }
  }

  private async executeBatchRequests(requests: QueuedBatchRequest[]) {
    try {
      const resp = await fmFetch<BatchScriptResponse>(this.scriptName, {
        proofkitBatch: 1,
        requests: requests.map((request) => ({
          id: request.id,
          ...request.payload,
        })),
      });

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

  private rejectQueuedBatchRequests(error: unknown) {
    const queuedRequests = this.batchQueue.splice(0);
    for (const request of queuedRequests) {
      request.reject(error);
    }
  }

  list = async (opts: ListOptions): Promise<clientTypes.GetResponse> => {
    const { data, layout } = opts;
    const resp = await this.request({
      body: data,
      layout,
    });
    return resp as clientTypes.GetResponse;
  };

  listAll = async (opts: ListOptions): Promise<clientTypes.GetResponse> => {
    const { data, layout } = opts;
    const resp = await this.request({
      action: "readAll",
      body: data,
      layout,
    });
    return resp as clientTypes.GetResponse;
  };

  get = async (opts: GetOptions): Promise<clientTypes.GetResponse> => {
    const { data, layout } = opts;
    const resp = await this.request({
      body: data,
      layout,
    });
    return resp as clientTypes.GetResponse;
  };

  find = async (opts: FindOptions): Promise<clientTypes.GetResponse> => {
    const { data, layout } = opts;
    const resp = await this.request({
      body: data,
      layout,
    });
    return resp as clientTypes.GetResponse;
  };

  findAll = async (opts: FindOptions): Promise<clientTypes.GetResponse> => {
    const { data, layout } = opts;
    const resp = await this.request({
      action: "findAll",
      body: data,
      layout,
    });
    return resp as clientTypes.GetResponse;
  };

  create = async (opts: CreateOptions): Promise<clientTypes.CreateResponse> => {
    const { data, layout } = opts;
    const resp = await this.request({
      action: "create",
      body: data,
      layout,
    });
    return resp as clientTypes.CreateResponse;
  };

  update = async (opts: UpdateOptions): Promise<clientTypes.UpdateResponse> => {
    const { data, layout } = opts;
    const resp = await this.request({
      action: "update",
      layout,
      body: data,
    });
    return resp as clientTypes.UpdateResponse;
  };

  delete = async (opts: DeleteOptions): Promise<clientTypes.DeleteResponse> => {
    const { data, layout } = opts;
    const resp = await this.request({
      action: "delete",
      body: data,
      layout,
    });
    return resp as clientTypes.DeleteResponse;
  };

  layoutMetadata = async (opts: LayoutMetadataOptions): Promise<clientTypes.LayoutMetadataResponse> => {
    return (await this.request({
      action: "metaData",
      layout: opts.layout,
      body: {},
    })) as clientTypes.LayoutMetadataResponse;
  };

  executeScript = (): Promise<never> => {
    throw new Error(
      "the `executeScript` method is not supported in the webviewer adapter. Use the `fmFetch` or `callFMScript` functions from @proofkit/webviewer instead.",
    );
  };

  containerUpload = (): Promise<never> => {
    throw new Error("Container upload is not supported in webviewer");
  };
}
