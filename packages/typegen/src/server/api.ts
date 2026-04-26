import type { IncomingMessage } from "node:http";
import path from "node:path";
import type { URL } from "node:url";
import fs from "fs-extra";
import { parse } from "jsonc-parser";
import { typegenConfig } from "../types";

export interface ApiContext {
  cwd: string;
  configPath: string;
}

export interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export async function handleApiRequest(req: IncomingMessage, url: URL, context: ApiContext): Promise<ApiResponse> {
  const pathname = url.pathname.replace("/api", "");

  // GET /api/config
  if (pathname === "/config" && req.method === "GET") {
    return handleGetConfig(context);
  }

  // POST /api/config
  if (pathname === "/config" && req.method === "POST") {
    return await handlePostConfig(req, context);
  }

  return {
    status: 404,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: "Not found" }),
  };
}

function handleGetConfig(context: ApiContext): ApiResponse {
  const { configPath } = context;
  const fullPath = path.resolve(context.cwd, configPath);

  const exists = fs.existsSync(fullPath);

  if (!exists) {
    return {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exists: false,
        path: configPath,
        config: null,
      }),
    };
  }

  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    const parsed = parse(raw);

    return {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exists: true,
        path: configPath,
        config: parsed,
      }),
    };
  } catch (err) {
    return {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: err instanceof Error ? err.message : "Failed to read config",
      }),
    };
  }
}

async function handlePostConfig(req: IncomingMessage, context: ApiContext): Promise<ApiResponse> {
  try {
    const body = await readRequestBody(req);
    const data = JSON.parse(body);

    // Handle both { config: ... } and direct config object
    const configToValidate = data.config ?? data;

    // Validate with Zod
    const validation = typegenConfig.safeParse({ config: configToValidate });

    if (!validation.success) {
      const issues = validation.error.issues.map((err) => ({
        path: err.path,
        message: err.message,
      }));

      return {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: "Validation failed",
          issues,
        }),
      };
    }

    // Write to disk as pretty JSON (replacing JSONC)
    const fullPath = path.resolve(context.cwd, context.configPath);
    // Add $schema at the top of the config
    const configData = validation.data as Record<string, unknown>;
    const { $schema: _, ...rest } = configData;
    const configWithSchema = {
      $schema: "https://proofkit.proof.sh/typegen-config-schema.json",
      ...rest,
    };
    const jsonContent = `${JSON.stringify(configWithSchema, null, 2)}\n`;

    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, jsonContent, "utf8");

    return {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    return {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
    };
  }
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      resolve(body);
    });
    req.on("error", (err) => {
      reject(err);
    });
  });
}
