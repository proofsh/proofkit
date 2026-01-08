/**
 * Self-Healing Fetch Handler for E2E Tests
 *
 * Wraps the native fetch function to automatically detect 502 Bad Gateway
 * errors and restart the OData service via OttoFMS API.
 *
 * Only activates when process.env.CI === 'true' to avoid unexpected
 * behavior in local development.
 */

import { restartODataService, sleep } from "./ottofms-service";

export interface SelfHealingFetchOptions {
  /** Server URL for the OttoFMS restart API */
  serverUrl: string;
  /** OttoFMS API key (dk_xxx format) for authentication */
  apiKey: string;
  /** Maximum number of restart+retry attempts per request. Default: 3 */
  maxRetries?: number;
  /** Milliseconds to wait after restart for service to come up. Default: 10000 (10s) */
  restartDelayMs?: number;
  /** Minimum milliseconds between restart attempts (global cooldown). Default: 30000 (30s) */
  minCooldownMs?: number;
  /** Override for testing - if false, disables healing even in CI. Default: process.env.CI === 'true' */
  enabled?: boolean;
  /** Optional callback when a restart is triggered */
  onRestart?: (attemptNumber: number) => void;
}

/** Track last restart time globally to implement cooldown between restarts */
let lastRestartTime = 0;

/** Track total restarts in this process to prevent runaway loops */
let totalRestartsInProcess = 0;
const MAX_TOTAL_RESTARTS = 5;

/**
 * Creates a self-healing fetch function that automatically restarts
 * the OData service on 502 errors and retries the request.
 *
 * @param options - Configuration options
 * @returns A fetch-compatible function with self-healing behavior
 */
export function createSelfHealingFetch(options: SelfHealingFetchOptions): typeof fetch {
  const {
    serverUrl,
    apiKey,
    maxRetries = 3,
    restartDelayMs = 10_000,
    minCooldownMs = 30_000,
    enabled = process.env.CI === "true",
    onRestart,
  } = options;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let lastResponse: Response | undefined;
    let attempts = 0;

    while (attempts <= maxRetries) {
      // Make the request
      const response = await fetch(input, init);

      // If not a 502 error, return immediately
      if (response.status !== 502) {
        return response;
      }

      lastResponse = response;

      // 502 detected - check if we should attempt healing
      if (!enabled) {
        console.log("[Self-Healing] 502 detected but healing is disabled (not in CI mode)");
        return response;
      }

      // Check global restart limit
      if (totalRestartsInProcess >= MAX_TOTAL_RESTARTS) {
        console.error(
          `[Self-Healing] Maximum total restarts (${MAX_TOTAL_RESTARTS}) reached in this process. Failing request.`,
        );
        return response;
      }

      // Check per-request retry limit
      if (attempts >= maxRetries) {
        console.error(`[Self-Healing] Maximum retries (${maxRetries}) reached for this request. Failing.`);
        return response;
      }

      // Check cooldown period
      const now = Date.now();
      const timeSinceLastRestart = now - lastRestartTime;
      if (lastRestartTime > 0 && timeSinceLastRestart < minCooldownMs) {
        const waitTime = minCooldownMs - timeSinceLastRestart;
        console.log(`[Self-Healing] In cooldown period. Waiting ${waitTime}ms before restart...`);
        await sleep(waitTime);
      }

      attempts++;
      console.log(`[Self-Healing] 502 Bad Gateway detected. Attempting restart ${attempts}/${maxRetries}...`);

      // Call the restart callback if provided
      onRestart?.(attempts);

      // Attempt to restart the OData service
      const result = await restartODataService(serverUrl, apiKey);

      if (!result.success) {
        console.error(`[Self-Healing] Failed to restart service: ${result.message}`);
        // Continue to retry even if restart failed - maybe it worked anyway
      }

      // Update tracking
      lastRestartTime = Date.now();
      totalRestartsInProcess++;

      // Wait for service to come back up
      console.log(`[Self-Healing] Waiting ${restartDelayMs}ms for service to restart...`);
      await sleep(restartDelayMs);

      console.log("[Self-Healing] Retrying request...");
      // Loop will retry the request
    }

    // This should never be reached due to the logic above
    // (we always return either successful response or 502 response in the loop)
    // If somehow we get here, return the last response or throw an error
    if (lastResponse) {
      return lastResponse;
    }
    throw new Error("[Self-Healing] Unexpected state: no response available");
  };
}

/**
 * Creates a self-healing fetch handler configured for CI environments.
 *
 * Uses environment variables:
 * - FMODATA_SERVER_URL or FM_SERVER for server URL
 * - OTTO_API_KEY for OttoFMS authentication
 * - CI to enable/disable healing
 *
 * @returns A self-healing fetch function, or undefined if not in CI or missing config
 */
export function createCIAwareFetchHandler(): typeof fetch | undefined {
  const isCI = process.env.CI === "true";

  if (!isCI) {
    return undefined;
  }

  const serverUrl = process.env.FMODATA_SERVER_URL ?? process.env.FM_SERVER;
  const apiKey = process.env.OTTO_API_KEY;

  if (!serverUrl) {
    console.warn("[Self-Healing] CI mode detected but FMODATA_SERVER_URL/FM_SERVER not set. Self-healing disabled.");
    return undefined;
  }

  if (!apiKey) {
    console.warn("[Self-Healing] CI mode detected but OTTO_API_KEY not set. Self-healing disabled.");
    return undefined;
  }

  console.log("[Self-Healing] CI mode active - self-healing fetch enabled");

  return createSelfHealingFetch({
    serverUrl,
    apiKey,
    enabled: true,
  });
}

/**
 * Resets the global state for testing purposes.
 * DO NOT use in production code.
 */
export function _resetSelfHealingState(): void {
  lastRestartTime = 0;
  totalRestartsInProcess = 0;
}
