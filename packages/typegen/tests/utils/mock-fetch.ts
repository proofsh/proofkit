/**
 * Mock Fetch Utility for Typegen Tests
 *
 * This utility creates mock fetch functions for testing typegen without
 * connecting to a real FileMaker server. It intercepts requests to the
 * FileMaker Data API and returns pre-configured responses.
 *
 * Usage:
 * ```ts
 * import { vi } from 'vitest';
 * import { createLayoutMetadataMock } from '../utils/mock-fetch';
 * import { mockLayoutMetadata } from '../fixtures/layout-metadata';
 *
 * // Mock a single layout's metadata
 * vi.stubGlobal('fetch', createLayoutMetadataMock({
 *   layout: mockLayoutMetadata['basic-layout'],
 * }));
 *
 * // Mock multiple layouts
 * vi.stubGlobal('fetch', createLayoutMetadataMock({
 *   layout: mockLayoutMetadata['layout'],
 *   customer_fieldsMissing: mockLayoutMetadata['customer_fieldsMissing'],
 * }));
 * ```
 */

import type { LayoutMetadata, MockLayoutMetadataKey } from "../fixtures/layout-metadata";

// Move regex to top level for performance
const LAYOUT_URL_PATTERN = /\/layouts\/([^/?]+)(?:\?|$)/;
const SESSIONS_URL_PATTERN = /\/sessions$/;
const CALL_SCRIPT_URL_PATTERN = /\/callScript$/;

/**
 * Extract URL string from various input types
 */
function getUrlString(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

/**
 * Creates a mock fetch function that returns layout metadata responses
 * based on the layout name in the request URL.
 *
 * @param layouts - Map of layout names to their metadata responses
 * @returns A fetch-compatible function
 */
export function createLayoutMetadataMock(layouts: Record<string, LayoutMetadata>): typeof fetch {
  return (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const url = getUrlString(input);

    // Handle FmHttpAdapter requests to /callScript
    if (CALL_SCRIPT_URL_PATTERN.test(url)) {
      const body = _init?.body ? JSON.parse(String(_init.body)) : {};
      const scriptData = body?.data ? JSON.parse(String(body.data)) : {};
      const layoutName = scriptData.layouts;
      const action = scriptData.action;

      if (action === "metaData" && layoutName && layouts[layoutName]) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                messages: [{ code: "0", message: "OK" }],
                response: layouts[layoutName],
              },
            }),
            {
              status: 200,
              statusText: "OK",
              headers: { "content-type": "application/json" },
            },
          ),
        );
      }

      if (action === "metaData" && layoutName && !layouts[layoutName]) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                messages: [{ code: "105", message: "Layout is missing" }],
                response: {},
              },
            }),
            {
              status: 200,
              statusText: "OK",
              headers: { "content-type": "application/json" },
            },
          ),
        );
      }
    }

    // Handle FetchAdapter session/token requests
    // FetchAdapter expects token in X-FM-Data-Access-Token header
    if (SESSIONS_URL_PATTERN.test(url)) {
      const tokenResponse = {
        messages: [{ code: "0", message: "OK" }],
        response: {},
      };

      return Promise.resolve(
        new Response(JSON.stringify(tokenResponse), {
          status: 200,
          statusText: "OK",
          headers: {
            "content-type": "application/json",
            "X-FM-Data-Access-Token": "mock-session-token-12345",
          },
        }),
      );
    }

    // Extract layout name from URL pattern: /layouts/{layoutName}
    const layoutMatch = url.match(LAYOUT_URL_PATTERN);
    const layoutName = layoutMatch?.[1] ? decodeURIComponent(layoutMatch[1]) : null;

    // Check if this is a layout metadata request (no /records, /_find, etc.)
    const isLayoutMetadataRequest = layoutMatch && !url.includes("/records") && !url.includes("/_find");

    if (isLayoutMetadataRequest && layoutName && layouts[layoutName]) {
      const response = {
        messages: [{ code: "0", message: "OK" }],
        response: layouts[layoutName],
      };

      return Promise.resolve(
        new Response(JSON.stringify(response), {
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
        }),
      );
    }

    // For layout not found
    if (isLayoutMetadataRequest && layoutName && !layouts[layoutName]) {
      const response = {
        messages: [{ code: "105", message: "Layout is missing" }],
        response: {},
      };

      return Promise.resolve(
        new Response(JSON.stringify(response), {
          status: 500,
          statusText: "Error",
          headers: { "content-type": "application/json" },
        }),
      );
    }

    // Default: return 404 for unknown requests
    return Promise.resolve(
      new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        statusText: "Not Found",
        headers: { "content-type": "application/json" },
      }),
    );
  };
}

/**
 * Creates a mock fetch function using predefined fixture keys
 *
 * @param layoutMap - Map of layout names to fixture keys
 * @param fixtures - The mockLayoutMetadata object
 * @returns A fetch-compatible function
 */
export function createLayoutMetadataMockFromFixtures(
  layoutMap: Record<string, MockLayoutMetadataKey>,
  fixtures: Record<MockLayoutMetadataKey, LayoutMetadata>,
): typeof fetch {
  const layouts: Record<string, LayoutMetadata> = {};
  for (const [layoutName, fixtureKey] of Object.entries(layoutMap)) {
    const fixture = fixtures[fixtureKey];
    if (fixture) {
      layouts[layoutName] = fixture;
    }
  }
  return createLayoutMetadataMock(layouts);
}

/**
 * Creates a mock fetch that returns a sequence of responses
 * Useful for tests that call layoutMetadata multiple times
 *
 * @param responses - Array of layout metadata responses in order
 * @returns A fetch-compatible function
 */
export function createLayoutMetadataSequenceMock(responses: LayoutMetadata[]): typeof fetch {
  let callIndex = 0;

  return (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const metadata = responses[callIndex];
    if (!metadata) {
      throw new Error(
        `Mock fetch called more times than expected. Call #${callIndex + 1}, but only ${responses.length} responses provided.`,
      );
    }
    callIndex++;

    const response = {
      messages: [{ code: "0", message: "OK" }],
      response: metadata,
    };

    return Promise.resolve(
      new Response(JSON.stringify(response), {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
      }),
    );
  };
}
