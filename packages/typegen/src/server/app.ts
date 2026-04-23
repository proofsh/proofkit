import path from "node:path";
import { zValidator } from "@hono/zod-validator";
import type { clientTypes } from "@proofkit/fmdapi";
import fs from "fs-extra";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { parse } from "jsonc-parser";
import z from "zod/v4";
import { generateTypedClients } from "../typegen";
import { typegenConfig, typegenConfigSingle, typegenConfigSingleForValidation } from "../types";
import { createClientFromConfig, createDataApiClient, createOdataClientFromConfig } from "./createDataApiClient";

export interface ApiContext {
  cwd: string;
  configPath: string;
}

/**
 * Flattens a nested layout/folder structure into a flat list with full paths
 */
function flattenLayouts(
  layouts: clientTypes.LayoutOrFolder[],
  parentPath = "",
): Array<{ name: string; path: string; table?: string }> {
  const result: Array<{ name: string; path: string; table?: string }> = [];

  for (const item of layouts) {
    if ("isFolder" in item && item.isFolder) {
      // It's a folder - recursively process its contents
      const folderPath = parentPath ? `${parentPath}/${item.name}` : item.name;
      if (item.folderLayoutNames) {
        result.push(...flattenLayouts(item.folderLayoutNames, folderPath));
      }
    } else {
      // It's a layout
      const layoutPath = parentPath ? `${parentPath}/${item.name}` : item.name;
      result.push({
        name: item.name,
        path: layoutPath,
        table: "table" in item ? item.table : undefined,
      });
    }
  }

  return result;
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }

  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : undefined;
}

export function createApiApp(context: ApiContext) {
  // Request-validation schema: add default `type` for backwards compatibility.
  // Important: we keep `typegenConfigSingleForValidation` as a pure discriminated union
  // so JSON Schema generation (apps/docs) remains unchanged.
  const typegenConfigSingleRequestForValidation = z.preprocess((data) => {
    if (data && typeof data === "object" && !("type" in data)) {
      return { ...(data as Record<string, unknown>), type: "fmdapi" };
    }
    return data;
  }, typegenConfigSingleForValidation);

  // Define all routes with proper chaining for type inference
  const app = new Hono()
    .basePath("/api")

    // GET /api/config
    .get("/config", (c) => {
      const { configPath, cwd } = context;
      const fullPath = path.resolve(cwd, configPath);

      const exists = fs.existsSync(fullPath);

      if (!exists) {
        return c.json({
          exists: false,
          path: configPath,
          fullPath,
          config: null,
          postGenerateCommand: undefined,
        });
      }

      try {
        const raw = fs.readFileSync(fullPath, "utf8");
        const rawJson = parse(raw);
        const parsed = typegenConfig.parse(rawJson);

        return c.json({
          exists: true,
          path: configPath,
          fullPath,
          config: parsed.config,
          postGenerateCommand: parsed.postGenerateCommand,
        });
      } catch (err) {
        console.log("error from get config", err);
        return c.json(
          {
            error: err instanceof Error ? err.message : "Failed to read config",
          },
          500,
        );
      }
    })
    // POST /api/config
    .post(
      "/config",
      zValidator(
        "json",
        z.object({
          config: z.array(typegenConfigSingleRequestForValidation),
          postGenerateCommand: z.string().optional(),
        }),
      ),
      async (c) => {
        try {
          const data = c.req.valid("json");
          console.log("[Server POST /config] Received data:", JSON.stringify(data, null, 2));

          // Transform validated data using runtime schema (applies transforms)
          const transformedData = {
            postGenerateCommand: data.postGenerateCommand,
            config: data.config.map((config) => {
              // Add default type if missing (backwards compatibility)
              const configWithType =
                "type" in config && config.type
                  ? config
                  : { ...(config as Record<string, unknown>), type: "fmdapi" as const };
              // Parse with runtime schema to apply transforms
              const parsed = typegenConfigSingle.parse(configWithType);
              console.log("[Server POST /config] After parse, config:", JSON.stringify(parsed, null, 2));
              return parsed;
            }),
          };
          console.log("[Server POST /config] Transformed data:", JSON.stringify(transformedData, null, 2));

          // Validate with Zod (data is already { config: [...], postGenerateCommand?: string })
          const validation = typegenConfig.safeParse(transformedData);

          if (!validation.success) {
            const issues = validation.error.issues.map((err) => ({
              path: err.path,
              message: err.message,
            }));

            const response = z
              .object({
                success: z.boolean(),
                error: z.string().optional(),
                issues: z
                  .array(
                    z.object({
                      path: z.array(z.union([z.string(), z.number()])),
                      message: z.string(),
                    }),
                  )
                  .optional(),
              })
              .parse({
                success: false,
                error: "Validation failed",
                issues,
              });
            return c.json(response, 400);
          }

          // Write to disk as pretty JSON (replacing JSONC)
          const fullPath = path.resolve(context.cwd, context.configPath);
          // Add $schema at the top of the config
          const configData = validation.data as Record<string, unknown>;
          console.log("[Server POST /config] Validation data to write:", JSON.stringify(configData, null, 2));
          const { $schema: _, ...rest } = configData;
          const configWithSchema = {
            $schema: "https://proofkit.dev/typegen-config-schema.json",
            ...rest,
          };
          const jsonContent = `${JSON.stringify(configWithSchema, null, 2)}\n`;
          console.log("[Server POST /config] Final JSON content:\n", jsonContent);

          await fs.ensureDir(path.dirname(fullPath));
          await fs.writeFile(fullPath, jsonContent, "utf8");

          const response = z
            .object({
              success: z.boolean(),
              error: z.string().optional(),
              issues: z
                .array(
                  z.object({
                    path: z.array(z.union([z.string(), z.number()])),
                    message: z.string(),
                  }),
                )
                .optional(),
            })
            .parse({ success: true });
          return c.json(response);
        } catch (err) {
          const response = z
            .object({
              success: z.boolean(),
              error: z.string().optional(),
              issues: z
                .array(
                  z.object({
                    path: z.array(z.union([z.string(), z.number()])),
                    message: z.string(),
                  }),
                )
                .optional(),
            })
            .parse({
              success: false,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          return c.json(response, 500);
        }
      },
    )
    // POST /api/run
    .post(
      "/run",
      zValidator(
        "json",
        z.object({
          config: z.union([z.array(typegenConfigSingleRequestForValidation), typegenConfigSingleRequestForValidation]),
          postGenerateCommand: z.string().optional(),
        }),
      ),
      async (c, next) => {
        const rawData = c.req.valid("json");
        // Transform validated data using runtime schema (applies transforms)
        const configArray = Array.isArray(rawData.config) ? rawData.config : [rawData.config];
        const transformedConfig = configArray.map((config) => {
          // Add default type if missing (backwards compatibility)
          const configWithType =
            "type" in config && config.type
              ? config
              : { ...(config as Record<string, unknown>), type: "fmdapi" as const };
          // Parse with runtime schema to apply transforms
          return typegenConfigSingle.parse(configWithType);
        });
        const config: z.infer<typeof typegenConfig>["config"] =
          transformedConfig.length === 1 && transformedConfig[0] ? transformedConfig[0] : transformedConfig;

        // Get postGenerateCommand from request or from config file
        let postGenerateCommand = rawData.postGenerateCommand;
        if (!postGenerateCommand) {
          // Try to read from config file
          try {
            const configPath = path.resolve(context.cwd, context.configPath);
            if (fs.existsSync(configPath)) {
              const raw = fs.readFileSync(configPath, "utf8");
              const rawJson = parse(raw);
              const parsed = typegenConfig.parse(rawJson);
              postGenerateCommand = parsed.postGenerateCommand;
            }
          } catch (_err) {
            // Ignore errors reading config
          }
        }

        // Generate typed clients (postGenerateCommand will be executed inside)
        await generateTypedClients(config, {
          cwd: context.cwd,
          postGenerateCommand,
        });

        await next();
      },
    )
    // GET /api/layouts
    .get("/layouts", zValidator("query", z.object({ configIndex: z.coerce.number() })), async (c) => {
      const input = c.req.valid("query");
      const configIndex = input.configIndex;

      const result = await createDataApiClient(context, configIndex);

      // Check if result is an error
      if ("error" in result) {
        const statusCode = result.statusCode;
        if (statusCode === 400) {
          return c.json(
            {
              error: result.error,
              ...(result.details || {}),
            },
            400,
          );
        }
        if (statusCode === 404) {
          return c.json(
            {
              error: result.error,
              ...(result.details || {}),
            },
            404,
          );
        }
        return c.json(
          {
            error: result.error,
            ...(result.details || {}),
          },
          500,
        );
      }

      const { client } = result;

      // Call layouts method - using type assertion as TypeScript has inference issues with DataApi return type
      // The layouts method exists but TypeScript can't infer it from the complex return type
      try {
        if (typeof client.layouts !== "function") {
          return c.json({ error: "Layouts method not found" }, 500);
        }
        const layoutsResp = (await client.layouts()) as {
          layouts: clientTypes.LayoutOrFolder[];
        };
        const { layouts } = layoutsResp;

        // Flatten the nested layout/folder structure into a flat list with full paths
        const flatLayouts = flattenLayouts(layouts);

        return c.json({ layouts: flatLayouts });
      } catch (err) {
        // Handle connection errors from layouts() call
        let errorMessage = "Failed to fetch layouts";
        let statusCode = 500;
        let suspectedField: "server" | "db" | "auth" | undefined;
        let fmErrorCode: string | undefined;

        const nextFmErrorCode = getErrorCode(err);
        if (nextFmErrorCode) {
          errorMessage = err instanceof Error ? err.message : errorMessage;
          fmErrorCode = nextFmErrorCode;

          // Infer suspected field from error code
          if (nextFmErrorCode === "105") {
            suspectedField = "db";
            errorMessage = `Database not found: ${err instanceof Error ? err.message : errorMessage}`;
          } else if (nextFmErrorCode === "212" || nextFmErrorCode === "952") {
            suspectedField = "auth";
            errorMessage = `Authentication failed: ${err instanceof Error ? err.message : errorMessage}`;
          }
          statusCode = 400;
        } else if (err instanceof TypeError) {
          errorMessage = `Connection error: ${err.message}`;
          suspectedField = "server";
          statusCode = 400;
        } else if (err instanceof Error) {
          errorMessage = err.message;
          statusCode = 500;
        }

        return c.json(
          {
            error: errorMessage,
            message: errorMessage,
            suspectedField,
            fmErrorCode,
          },
          statusCode as ContentfulStatusCode,
        );
      }
    })
    // GET /api/env-names
    .get("/env-names", zValidator("query", z.object({ envName: z.string() })), (c) => {
      const input = c.req.valid("query");

      const value = process.env[input.envName];

      return c.json({ value });
    })
    .get("/file-exists", zValidator("query", z.object({ path: z.string() })), async (c) => {
      const input = c.req.valid("query");
      const path = input.path;
      const exists = await fs.pathExists(path);
      return c.json({ exists });
    })
    .post(
      "/table-metadata",
      zValidator(
        "json",
        z.object({
          config: typegenConfigSingleRequestForValidation,
          tableName: z.string(),
        }),
      ),
      async (c) => {
        const rawInput = c.req.valid("json");
        // Transform validated data using runtime schema (applies transforms)
        const configWithType =
          "type" in rawInput.config && rawInput.config.type
            ? rawInput.config
            : { ...(rawInput.config as Record<string, unknown>), type: "fmdapi" as const };
        const config = typegenConfigSingle.parse(configWithType);
        const tableName = rawInput.tableName;
        if (config.type !== "fmodata") {
          return c.json({ error: "Invalid config type" }, 400);
        }
        const tableConfig = config.tables.find((t) => t.tableName === tableName);
        try {
          const { downloadTableMetadata, parseMetadata } = await import("../fmodata");
          // Download metadata for the specified table
          const tableMetadataXml = await downloadTableMetadata({
            config,
            tableName,
            reduceAnnotations: tableConfig?.reduceMetadata ?? false,
          });
          // Parse the metadata
          const parsedMetadata = await parseMetadata(tableMetadataXml);
          // Convert Maps to objects for JSON serialization
          // Also convert nested Maps (like Properties) to objects
          const serializedMetadata = {
            entityTypes: Object.fromEntries(
              Array.from(parsedMetadata.entityTypes.entries()).map(([key, value]) => [
                key,
                {
                  ...value,
                  Properties: Object.fromEntries(value.Properties),
                },
              ]),
            ),
            entitySets: Object.fromEntries(parsedMetadata.entitySets),
            namespace: parsedMetadata.namespace,
          };
          return c.json({ parsedMetadata: serializedMetadata });
        } catch (err) {
          return c.json(
            {
              error: err instanceof Error ? err.message : "Failed to fetch metadata",
            },
            500,
          );
        }
      },
    )
    .post(
      "/list-tables",
      zValidator("json", z.object({ config: typegenConfigSingleRequestForValidation })),
      async (c) => {
        const rawInput = c.req.valid("json");
        const configWithType =
          "type" in rawInput.config && rawInput.config.type
            ? rawInput.config
            : { ...(rawInput.config as Record<string, unknown>), type: "fmdapi" as const };
        const config = typegenConfigSingle.parse(configWithType);
        if (config.type !== "fmodata") {
          return c.json({ error: "Invalid config type" }, 400);
        }
        try {
          const result = await createOdataClientFromConfig(config);
          if ("error" in result) {
            return c.json(
              {
                error: result.error,
                kind: result.kind,
                suspectedField: result.suspectedField,
              },
              result.statusCode as ContentfulStatusCode,
            );
          }
          const { db } = result;
          const tableNames = await db.listTableNames();
          return c.json({ tables: tableNames });
        } catch (err) {
          return c.json(
            {
              error: err instanceof Error ? err.message : "Failed to list tables",
            },
            500,
          );
        }
      },
    )
    // POST /api/test-connection
    .post(
      "/test-connection",
      zValidator("json", z.object({ config: typegenConfigSingleRequestForValidation })),
      async (c) => {
        try {
          const rawData = c.req.valid("json");
          // Transform validated data using runtime schema (applies transforms)
          const configWithType =
            "type" in rawData.config && rawData.config.type
              ? rawData.config
              : { ...(rawData.config as Record<string, unknown>), type: "fmdapi" as const };
          const config = typegenConfigSingle.parse(configWithType);

          // Validate config type
          if (config.type === "fmdapi") {
            // Create client from config
            const clientResult = await createClientFromConfig(config);

            // Check if client creation failed
            if ("error" in clientResult) {
              return c.json(
                {
                  ok: false,
                  ...clientResult,
                },
                clientResult.statusCode as ContentfulStatusCode,
              );
            }

            const { client, server, db, authType } = clientResult;

            // Test connection by calling layouts()
            try {
              if (typeof client.layouts !== "function") {
                return c.json(
                  {
                    ok: false,
                    error: "Layouts method not found",
                    statusCode: 500,
                    kind: "adapter_error",
                    message: "Layouts method not found",
                  },
                  500,
                );
              }
              await client.layouts();

              return c.json({
                ok: true,
                server,
                db,
                authType,
              });
            } catch (err) {
              // Handle connection errors
              let errorMessage = "Failed to connect to FileMaker Data API";
              let statusCode = 500;
              let kind: "connection_error" | "unknown" = "unknown";
              let suspectedField: "server" | "db" | "auth" | undefined;
              let fmErrorCode: string | undefined;

              const nextFmErrorCode = getErrorCode(err);
              if (nextFmErrorCode) {
                errorMessage = err instanceof Error ? err.message : errorMessage;
                fmErrorCode = nextFmErrorCode;
                kind = "connection_error";

                // Infer suspected field from error code
                // Common FileMaker error codes:
                // 105 = Database not found
                // 212 = Authentication failed
                // 802 = Record not found (less relevant here)
                if (nextFmErrorCode === "105") {
                  suspectedField = "db";
                  errorMessage = `Database not found: ${err instanceof Error ? err.message : errorMessage}`;
                } else if (nextFmErrorCode === "212" || nextFmErrorCode === "952") {
                  suspectedField = "auth";
                  errorMessage = `Authentication failed: ${err instanceof Error ? err.message : errorMessage}`;
                }
                statusCode = 400;
              } else if (err instanceof TypeError) {
                // Network/URL errors
                errorMessage = `Connection error: ${err.message}`;
                suspectedField = "server";
                kind = "connection_error";
                statusCode = 400;
              } else if (err instanceof Error) {
                errorMessage = err.message;
                kind = "connection_error";
                statusCode = 500;
              }

              return c.json(
                {
                  ok: false,
                  error: errorMessage,
                  statusCode,
                  kind,
                  suspectedField,
                  fmErrorCode,
                  message: errorMessage,
                },
                statusCode as ContentfulStatusCode,
              );
            }
          } else if (config.type === "fmodata") {
            const result = await createOdataClientFromConfig(config);
            if ("error" in result) {
              return c.json(
                {
                  ok: false,
                  ...result,
                },
                result.statusCode as ContentfulStatusCode,
              );
            }

            const { db, connection, server, dbName, authType } = result;

            if (authType === "username" || authType === "clarisId") {
              // Test connection by calling listDatabaseNames() and listTableNames() separately
              // First test: listDatabaseNames() - tests server connection
              try {
                await connection.listDatabaseNames();
              } catch (err) {
                // Handle connection errors from listDatabaseNames()
                let errorMessage = "Failed to connect to FileMaker OData API (listDatabaseNames failed)";
                let statusCode = 500;
                let kind: "connection_error" | "unknown" = "unknown";
                let suspectedField: "server" | "db" | "auth" | undefined;

                if (err instanceof Error) {
                  errorMessage = `listDatabaseNames() failed: ${err.message}`;
                  kind = "connection_error";

                  // Infer suspected field from error message
                  const lowerMessage = errorMessage.toLowerCase();
                  if (
                    lowerMessage.includes("database") ||
                    lowerMessage.includes("not found") ||
                    lowerMessage.includes("404")
                  ) {
                    suspectedField = "db";
                  } else if (
                    lowerMessage.includes("auth") ||
                    lowerMessage.includes("unauthorized") ||
                    lowerMessage.includes("401") ||
                    lowerMessage.includes("403")
                  ) {
                    suspectedField = "auth";
                  } else if (
                    lowerMessage.includes("network") ||
                    lowerMessage.includes("connection") ||
                    lowerMessage.includes("timeout") ||
                    lowerMessage.includes("dns")
                  ) {
                    suspectedField = "server";
                  }

                  // Network/URL errors typically indicate server issues
                  if (err instanceof TypeError) {
                    suspectedField = "server";
                    statusCode = 400;
                  } else {
                    statusCode = 400;
                  }
                }

                return c.json(
                  {
                    ok: false,
                    error: errorMessage,
                    statusCode,
                    kind,
                    suspectedField,
                    message: errorMessage,
                    failedMethod: "listDatabaseNames",
                  },
                  statusCode as ContentfulStatusCode,
                );
              }
            }

            // Second test: listTableNames() - tests database connection
            try {
              await db.listTableNames();

              return c.json({
                ok: true,
                server,
                db: dbName,
                authType,
              });
            } catch (err) {
              // Handle connection errors from listTableNames()
              let errorMessage = "Failed to connect to FileMaker OData API (listTableNames failed)";
              let statusCode = 500;
              let kind: "connection_error" | "unknown" = "unknown";
              let suspectedField: "server" | "db" | "auth" | undefined;

              if (err instanceof Error) {
                errorMessage = `listTableNames() failed: ${err.message}`;
                kind = "connection_error";

                // Infer suspected field from error message
                const lowerMessage = errorMessage.toLowerCase();
                if (
                  lowerMessage.includes("database") ||
                  lowerMessage.includes("not found") ||
                  lowerMessage.includes("404")
                ) {
                  suspectedField = "db";
                } else if (
                  lowerMessage.includes("auth") ||
                  lowerMessage.includes("unauthorized") ||
                  lowerMessage.includes("401") ||
                  lowerMessage.includes("403")
                ) {
                  suspectedField = "auth";
                } else if (
                  lowerMessage.includes("network") ||
                  lowerMessage.includes("connection") ||
                  lowerMessage.includes("timeout") ||
                  lowerMessage.includes("dns")
                ) {
                  suspectedField = "server";
                }

                // Network/URL errors typically indicate server issues
                if (err instanceof TypeError) {
                  suspectedField = "server";
                  statusCode = 400;
                } else {
                  statusCode = 400;
                }
              }

              return c.json(
                {
                  ok: false,
                  error: errorMessage,
                  statusCode,
                  kind,
                  suspectedField,
                  message: errorMessage,
                  failedMethod: "listTableNames",
                },
                statusCode as ContentfulStatusCode,
              );
            }
          } else {
            return c.json(
              {
                ok: false,
                error: "Invalid config type",
              },
              400,
            );
          }
        } catch (err) {
          return c.json(
            {
              ok: false,
              error: err instanceof Error ? err.message : "Unknown error",
              statusCode: 500,
              kind: "unknown",
              message: err instanceof Error ? err.message : "Unknown error",
            },
            500,
          );
        }
      },
    );

  return app;
}

// Export the app type for use in the typed client
// With proper chaining, TypeScript can now infer all route types
export type ApiApp = ReturnType<typeof createApiApp>;
