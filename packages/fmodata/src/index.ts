import { z } from "zod/v4";
import createClient, { FFetchOptions } from "@fetchkit/ffetch";
import buildQuery, { QueryOptions } from "odata-query";

// Internal symbol for secure method access
const REQUEST_METHOD = Symbol("makeRequest");

type Auth = { username: string; password: string } | { apiKey: string };

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
      throwOnHttpError: true,
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

  async [REQUEST_METHOD](url: string, options?: RequestInit): Promise<any> {
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
    return resp.json();
  }

  database(name: string) {
    return new Database(name, this, REQUEST_METHOD);
  }
}

class Database {
  constructor(
    private readonly name: string,
    private readonly client: FileMakerOData,
    private readonly requestSymbol: typeof REQUEST_METHOD,
  ) {}

  table<Schema extends z.ZodObject>(name: string, config?: { schema: Schema }) {
    return new Table<z.infer<Schema>>(
      this.name,
      name,
      this.client,
      this.requestSymbol,
    );
  }

  // Example method showing how to use the request method
  async getMetadata() {
    return this.client[this.requestSymbol](`/${this.name}/$metadata`);
  }
}
type WithSystemFields<T> = T & { ROWID: number; ROWMODID: number };

class QueryBuilder<
  T extends Record<string, any>,
  Selected extends keyof T = keyof T,
  IsSingle extends boolean = false,
  IsCount extends boolean = false,
> {
  private queryOptions: Partial<QueryOptions<WithSystemFields<T>>> = {};
  private isSingleMode = false as IsSingle;
  private isCountMode = false as IsCount;

  constructor(
    private readonly databaseName: string,
    private readonly tableName: string,
    private readonly client: FileMakerOData,
    private readonly requestSymbol: typeof REQUEST_METHOD,
  ) {}

  select<K extends keyof WithSystemFields<T>>(
    ...fields: K[]
  ): QueryBuilder<T, K, IsSingle, IsCount> {
    const newBuilder = new QueryBuilder<T, K, IsSingle, IsCount>(
      this.databaseName,
      this.tableName,
      this.client,
      this.requestSymbol,
    );
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
    const newBuilder = new QueryBuilder<T, Selected, true, IsCount>(
      this.databaseName,
      this.tableName,
      this.client,
      this.requestSymbol,
    );
    newBuilder.queryOptions = { ...this.queryOptions };
    newBuilder.isSingleMode = true;
    newBuilder.isCountMode = this.isCountMode;
    return newBuilder;
  }

  count(): QueryBuilder<T, Selected, IsSingle, true> {
    const newBuilder = new QueryBuilder<T, Selected, IsSingle, true>(
      this.databaseName,
      this.tableName,
      this.client,
      this.requestSymbol,
    );
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

    // Handle $count endpoint
    if (this.isCountMode) {
      const result = await this.client[this.requestSymbol](
        `/${this.databaseName}/${this.tableName}/$count${queryString}`,
      );
      return result as any;
    }

    const result = await this.client[this.requestSymbol](
      `/${this.databaseName}/${this.tableName}${queryString}`,
    );

    if (this.isSingleMode) {
      return (result.value?.[0] ?? null) as any;
    }

    return result as any;
  }

  toString(): string {
    return buildQuery(this.queryOptions);
  }
}

class Table<T extends Record<string, any>> {
  constructor(
    private readonly databaseName: string,
    private readonly name: string,
    private readonly client: FileMakerOData,
    private readonly requestSymbol: typeof REQUEST_METHOD,
  ) {}

  query(): QueryBuilder<T> {
    return new QueryBuilder<T>(
      this.databaseName,
      this.name,
      this.client,
      this.requestSymbol,
    );
  }

  async list() {
    return this.client[this.requestSymbol](
      `/${this.databaseName}/${this.name}`,
    );
  }

  async get(id: string | number, options?: { getSingleField?: keyof T }) {
    let baseUrl = `/${this.databaseName}/${this.name}('${id}')`;
    if (options?.getSingleField) {
      baseUrl += `/${options.getSingleField.toString()}`;
    }
    return this.client[this.requestSymbol](baseUrl);
  }
}
