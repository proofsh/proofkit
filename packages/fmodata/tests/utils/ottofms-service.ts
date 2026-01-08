/**
 * OttoFMS Service Control
 *
 * Provides utilities to restart FileMaker services via the OttoFMS API.
 * Used by the self-healing fetch mechanism to recover from 502 errors in CI.
 */

interface RestartResult {
  success: boolean;
  message?: string;
}

interface OttoFMSResponse {
  response: {
    ok: boolean;
  };
  messages: Array<{
    code: number;
    text: string;
  }>;
}

/**
 * Restarts the OData service via OttoFMS API.
 *
 * @param serverUrl - The FileMaker server URL (e.g., https://myserver.com)
 * @param apiKey - OttoFMS API key (dk_xxx format)
 * @returns Promise<RestartResult> - Success status and optional message
 */
export async function restartODataService(serverUrl: string, apiKey: string): Promise<RestartResult> {
  const url = `${serverUrl}/otto/api/fms-process`;

  console.log(`[Self-Healing] Attempting to restart OData service at ${serverUrl}...`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command: "restart",
        service: "odata",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[Self-Healing] Failed to restart OData service: HTTP ${response.status} - ${errorText}`);
      return {
        success: false,
        message: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const data = (await response.json()) as OttoFMSResponse;

    if (data.response?.ok === true) {
      console.log("[Self-Healing] OData service restart initiated successfully");
      return {
        success: true,
        message: "OData service restart initiated",
      };
    }

    const errorMessage = data.messages?.[0]?.text ?? "Unknown OttoFMS error";
    console.error(`[Self-Healing] OttoFMS returned error: ${errorMessage}`);
    return {
      success: false,
      message: errorMessage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Self-Healing] Network error restarting OData service: ${errorMessage}`);
    return {
      success: false,
      message: errorMessage,
    };
  }
}

/**
 * Utility function to wait for a specified duration.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
