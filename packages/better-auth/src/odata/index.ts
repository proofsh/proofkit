/** biome-ignore-all lint/suspicious/noExplicitAny: library code */
import { logger as betterAuthLogger } from "better-auth";
import { err, ok, type Result } from "neverthrow";
import type { z } from "zod/v4";

interface BasicAuthCredentials {
  username: string;
  password: string;
}
interface OttoAPIKeyAuth {
  apiKey: string;
}
type ODataAuth = BasicAuthCredentials | OttoAPIKeyAuth;

export interface FmOdataConfig {
  serverUrl: string;
  auth: ODataAuth;
  database: string;
  logging?: true | "verbose" | "none";
  /** Custom fetch handler for self-healing in CI environments */
  fetchHandler?: typeof fetch;
}

export function validateUrl(input: string): Result<URL, unknown> {
  try {
    const url = new URL(input);
    return ok(url);
  } catch (error) {
    return err(error);
  }
}

export function createRawFetch(args: FmOdataConfig) {
  const result = validateUrl(args.serverUrl);

  if (result.isErr()) {
    throw new Error("Invalid server URL");
  }

  let baseURL = result.value.origin;
  if ("apiKey" in args.auth) {
    baseURL += "/otto";
  }
  baseURL += `/fmi/odata/v4/${args.database}`;

  // Create authentication headers
  const authHeaders: Record<string, string> = {};
  if ("apiKey" in args.auth) {
    authHeaders.Authorization = `Bearer ${args.auth.apiKey}`;
  } else {
    const credentials = btoa(`${args.auth.username}:${args.auth.password}`);
    authHeaders.Authorization = `Basic ${credentials}`;
  }

  // Enhanced fetch function with body handling, validation, and structured responses
  const wrappedFetch = async <TOutput = any>(
    input: string | URL | Request,
    options?: Omit<RequestInit, "body"> & {
      body?: any; // Allow any type for body
      output?: z.ZodSchema<TOutput>; // Optional schema for validation
    },
  ): Promise<{ data?: TOutput; error?: string; response?: Response }> => {
    try {
      let url: string;

      // Handle different input types
      if (typeof input === "string") {
        // If it's already a full URL, use as-is, otherwise prepend baseURL
        url = input.startsWith("http") ? input : `${baseURL}${input.startsWith("/") ? input : `/${input}`}`;
      } else if (input instanceof URL) {
        url = input.toString();
      } else if (input instanceof Request) {
        url = input.url;
      } else {
        url = String(input);
      }

      // Handle body serialization
      let processedBody = options?.body;
      if (
        processedBody &&
        typeof processedBody === "object" &&
        !(processedBody instanceof FormData) &&
        !(processedBody instanceof URLSearchParams) &&
        !(processedBody instanceof ReadableStream)
      ) {
        processedBody = JSON.stringify(processedBody);
      }

      // Merge headers
      const headers = {
        "Content-Type": "application/json",
        ...authHeaders,
        ...(options?.headers || {}),
      };

      const requestInit: RequestInit = {
        ...options,
        headers,
        body: processedBody,
      };

      // Optional logging
      if (args.logging === "verbose" || args.logging === true) {
        betterAuthLogger.info("raw-fetch", `${requestInit.method || "GET"} ${url}`);
        if (requestInit.body) {
          betterAuthLogger.info("raw-fetch", "Request body:", requestInit.body);
        }
      }

      const response = await (args.fetchHandler ?? fetch)(url, requestInit);

      // Optional logging for response details
      if (args.logging === "verbose" || args.logging === true) {
        betterAuthLogger.info("raw-fetch", `Response status: ${response.status} ${response.statusText}`);
        betterAuthLogger.info("raw-fetch", "Response headers:", Object.fromEntries(response.headers.entries()));
      }

      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        if (args.logging === "verbose" || args.logging === true) {
          betterAuthLogger.error("raw-fetch", `HTTP Error ${response.status}: ${errorText}`);
        }
        return {
          error: `HTTP ${response.status}: ${errorText}`,
          response,
        };
      }

      // Parse response based on content type
      let responseData: any;
      const contentType = response.headers.get("content-type");

      if (args.logging === "verbose" || args.logging === true) {
        betterAuthLogger.info("raw-fetch", `Response content-type: ${contentType || "none"}`);
      }

      if (contentType?.includes("application/json")) {
        try {
          const responseText = await response.text();
          if (args.logging === "verbose" || args.logging === true) {
            betterAuthLogger.info("raw-fetch", `Raw response text: "${responseText}"`);
            betterAuthLogger.info("raw-fetch", `Response text length: ${responseText.length}`);
          }

          // Handle empty responses
          if (responseText.trim() === "") {
            if (args.logging === "verbose" || args.logging === true) {
              betterAuthLogger.info("raw-fetch", "Empty JSON response, returning null");
            }
            responseData = null;
          } else {
            responseData = JSON.parse(responseText);
            if (args.logging === "verbose" || args.logging === true) {
              betterAuthLogger.info("raw-fetch", "Successfully parsed JSON response");
            }
          }
        } catch (parseError) {
          if (args.logging === "verbose" || args.logging === true) {
            betterAuthLogger.error("raw-fetch", "JSON parse error:", parseError);
          }
          return {
            error: `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : "Unknown parse error"}`,
            response,
          };
        }
      } else if (contentType?.includes("text/")) {
        // Handle text responses (text/plain, text/html, etc.)
        responseData = await response.text();
        if (args.logging === "verbose" || args.logging === true) {
          betterAuthLogger.info("raw-fetch", `Text response: "${responseData}"`);
        }
      } else {
        // For other content types, try to get text but don't fail if it's binary
        try {
          responseData = await response.text();
          if (args.logging === "verbose" || args.logging === true) {
            betterAuthLogger.info("raw-fetch", `Unknown content-type response as text: "${responseData}"`);
          }
        } catch {
          // If text parsing fails (e.g., binary data), return null
          responseData = null;
          if (args.logging === "verbose" || args.logging === true) {
            betterAuthLogger.info("raw-fetch", "Could not parse response as text, returning null");
          }
        }
      }

      // Validate output if schema provided
      if (options?.output) {
        const validation = options.output.safeParse(responseData);
        if (validation.success) {
          return {
            data: validation.data,
            response,
          };
        }
        return {
          error: `Validation failed: ${validation.error.message}`,
          response,
        };
      }

      // Return unvalidated data
      return {
        data: responseData as TOutput,
        response,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  };

  return {
    baseURL,
    fetch: wrappedFetch,
  };
}
