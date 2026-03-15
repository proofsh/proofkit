/**
 * Testing utilities for fmodata.
 *
 * Provides MockFMServerConnection and helper functions for writing tests
 * without per-request fetchHandler overrides.
 *
 * @example
 * ```ts
 * import { MockFMServerConnection } from "@proofkit/fmodata/testing";
 *
 * const mock = new MockFMServerConnection();
 * mock.addRoute({
 *   urlPattern: "/testdb/contacts",
 *   response: { value: [{ id: "1", name: "Alice" }] },
 * });
 * const db = mock.database("testdb");
 * const result = await db.from(contacts).list().execute();
 * ```
 */

import type { Database } from "./client/database";
import { FMServerConnection } from "./client/filemaker-odata";

// --- MockRoute type ---

export interface MockRoute {
  /** URL pattern to match against. String matches with `includes()`, RegExp tests the full URL. */
  urlPattern: string | RegExp;
  /** HTTP method to match (case-insensitive). If omitted, matches any method. */
  method?: string;
  /** Response data. Arrays are wrapped in OData `{ value: [...] }` format. Objects are sent as-is. */
  response: unknown;
  /** HTTP status code (default: 200) */
  status?: number;
  /** Response headers */
  headers?: Record<string, string>;
  /** If set, the fetch handler rejects with this error (simulates network failure). */
  throwError?: Error;
}

// --- RequestSpy type ---

export interface RequestSpy {
  /** All recorded requests */
  readonly calls: ReadonlyArray<{ url: string; method: string; body?: string; headers?: Record<string, string> }>;
  /** Clear recorded calls */
  clear(): void;
  /** Get calls matching a URL pattern */
  forUrl(pattern: string | RegExp): ReadonlyArray<{ url: string; method: string; body?: string }>;
}

/**
 * Strips @id and @editLink fields from response data when Accept header requests no metadata.
 */
function stripODataAnnotations(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(stripODataAnnotations);
  }
  if (data && typeof data === "object") {
    const { "@id": _id, "@editLink": _editLink, ...rest } = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      result[key] = stripODataAnnotations(value);
    }
    return result;
  }
  return data;
}

/**
 * Creates a router-style fetch handler that matches requests against a list of MockRoutes.
 * The routes array is captured by reference, so routes added later are picked up automatically.
 */
function createRouterFetch(
  routes: MockRoute[],
  spy?: { calls: Array<{ url: string; method: string; body?: string; headers?: Record<string, string> }> },
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input.url;
    }
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");

    // Record the call if spy is active
    if (spy) {
      let body: string | undefined;
      if (typeof init?.body === "string") {
        body = init.body;
      } else if (input instanceof Request) {
        // ffetch wraps everything in a Request object, so body/headers may only be on `input`
        try {
          body = await input.clone().text();
          if (body === "") {
            body = undefined;
          }
        } catch {
          // body may not be readable
        }
      }

      const headers: Record<string, string> = {};
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((v, k) => {
            headers[k] = v;
          });
        } else if (!Array.isArray(init.headers)) {
          Object.assign(headers, init.headers);
        }
      } else if (input instanceof Request) {
        input.headers.forEach((v, k) => {
          headers[k] = v;
        });
      }
      spy.calls.push({ url, method, body, headers });
    }

    // Find matching route
    const route = routes.find((r) => {
      const urlMatch = typeof r.urlPattern === "string" ? url.includes(r.urlPattern) : r.urlPattern.test(url);
      const methodMatch = !r.method || r.method.toUpperCase() === method.toUpperCase();
      return urlMatch && methodMatch;
    });

    if (route?.throwError) {
      throw route.throwError;
    }

    if (!route) {
      return new Response(
        JSON.stringify({ error: { message: `No mock route for ${method} ${url}`, code: "MOCK_NOT_FOUND" } }),
        {
          status: 404,
          statusText: "Not Found (No Mock Route)",
          headers: { "content-type": "application/json" },
        },
      );
    }

    const status = route.status ?? 200;
    const contentType = route.headers?.["content-type"] ?? "application/json";
    const responseHeaders = new Headers({ "content-type": contentType });

    // Add custom headers
    if (route.headers) {
      for (const [key, value] of Object.entries(route.headers)) {
        if (key !== "content-type" && value) {
          responseHeaders.set(key, value);
        }
      }
    }

    // Handle 204 No Content
    if (status === 204) {
      return new Response(null, { status, statusText: "No Content", headers: responseHeaders });
    }

    // Determine if annotations should be stripped
    let acceptHeader = "";
    if (input instanceof Request) {
      acceptHeader = input.headers.get("Accept") ?? "";
    } else if (init?.headers) {
      if (init.headers instanceof Headers) {
        acceptHeader = init.headers.get("Accept") ?? "";
      } else if (!Array.isArray(init.headers)) {
        acceptHeader =
          (init.headers as Record<string, string>).Accept ?? (init.headers as Record<string, string>).accept ?? "";
      }
    }
    const shouldStripAnnotations = acceptHeader.includes("odata.metadata=none");

    // Build response body
    let responseData = route.response;
    if (Array.isArray(responseData)) {
      responseData = { value: responseData };
    }
    if (shouldStripAnnotations && responseData) {
      responseData = stripODataAnnotations(responseData);
    }

    let body: string | null;
    if (responseData === null || responseData === undefined) {
      body = null;
    } else if (typeof responseData === "string") {
      body = responseData;
    } else {
      body = JSON.stringify(responseData);
    }

    return new Response(body, {
      status,
      statusText: status >= 200 && status < 300 ? "OK" : "Error",
      headers: responseHeaders,
    });
  };
}

/**
 * A mock FMServerConnection for testing.
 *
 * Wraps a real FMServerConnection with a router-style fetch handler,
 * so the full HTTP parsing pipeline (error classification, OData handling, etc.)
 * is exercised in tests.
 *
 * Routes can be added at construction time or dynamically via `.addRoute()`.
 */
export class MockFMServerConnection {
  private readonly routes: MockRoute[];
  private readonly connection: FMServerConnection;
  private readonly _spy?: {
    calls: Array<{ url: string; method: string; body?: string; headers?: Record<string, string> }>;
  };

  constructor(config?: {
    routes?: MockRoute[];
    baseUrl?: string;
    enableSpy?: boolean;
  }) {
    this.routes = config?.routes ? [...config.routes] : [];
    this._spy = config?.enableSpy ? { calls: [] } : undefined;

    this.connection = new FMServerConnection({
      serverUrl: config?.baseUrl ?? "https://test.example.com",
      auth: { apiKey: "test-api-key" },
      fetchClientOptions: {
        retries: 0,
        fetchHandler: createRouterFetch(this.routes, this._spy),
      },
    });
  }

  /**
   * Add a route to the mock. Routes added after construction are picked up
   * automatically by subsequent requests.
   */
  addRoute(route: MockRoute): this {
    this.routes.push(route);
    return this;
  }

  /**
   * Set multiple routes, replacing any existing routes.
   */
  setRoutes(routes: MockRoute[]): this {
    this.routes.length = 0;
    this.routes.push(...routes);
    return this;
  }

  /**
   * Get the request spy (only available if `enableSpy: true` was passed to constructor).
   */
  get spy(): RequestSpy | undefined {
    if (!this._spy) {
      return undefined;
    }
    const spy = this._spy;
    return {
      get calls() {
        return spy.calls;
      },
      clear() {
        spy.calls.length = 0;
      },
      forUrl(pattern: string | RegExp) {
        return spy.calls.filter((c) => (typeof pattern === "string" ? c.url.includes(pattern) : pattern.test(c.url)));
      },
    };
  }

  /**
   * Create a Database instance, same API as FMServerConnection.database().
   */
  database<IncludeSpecialColumns extends boolean = false>(
    name: string,
    config?: {
      useEntityIds?: boolean;
      includeSpecialColumns?: IncludeSpecialColumns;
    },
  ): Database<IncludeSpecialColumns> {
    return this.connection.database(name, config);
  }

  /**
   * Get the underlying FMServerConnection (for cases that need the real type).
   */
  get asConnection(): FMServerConnection {
    return this.connection;
  }
}
