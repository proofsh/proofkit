import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Adapter, ExecuteScriptOptions, FindOptions, ListOptions } from "./adapters/core.js";
import type {
  CreateParams,
  CreateResponse,
  DeleteParams,
  DeleteResponse,
  FieldData,
  FMRecord,
  GenericPortalData,
  GetParams,
  GetResponse,
  GetResponseOne,
  ListParams,
  PortalsWithIds,
  Query,
  UpdateParams,
  UpdateResponse,
} from "./client-types.js";
import { FileMakerError } from "./index.js";

function asNumber(input: string | number): number {
  return typeof input === "string" ? Number.parseInt(input, 10) : input;
}

export interface ClientObjectProps {
  /**
   * The layout to use by default for all requests. Can be overrridden on each request.
   */
  layout: string;
  schema?: {
    /**
     * The schema for the field data.
     */
    fieldData: StandardSchemaV1<FieldData>;
    /**
     * The schema for the portal data.
     */
    portalData?: Record<string, StandardSchemaV1<FieldData>>;
  };
}

interface FetchOptions {
  batch?: boolean;
  fetch?: RequestInit;
}

export interface IgnoreEmptyResult {
  /**
   * If true, a find that returns no results will retun an empty array instead of throwing an error.
   * @default false
   */
  ignoreEmptyResult?: boolean;
}

export interface ContainerUploadArgs<T extends FieldData = FieldData> {
  containerFieldName: keyof T;
  containerFieldRepetition?: string | number;
  file: Blob;
  recordId: number | string;
  modId?: number;
  timeout?: number;
}

function DataApi<
  Fd extends FieldData = FieldData,
  Pd extends GenericPortalData = GenericPortalData,
  Opts extends ClientObjectProps = ClientObjectProps,
  Adp extends Adapter = Adapter,
>(options: Opts & { adapter: Adp }) {
  type InferredFieldData = Opts["schema"] extends object
    ? StandardSchemaV1.InferOutput<Opts["schema"]["fieldData"]>
    : Fd;
  type InferredPortalData = Opts["schema"] extends object
    ? Opts["schema"]["portalData"] extends object
      ? {
          [K in keyof Opts["schema"]["portalData"]]: StandardSchemaV1.InferOutput<Opts["schema"]["portalData"][K]>;
        }
      : Pd
    : Pd;

  if ("zodValidators" in options) {
    throw new Error("zodValidators is no longer supported. Use schema instead, or re-run the typegen command");
  }

  const schema = options.schema;
  const layout = options.layout;
  const {
    create,
    delete: _adapterDelete,
    find,
    findAll: adapterFindAll,
    get,
    list,
    listAll: adapterListAll,
    update,
    layoutMetadata,
    containerUpload,
    executeScript,
    ...otherMethods
  } = options.adapter;

  type CreateArgs<
    T extends InferredFieldData = InferredFieldData,
    U extends InferredPortalData = InferredPortalData,
  > = CreateParams<U> & {
    fieldData: Partial<T>;
  };
  type GetArgs<U extends InferredPortalData = InferredPortalData> = GetParams<U> & {
    recordId: number | string;
  };
  type UpdateArgs<
    T extends InferredFieldData = InferredFieldData,
    U extends InferredPortalData = InferredPortalData,
  > = UpdateParams<U> & {
    fieldData: Partial<T>;
    recordId: number | string;
  };
  type DeleteArgs = DeleteParams & {
    recordId: number | string;
  };
  type FindArgs<
    T extends FieldData = InferredFieldData,
    U extends InferredPortalData = InferredPortalData,
  > = ListParams<T, U> & {
    query: Query<T> | Query<T>[];
    timeout?: number;
  };

  type ExecuteScriptArgs = Omit<ExecuteScriptOptions, "layout">;

  type ListArgs = ListParams<InferredFieldData, InferredPortalData> & FetchOptions;
  type FindMethodArgs = FindArgs<InferredFieldData, InferredPortalData> & IgnoreEmptyResult & FetchOptions;

  function normalizeListRequest(args?: ListArgs): {
    batch?: boolean;
    fetch?: RequestInit;
    params: ListOptions["data"];
    timeout?: number;
  } {
    const { batch, fetch, timeout, ...params } = args ?? {};

    if ("limit" in params && params.limit !== undefined) {
      Object.assign(params, { _limit: params.limit }).limit = undefined;
    }
    if ("offset" in params && params.offset !== undefined) {
      if (params.offset <= 1) {
        params.offset = undefined;
      } else {
        Object.assign(params, { _offset: params.offset }).offset = undefined;
      }
    }
    if ("sort" in params && params.sort !== undefined) {
      Object.assign(params, {
        _sort: Array.isArray(params.sort) ? params.sort : [params.sort],
      }).sort = undefined;
    }

    return {
      batch,
      fetch,
      params: params as ListOptions["data"],
      timeout,
    };
  }

  function normalizeFindRequest(args: FindMethodArgs): {
    batch?: boolean;
    fetch?: RequestInit;
    ignoreEmptyResult: boolean;
    params: FindOptions["data"];
    timeout?: number;
  } {
    const { batch, query: queryInput, ignoreEmptyResult = false, timeout, fetch, ...params } = args;
    const query = Array.isArray(queryInput) ? queryInput : [queryInput];

    if ("offset" in params && params.offset !== undefined && params.offset <= 1) {
      params.offset = undefined;
    }
    if ("sort" in params && params.sort !== undefined && !Array.isArray(params.sort)) {
      params.sort = [params.sort];
    }
    if ("dateformats" in params && params.dateformats !== undefined) {
      let dateFormatValue: number;
      if (params.dateformats === "US") {
        dateFormatValue = 0;
      } else if (params.dateformats === "file_locale") {
        dateFormatValue = 1;
      } else if (params.dateformats === "ISO8601") {
        dateFormatValue = 2;
      } else {
        dateFormatValue = 0;
      }
      // @ts-expect-error FM wants a string, so this is fine
      params.dateformats = dateFormatValue.toString();
    }

    return {
      batch,
      fetch,
      ignoreEmptyResult,
      params: { ...params, query } as FindOptions["data"],
      timeout,
    };
  }

  /**
   * List all records from a given layout, no find criteria applied.
   */
  async function _list(
    args?: ListParams<InferredFieldData, InferredPortalData> & FetchOptions,
  ): Promise<GetResponse<InferredFieldData, InferredPortalData>>;
  async function _list(
    args?: ListParams<InferredFieldData, InferredPortalData> & FetchOptions,
  ): Promise<GetResponse<InferredFieldData, InferredPortalData>> {
    const { batch, fetch, params, timeout } = normalizeListRequest(args);

    const result = await list({
      batch,
      layout,
      data: params,
      fetch,
      timeout,
    });

    if (
      result.dataInfo.foundCount > result.dataInfo.returnedCount &&
      args?.limit === undefined &&
      args?.offset === undefined
    ) {
      // more records found than returned and the user didn't specify a limit or offset, so we should warn them
      console.warn(
        `🚨 @proofkit/fmdapi: Loaded only ${result.dataInfo.returnedCount} of the ${result.dataInfo.foundCount} records from your "${layout}" layout. Use the "listAll" method to automatically paginate through all records, or specify a "limit" and "offset" to handle pagination yourself.`,
      );
    }

    return await runSchemaValidationAndTransform(schema, result as GetResponse<InferredFieldData, InferredPortalData>);
  }

  /**
   * Paginate through all records from a given layout, no find criteria applied.
   * ⚠️ WARNING: Use this method with caution, as it can be slow with large datasets
   */
  async function listAll(
    args?: ListParams<InferredFieldData, InferredPortalData> & FetchOptions,
  ): Promise<FMRecord<InferredFieldData, InferredPortalData>[]>;
  async function listAll(
    args?: ListParams<InferredFieldData, InferredPortalData> & FetchOptions,
  ): Promise<FMRecord<InferredFieldData, InferredPortalData>[]> {
    let runningData: GetResponse<InferredFieldData, InferredPortalData>["data"] = [];
    const limit = args?.limit ?? 100;
    let offset = args?.offset ?? 1;

    if (adapterListAll) {
      const { batch, fetch, params, timeout } = normalizeListRequest({
        ...args,
        limit,
        offset,
      });
      const result = (await adapterListAll({
        batch,
        data: params,
        fetch,
        layout,
        timeout,
      })) as GetResponse<InferredFieldData, InferredPortalData>;
      return (await runSchemaValidationAndTransform(schema, result)).data;
    }

    while (true) {
      const data = await _list({
        ...args,
        offset,
      });
      runningData = [...runningData, ...data.data];
      if (runningData.length >= data.dataInfo.foundCount) {
        break;
      }
      offset += limit;
    }
    return runningData;
  }

  /**
   * Create a new record in a given layout
   */
  async function _create<
    T extends InferredFieldData = InferredFieldData,
    U extends InferredPortalData = InferredPortalData,
  >(args: CreateArgs<T, U> & FetchOptions): Promise<CreateResponse> {
    const { batch, fetch, timeout, ...params } = args ?? {};
    return await create({
      batch,
      layout,
      data: params,
      fetch,
      timeout,
    });
  }

  /**
   * Get a single record by Internal RecordId
   */
  async function _get(
    args: GetArgs<InferredPortalData> & FetchOptions,
  ): Promise<GetResponse<InferredFieldData, InferredPortalData>> {
    args.recordId = asNumber(args.recordId);
    const { batch, recordId, fetch, timeout, ...params } = args;

    const result = await get({
      batch,
      layout,
      data: { ...params, recordId },
      fetch,
      timeout,
    });
    return await runSchemaValidationAndTransform(schema, result as GetResponse<InferredFieldData, InferredPortalData>);
  }

  /**
   * Update a single record by internal RecordId
   */
  async function _update(
    args: UpdateArgs<InferredFieldData, InferredPortalData> & FetchOptions,
  ): Promise<UpdateResponse> {
    args.recordId = asNumber(args.recordId);
    const { batch, recordId, fetch, timeout, ...params } = args;
    return await update({
      batch,
      layout,
      data: { ...params, recordId },
      fetch,
      timeout,
    });
  }

  /**
   * Delete a single record by internal RecordId
   */
  function deleteRecord(args: DeleteArgs & FetchOptions): Promise<DeleteResponse> {
    args.recordId = asNumber(args.recordId);
    const { batch, recordId, fetch, timeout, ...params } = args;

    return _adapterDelete({
      batch,
      layout,
      data: { ...params, recordId },
      fetch,
      timeout,
    });
  }

  /**
   * Find records in a given layout
   */
  async function _find(
    args: FindArgs<InferredFieldData, InferredPortalData> & IgnoreEmptyResult & FetchOptions,
  ): Promise<GetResponse<InferredFieldData, InferredPortalData>> {
    const { batch, fetch, ignoreEmptyResult, params, timeout } = normalizeFindRequest(args);
    const result = (await find({
      batch,
      data: params,
      layout,
      fetch,
      timeout,
    }).catch((e: unknown) => {
      if (ignoreEmptyResult && e instanceof FileMakerError && e.code === "401") {
        return { data: [], dataInfo: { foundCount: 0, returnedCount: 0 } };
      }
      throw e;
    })) as GetResponse<InferredFieldData, InferredPortalData>;

    if (
      result.dataInfo.foundCount > result.dataInfo.returnedCount &&
      args?.limit === undefined &&
      args?.offset === undefined
    ) {
      // more records found than returned and the user didn't specify a limit or offset
      console.warn(
        `🚨 @proofkit/fmdapi: Loaded only ${result.dataInfo.returnedCount} of the ${result.dataInfo.foundCount} records from your "${layout}" layout. Use the "findAll" method to automatically paginate through all records, or specify a "limit" and "offset" to handle pagination yourself.`,
      );
    }

    return await runSchemaValidationAndTransform(schema, result);
  }

  /**
   * Helper method for `find`. Will only return the first result or throw error if there is more than 1 result.
   */
  async function findOne(
    args: FindArgs<InferredFieldData, InferredPortalData> & FetchOptions,
  ): Promise<GetResponseOne<InferredFieldData, InferredPortalData>> {
    const result = await _find(args);
    if (result.data.length !== 1) {
      throw new Error(`${result.data.length} records found; expecting exactly 1`);
    }
    const transformedResult = await runSchemaValidationAndTransform(schema, result);
    if (!transformedResult.data[0]) {
      throw new Error("No data found");
    }
    return { ...transformedResult, data: transformedResult.data[0] };
  }

  /**
   * Helper method for `find`. Will only return the first result instead of an array.
   */
  async function findFirst(
    args: FindArgs<InferredFieldData, InferredPortalData> & IgnoreEmptyResult & FetchOptions,
  ): Promise<GetResponseOne<InferredFieldData, InferredPortalData>> {
    const result = await _find(args);
    const transformedResult = await runSchemaValidationAndTransform(schema, result);

    if (!transformedResult.data[0]) {
      throw new Error("No data found");
    }
    return { ...transformedResult, data: transformedResult.data[0] };
  }

  /**
   * Helper method for `find`. Will return the first result or null if no results are found.
   */
  async function maybeFindFirst(
    args: FindArgs<InferredFieldData, InferredPortalData> & IgnoreEmptyResult & FetchOptions,
  ): Promise<GetResponseOne<InferredFieldData, InferredPortalData> | null> {
    const result = await _find({ ...args, ignoreEmptyResult: true });
    const transformedResult = await runSchemaValidationAndTransform(schema, result);
    if (!transformedResult.data[0]) {
      return null;
    }
    return { ...transformedResult, data: transformedResult.data[0] };
  }

  /**
   * Helper method for `find` to page through all found results.
   * ⚠️ WARNING: Use with caution as this can be a slow operation with large datasets
   */
  async function findAll(
    args: FindArgs<InferredFieldData, InferredPortalData> & FetchOptions,
  ): Promise<FMRecord<InferredFieldData, InferredPortalData>[]> {
    let runningData: GetResponse<InferredFieldData, InferredPortalData>["data"] = [];
    const limit = args.limit ?? 100;
    let offset = args.offset ?? 1;

    if (adapterFindAll) {
      const { batch, fetch, params, timeout } = normalizeFindRequest({
        ...args,
        ignoreEmptyResult: true,
        limit,
        offset,
      });
      const result = (await adapterFindAll({
        batch,
        data: params,
        fetch,
        layout,
        timeout,
      }).catch((e: unknown) => {
        if (e instanceof FileMakerError && e.code === "401") {
          return { data: [], dataInfo: { foundCount: 0, returnedCount: 0 } };
        }
        throw e;
      })) as GetResponse<InferredFieldData, InferredPortalData>;
      return (await runSchemaValidationAndTransform(schema, result)).data;
    }

    while (true) {
      const data = await _find({
        ...args,
        offset,
        ignoreEmptyResult: true,
      });
      runningData = [...runningData, ...data.data];
      if (runningData.length === 0 || runningData.length >= data.dataInfo.foundCount) {
        break;
      }
      offset += limit;
    }
    return runningData;
  }

  async function _layoutMetadata(args?: { timeout?: number } & FetchOptions) {
    const { ...restArgs } = args ?? {};
    // Explicitly define the type for params based on FetchOptions
    const params: FetchOptions & { timeout?: number } = restArgs;

    return await layoutMetadata({
      batch: params.batch,
      layout,
      fetch: params.fetch, // Now should correctly resolve to undefined if not present
      timeout: params.timeout, // Now should correctly resolve to undefined if not present
    });
  }

  async function _containerUpload(args: ContainerUploadArgs<InferredFieldData> & FetchOptions) {
    const { fetch, timeout, ...params } = args;
    return await containerUpload({
      layout,
      data: {
        ...params,
        containerFieldName: params.containerFieldName as string,
        repetition: params.containerFieldRepetition,
      },
      fetch,
      timeout,
    });
  }

  async function runSchemaValidationAndTransform(
    schema: ClientObjectProps["schema"],
    result: GetResponse<InferredFieldData, InferredPortalData>,
  ): Promise<GetResponse<InferredFieldData, InferredPortalData>> {
    const fieldDataIssues: StandardSchemaV1.Issue[] = [];
    const portalDataIssues: StandardSchemaV1.Issue[] = [];

    if (!schema) {
      return result;
    }
    const transformedData: FMRecord<InferredFieldData, InferredPortalData>[] = [];
    for (const record of result.data) {
      let fieldResult = schema.fieldData["~standard"].validate(record.fieldData);
      if (fieldResult instanceof Promise) {
        fieldResult = await fieldResult;
      }
      if ("value" in fieldResult) {
        record.fieldData = fieldResult.value as InferredFieldData;
      } else {
        fieldDataIssues.push(...fieldResult.issues);
      }

      if (schema.portalData) {
        for (const [portalName, portalRecords] of Object.entries(record.portalData)) {
          const validatedPortalRecords: PortalsWithIds<GenericPortalData>[] = [];
          for (const portalRecord of portalRecords) {
            let portalResult = schema.portalData[portalName]?.["~standard"].validate(portalRecord);
            if (portalResult instanceof Promise) {
              portalResult = await portalResult;
            }
            if (portalResult && "value" in portalResult) {
              validatedPortalRecords.push({
                ...portalResult.value,
                recordId: portalRecord.recordId,
                modId: portalRecord.modId,
              });
            } else {
              portalDataIssues.push(...(portalResult?.issues ?? []));
            }
          }
          // @ts-expect-error We know portalName is a valid key, but can't figure out the right assertions
          record.portalData[portalName] = validatedPortalRecords;
        }
      }

      transformedData.push(record);
    }
    result.data = transformedData;

    if (fieldDataIssues.length > 0 || portalDataIssues.length > 0) {
      console.error(
        `🚨 @proofkit/fmdapi: Validation issues for layout "${layout}". Run the typegen command again to generate the latest field definitions from your layout.`,
        {
          fieldDataIssues,
          portalDataIssues,
        },
      );
      throw new Error("Schema validation issues");
    }

    return result;
  }

  async function _executeScript(args: ExecuteScriptArgs & FetchOptions) {
    return await executeScript({
      ...args,
      layout,
    });
  }

  return {
    ...otherMethods,
    layout: options.layout as Opts["layout"],
    list: _list,
    listAll,
    create: _create,
    get: _get,
    update: _update,
    delete: deleteRecord,
    find: _find,
    findOne,
    findFirst,
    maybeFindFirst,
    findAll,
    layoutMetadata: _layoutMetadata,
    containerUpload: _containerUpload,
    executeScript: _executeScript,
  };
}

export default DataApi;
export { DataApi };
