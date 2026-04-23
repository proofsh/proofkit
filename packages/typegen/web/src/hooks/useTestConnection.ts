import { useQuery } from "@tanstack/react-query";
import { useFormContext, useWatch } from "react-hook-form";
import { client } from "../lib/api";
import type { SingleConfig } from "../lib/config-utils";

export type TestConnectionStatus = "idle" | "pending" | "success" | "error";

// Track which config indices have dialogs open to pause background tests
const openDialogs = new Set<number>();

export function setDialogOpen(configIndex: number, isOpen: boolean) {
  if (isOpen) {
    openDialogs.add(configIndex);
  } else {
    openDialogs.delete(configIndex);
  }
}

export function isDialogOpen(configIndex: number): boolean {
  return openDialogs.has(configIndex);
}

export interface TestConnectionResult {
  ok: boolean;
  server?: string;
  db?: string;
  authType?: "apiKey" | "username" | "clarisId";
  error?: string;
  statusCode?: number;
  details?: {
    missing?: {
      server?: boolean;
      db?: boolean;
      auth?: boolean;
      password?: boolean;
      clarisIdPassword?: boolean;
    };
  };
  kind?: "missing_env" | "adapter_error" | "connection_error" | "unknown";
  suspectedField?: "server" | "db" | "auth";
  fmErrorCode?: string;
  message?: string;
}

export function useTestConnection(configIndex: number, options?: { enabled?: boolean }) {
  const { control } = useFormContext<{ config: SingleConfig[] }>();

  // Watch the config at the given index, specifically envNames to track changes
  const config = useWatch({
    control,
    name: `config.${configIndex}` as const,
  });

  const envNames = config?.envNames;

  // Create a stable key for envNames to use in queryKey
  const envNamesKey = envNames
    ? JSON.stringify({
        server: envNames.server,
        db: envNames.db,
        auth: envNames.auth,
      })
    : "";

  // Determine if query should be enabled
  // Default to true (run automatically) unless explicitly disabled or dialog is open
  const isEnabled = options?.enabled !== undefined ? options.enabled : !!config && !isDialogOpen(configIndex);

  const { data, error, isLoading, isError, refetch } = useQuery<TestConnectionResult>({
    queryKey: ["testConnection", configIndex, envNamesKey],
    queryFn: async () => {
      if (!config) {
        throw new Error("Config not found");
      }

      const res = await client.api["test-connection"].$post({
        json: { config },
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as TestConnectionResult;
        const error = new Error(errorData.error || errorData.message || "Test connection failed");
        // Attach detailed error information to the error object so it can be accessed later
        (error as Error & { details: TestConnectionResult }).details = errorData;
        throw error;
      }

      const result = await res.json();
      return result as TestConnectionResult;
    },
    enabled: isEnabled && !!config, // Run automatically when enabled and config is available
    retry: false,
    // Don't refetch on window focus to avoid unnecessary requests
    refetchOnWindowFocus: false,
  });

  // Determine status
  let connectionStatus: TestConnectionStatus = "idle";
  if (isLoading) {
    connectionStatus = "pending";
  } else if (isError) {
    connectionStatus = "error";
  } else if (data) {
    connectionStatus = data.ok ? "success" : "error";
  }

  // Extract error details from either the error object (when thrown) or from data (when ok: false)
  let errorDetails: TestConnectionResult | undefined;
  if (isError && error instanceof Error && (error as Error & { details: TestConnectionResult }).details) {
    errorDetails = (error as Error & { details: TestConnectionResult }).details;
  } else if (data && !data.ok) {
    errorDetails = data;
  }

  let connectionError: Error | undefined;
  if (isError) {
    connectionError = error instanceof Error ? error : new Error("Unknown error");
  } else if (data && !data.ok) {
    connectionError = new Error(data.message || data.error || "Test connection failed");
  }

  return {
    status: connectionStatus,
    data: data?.ok ? data : undefined,
    error: connectionError,
    errorDetails,
    run: () => {
      refetch();
    },
  };
}
