import type { z } from "zod/v4";
import { getEnvValues, validateEnvValues } from "../getEnvValues";
import type { typegenConfigSingle } from "../types";

type FmodataConfig = Extract<z.infer<typeof typegenConfigSingle>, { type: "fmodata" }>;

/**
 * Downloads OData metadata for a single table from a FileMaker server.
 *
 * @param params - Object containing function parameters
 * @param params.config - The fmodata config object containing connection details
 * @param params.tableName - The name of the table to download metadata for
 * @returns Promise that resolves with the XML metadata string
 */
export async function downloadTableMetadata({
  config,
  tableName,
  reduceAnnotations = false,
}: {
  config: FmodataConfig;
  tableName: string;
  reduceAnnotations?: boolean;
}): Promise<string> {
  const envValues = getEnvValues(config.envNames);
  const validationResult = validateEnvValues(envValues, config.envNames, { allowClarisId: true });

  if (!validationResult.success) {
    throw new Error(validationResult.errorMessage);
  }

  if (validationResult.mode === "fmMcp") {
    throw new Error("FM MCP mode is not supported for OData metadata download");
  }

  const { server, db, auth } = validationResult;
  const { FMServerConnection } = await import("@proofkit/fmodata");

  // Create connection based on authentication method
  const connection = new FMServerConnection({
    serverUrl: server,
    auth,
    fetchClientOptions: {
      timeout: 15_000, // 15 seconds
      retries: 2,
    },
  });

  const database = connection.database(db);

  // Download metadata for the specific table in XML format
  const tableMetadata = await database.getMetadata({
    tableName,
    format: "xml",
    reduceAnnotations,
  });

  return tableMetadata;
}
