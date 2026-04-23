import type { Database } from "../../client/database";
import { FMServerConnection } from "../../client/filemaker-odata";

export const ENV_NAMES = {
  server: "FM_SERVER",
  db: "FM_DATABASE",
  username: "FM_USERNAME",
  password: "FM_PASSWORD",
  clarisIdUsername: "CLARIS_ID_USERNAME",
  clarisIdPassword: "CLARIS_ID_PASSWORD",
  apiKey: "OTTO_API_KEY",
} as const;

export interface ConnectionOptions {
  server?: string;
  database?: string;
  username?: string;
  password?: string;
  clarisIdUsername?: string;
  clarisIdPassword?: string;
  apiKey?: string;
}

export interface BuiltConnection {
  connection: FMServerConnection;
  db: Database;
}

export function buildConnection(opts: ConnectionOptions): BuiltConnection {
  const server = opts.server ?? process.env[ENV_NAMES.server];
  const database = opts.database ?? process.env[ENV_NAMES.db];
  const apiKey = opts.apiKey ?? process.env[ENV_NAMES.apiKey];
  const username = opts.username ?? process.env[ENV_NAMES.username];
  const password = opts.password ?? process.env[ENV_NAMES.password];
  const clarisIdUsername = opts.clarisIdUsername ?? process.env[ENV_NAMES.clarisIdUsername];
  const clarisIdPassword = opts.clarisIdPassword ?? process.env[ENV_NAMES.clarisIdPassword];

  if (!server) {
    throw new Error(`Missing required: --server or ${ENV_NAMES.server} environment variable`);
  }
  if (!database) {
    throw new Error(`Missing required: --database or ${ENV_NAMES.db} environment variable`);
  }
  if (!(apiKey || clarisIdUsername || username)) {
    throw new Error(
      `Missing required auth: --api-key (${ENV_NAMES.apiKey}), --claris-id-username (${ENV_NAMES.clarisIdUsername}), or --username (${ENV_NAMES.username})`,
    );
  }
  if (!apiKey && clarisIdUsername && !clarisIdPassword) {
    throw new Error(`Missing required: --claris-id-password (${ENV_NAMES.clarisIdPassword}) when using Claris ID auth`);
  }
  if (!apiKey && username && !password) {
    throw new Error(`Missing required: --password (${ENV_NAMES.password}) when using username auth`);
  }

  let auth:
    | { apiKey: string }
    | { clarisId: { username: string; password: string } }
    | { username: string; password: string };
  if (apiKey) {
    auth = { apiKey };
  } else if (clarisIdUsername) {
    auth = {
      clarisId: {
        username: clarisIdUsername as string,
        password: clarisIdPassword as string,
      },
    };
  } else {
    auth = { username: username as string, password: password as string };
  }
  const connection = new FMServerConnection({ serverUrl: server, auth });
  const db = connection.database(database);
  return { connection, db };
}
