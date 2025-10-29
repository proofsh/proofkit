import { z } from "zod/v4";
import createClient, { FFetchOptions } from "@fetchkit/ffetch";
import buildQuery, { QueryOptions } from "odata-query";

type Auth = { username: string; password: string } | { apiKey: string };

interface ExecutableBuilder<T> {
  execute(): Promise<T>;
  getRequestConfig(): { method: string; url: string; body?: any };
}

export interface ExecutionContext {
  _makeRequest(url: string, options?: RequestInit): Promise<any>;
}

export class TableDefinition<Schema extends z.ZodObject = any> {
  public readonly name: string;
  public readonly schema?: Schema;

  constructor(config: { name: string; schema?: Schema }) {
    this.name = config.name;
    this.schema = config.schema;
  }
}

export class FileMakerOData {
  private fetchClient: ReturnType<typeof createClient>;
  private serverUrl: string;
  private auth: Auth;
  constructor(config: {
    serverUrl: string;
    auth: Auth;
    fetchClientOptions?: FFetchOptions;
  }) {
    this.fetchClient = createClient({
      retries: 0,
      ...config.fetchClientOptions,
    });
    // Ensure the URL uses https://, is valid, and has no trailing slash
    const url = new URL(config.serverUrl);
    if (url.protocol !== "https:") {
      url.protocol = "https:";
    }
    // Remove any trailing slash from pathname
    url.pathname = url.pathname.replace(/\/+$/, "");
    this.serverUrl = url.toString().replace(/\/+$/, "");
    this.auth = config.auth;
  }

  /**
   * @internal
   */
  async _makeRequest(url: string, options?: RequestInit): Promise<any> {
    const baseUrl = `${this.serverUrl}${"apiKey" in this.auth ? `/otto` : ""}/fmi/odata/v4`;

    const headers = {
      Authorization:
        "apiKey" in this.auth
          ? `Bearer ${this.auth.apiKey}`
          : `Basic ${btoa(`${this.auth.username}:${this.auth.password}`)}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options?.headers || {}),
    };

    const resp = await this.fetchClient(baseUrl + url, {
      headers,
    });

    if (!resp.ok) {
      throw new Error(
        `Failed to make request to ${baseUrl + url}: ${resp.statusText}`,
      );
    }

    if (resp.headers.get("content-type")?.includes("application/json")) {
      let data = await resp.json();
      if (data.error) {
        throw new Error(data.error);
      }
      return data;
    }
    return await resp.text();
  }

  database(name: string) {
    return new Database(name, this);
  }
}

class Database {
  constructor(
    private readonly name: string,
    private readonly context: ExecutionContext,
  ) {}

  table<Schema extends z.ZodObject>(name: string, config?: { schema: Schema }) {
    const definition = new TableDefinition({ name, schema: config?.schema });
    return new Table<Schema>({
      definition,
      databaseName: this.name,
      context: this.context,
    });
  }

  // Example method showing how to use the request method
  async getMetadata() {
    return this.context._makeRequest(`/${this.name}/$metadata`);
  }

  // Future batch operation support
  // batch(builders: ExecutableBuilder<any>[]): BatchBuilder {
  //   return new BatchBuilder(builders, this.context, this.name);
  // }
}

type WithSystemFields<T> = T & { ROWID: number; ROWMODID: number };

class RecordBuilder<T> implements ExecutableBuilder<T> {
  private definition: TableDefinition;
  private databaseName: string;
  private context: ExecutionContext;
  private recordId: string | number;
  private operation?: "getSingleField" | "navigate";
  private operationParam?: string;

  constructor(config: {
    definition: TableDefinition;
    databaseName: string;
    context: ExecutionContext;
    recordId: string | number;
  }) {
    this.definition = config.definition;
    this.databaseName = config.databaseName;
    this.context = config.context;
    this.recordId = config.recordId;
  }

  getSingleField<K extends keyof T>(field: K): RecordBuilder<T[K]> {
    const newBuilder = new RecordBuilder<T[K]>({
      definition: this.definition,
      databaseName: this.databaseName,
      context: this.context,
      recordId: this.recordId,
    });
    newBuilder.operation = "getSingleField";
    newBuilder.operationParam = field.toString();
    return newBuilder;
  }

  navigate(relationName: string): QueryBuilder<any> {
    const builder = new QueryBuilder<any>({
      definition: this.definition,
      databaseName: this.databaseName,
      context: this.context,
    });
    // Store the navigation info - we'll use it in execute
    (builder as any).isNavigate = true;
    (builder as any).navigateRecordId = this.recordId;
    (builder as any).navigateRelation = relationName;
    return builder;
  }

  async execute(): Promise<T> {
    let url = `/${this.databaseName}/${this.definition.name}('${this.recordId}')`;

    if (this.operation === "getSingleField" && this.operationParam) {
      url += `/${this.operationParam}`;
    }

    const result = await this.context._makeRequest(url);

    if (this.operation === "getSingleField") {
      return result.value as T;
    }

    return result as T;
  }

  getRequestConfig(): { method: string; url: string; body?: any } {
    let url = `/${this.databaseName}/${this.definition.name}('${this.recordId}')`;

    if (this.operation === "getSingleField" && this.operationParam) {
      url += `/${this.operationParam}`;
    }

    return {
      method: "GET",
      url,
    };
  }
}

class QueryBuilder<
  T extends Record<string, any>,
  Selected extends keyof T = keyof T,
  IsSingle extends boolean = false,
  IsCount extends boolean = false,
> implements
    ExecutableBuilder<
      IsCount extends true
        ? number
        : IsSingle extends true
          ? Pick<T, Selected> | null
          : { value: Pick<T, Selected>[] }
    >
{
  private queryOptions: Partial<QueryOptions<WithSystemFields<T>>> = {};
  private isSingleMode = false as IsSingle;
  private isCountMode = false as IsCount;
  private definition: TableDefinition;
  private databaseName: string;
  private context: ExecutionContext;
  private isNavigate?: boolean;
  private navigateRecordId?: string | number;
  private navigateRelation?: string;
  constructor(config: {
    definition: TableDefinition;
    databaseName: string;
    context: ExecutionContext;
  }) {
    this.definition = config.definition;
    this.databaseName = config.databaseName;
    this.context = config.context;
  }

  select<K extends keyof WithSystemFields<T>>(
    ...fields: K[]
  ): QueryBuilder<T, K, IsSingle, IsCount> {
    const newBuilder = new QueryBuilder<T, K, IsSingle, IsCount>({
      definition: this.definition,
      databaseName: this.databaseName,
      context: this.context,
    });
    newBuilder.queryOptions = {
      ...this.queryOptions,
      select: fields as string[],
    };
    newBuilder.isSingleMode = this.isSingleMode;
    newBuilder.isCountMode = this.isCountMode;
    return newBuilder;
  }

  filter(
    filter: QueryOptions<T>["filter"],
  ): QueryBuilder<T, Selected, IsSingle, IsCount> {
    this.queryOptions.filter = filter;
    return this;
  }

  orderBy(
    orderBy: QueryOptions<T>["orderBy"],
  ): QueryBuilder<T, Selected, IsSingle, IsCount> {
    this.queryOptions.orderBy = orderBy;
    return this;
  }

  top(count: number): QueryBuilder<T, Selected, IsSingle, IsCount> {
    this.queryOptions.top = count;
    return this;
  }

  skip(count: number): QueryBuilder<T, Selected, IsSingle, IsCount> {
    this.queryOptions.skip = count;
    return this;
  }

  expand(
    expand: QueryOptions<T>["expand"],
  ): QueryBuilder<T, Selected, IsSingle, IsCount> {
    this.queryOptions.expand = expand;
    return this;
  }

  single(): QueryBuilder<T, Selected, true, IsCount> {
    const newBuilder = new QueryBuilder<T, Selected, true, IsCount>({
      definition: this.definition,
      databaseName: this.databaseName,
      context: this.context,
    });
    newBuilder.queryOptions = { ...this.queryOptions };
    newBuilder.isSingleMode = true;
    newBuilder.isCountMode = this.isCountMode;
    return newBuilder;
  }

  count(): QueryBuilder<T, Selected, IsSingle, true> {
    const newBuilder = new QueryBuilder<T, Selected, IsSingle, true>({
      definition: this.definition,
      databaseName: this.databaseName,
      context: this.context,
    });
    newBuilder.queryOptions = { ...this.queryOptions, count: true };
    newBuilder.isSingleMode = this.isSingleMode;
    newBuilder.isCountMode = true as true;
    return newBuilder;
  }

  async execute(): Promise<
    IsCount extends true
      ? number
      : IsSingle extends true
        ? Pick<T, Selected> | null
        : { value: Pick<T, Selected>[] }
  > {
    const queryString = buildQuery(this.queryOptions);

    // Handle navigation from RecordBuilder
    if (this.isNavigate && this.navigateRecordId && this.navigateRelation) {
      const result = await this.context._makeRequest(
        `/${this.databaseName}/${this.definition.name}('${this.navigateRecordId}')/${this.navigateRelation}${queryString}`,
      );
      return result as any;
    }

    // Handle $count endpoint
    if (this.isCountMode) {
      const result = await this.context._makeRequest(
        `/${this.databaseName}/${this.definition.name}/$count${queryString}`,
      );
      return result as any;
    }

    const result = await this.context._makeRequest(
      `/${this.databaseName}/${this.definition.name}${queryString}`,
    );

    if (this.isSingleMode) {
      return (result.value?.[0] ?? null) as any;
    }

    return result as any;
  }

  getQueryString(): string {
    return buildQuery(this.queryOptions);
  }

  getRequestConfig(): { method: string; url: string; body?: any } {
    const queryString = buildQuery(this.queryOptions);

    let url: string;

    // Handle navigation from RecordBuilder
    if (this.isNavigate && this.navigateRecordId && this.navigateRelation) {
      url = `/${this.databaseName}/${this.definition.name}('${this.navigateRecordId}')/${this.navigateRelation}${queryString}`;
    } else if (this.isCountMode) {
      url = `/${this.databaseName}/${this.definition.name}/$count${queryString}`;
    } else {
      url = `/${this.databaseName}/${this.definition.name}${queryString}`;
    }

    return {
      method: "GET",
      url,
    };
  }
}

export class Table<Schema extends z.ZodObject, T = z.infer<Schema>> {
  private definition: TableDefinition<Schema>;
  private databaseName: string;
  private context: ExecutionContext;

  constructor(config: {
    definition: TableDefinition<Schema>;
    databaseName: string;
    context: ExecutionContext;
  }) {
    this.definition = config.definition;
    this.databaseName = config.databaseName;
    this.context = config.context;
  }

  select<K extends keyof WithSystemFields<T>>(
    ...fields: K[]
  ): QueryBuilder<T & Record<string, any>, K> {
    return new QueryBuilder<T & Record<string, any>, K>({
      definition: this.definition,
      databaseName: this.databaseName,
      context: this.context,
    }).select(...fields);
  }

  filter(
    filter: QueryOptions<T>["filter"],
  ): QueryBuilder<T & Record<string, any>> {
    return new QueryBuilder<T & Record<string, any>>({
      definition: this.definition,
      databaseName: this.databaseName,
      context: this.context,
    }).filter(filter);
  }

  orderBy(
    orderBy: QueryOptions<T>["orderBy"],
  ): QueryBuilder<T & Record<string, any>> {
    return new QueryBuilder<T & Record<string, any>>({
      definition: this.definition,
      databaseName: this.databaseName,
      context: this.context,
    }).orderBy(orderBy as any);
  }

  top(count: number): QueryBuilder<T & Record<string, any>> {
    return new QueryBuilder<T & Record<string, any>>({
      definition: this.definition,
      databaseName: this.databaseName,
      context: this.context,
    }).top(count);
  }

  skip(count: number): QueryBuilder<T & Record<string, any>> {
    return new QueryBuilder<T & Record<string, any>>({
      definition: this.definition,
      databaseName: this.databaseName,
      context: this.context,
    }).skip(count);
  }

  expand(
    expand: QueryOptions<T>["expand"],
  ): QueryBuilder<T & Record<string, any>> {
    return new QueryBuilder<T & Record<string, any>>({
      definition: this.definition,
      databaseName: this.databaseName,
      context: this.context,
    }).expand(expand as any);
  }

  list(): QueryBuilder<T & Record<string, any>> {
    return new QueryBuilder<T & Record<string, any>>({
      definition: this.definition,
      databaseName: this.databaseName,
      context: this.context,
    });
  }

  get(id: string | number): RecordBuilder<T> {
    return new RecordBuilder<T>({
      definition: this.definition,
      databaseName: this.databaseName,
      context: this.context,
      recordId: id,
    });
  }
}
