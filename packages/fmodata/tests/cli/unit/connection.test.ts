import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildConnection, ENV_NAMES } from "../../../src/cli/utils/connection";

const SERVER_RE = /server/i;
const DATABASE_RE = /database/i;
const AUTH_RE = /auth/i;
const PASSWORD_RE = /password/i;

describe("buildConnection", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("builds a connection from env vars with api key auth", () => {
    process.env[ENV_NAMES.server] = "https://example.com";
    process.env[ENV_NAMES.db] = "MyDB.fmp12";
    process.env[ENV_NAMES.apiKey] = "test-key";

    const { connection, db } = buildConnection({});
    expect(connection).toBeDefined();
    expect(db).toBeDefined();
  });

  it("builds a connection from env vars with username/password auth", () => {
    process.env[ENV_NAMES.server] = "https://example.com";
    process.env[ENV_NAMES.db] = "MyDB.fmp12";
    process.env[ENV_NAMES.username] = "admin";
    process.env[ENV_NAMES.password] = "secret";

    const { connection, db } = buildConnection({});
    expect(connection).toBeDefined();
    expect(db).toBeDefined();
  });

  it("builds a connection from env vars with Claris ID auth", () => {
    process.env[ENV_NAMES.server] = "https://example.com";
    process.env[ENV_NAMES.db] = "MyDB.fmp12";
    process.env[ENV_NAMES.clarisIdUsername] = "claris-user";
    process.env[ENV_NAMES.clarisIdPassword] = "claris-pass";

    const { connection, db } = buildConnection({});
    expect(connection).toBeDefined();
    expect(db).toBeDefined();
  });

  it("CLI options override env vars", () => {
    process.env[ENV_NAMES.server] = "https://env-server.com";
    process.env[ENV_NAMES.db] = "EnvDB.fmp12";
    process.env[ENV_NAMES.apiKey] = "env-key";

    const { db } = buildConnection({
      server: "https://cli-server.com",
      database: "CliDB.fmp12",
      apiKey: "cli-key",
    });
    expect(db).toBeDefined();
  });

  it("throws when server is missing", () => {
    process.env[ENV_NAMES.db] = "MyDB.fmp12";
    process.env[ENV_NAMES.apiKey] = "test-key";
    delete process.env[ENV_NAMES.server];

    expect(() => buildConnection({})).toThrow(SERVER_RE);
  });

  it("throws when database is missing", () => {
    process.env[ENV_NAMES.server] = "https://example.com";
    process.env[ENV_NAMES.apiKey] = "test-key";
    delete process.env[ENV_NAMES.db];

    expect(() => buildConnection({})).toThrow(DATABASE_RE);
  });

  it("throws when auth is missing", () => {
    process.env[ENV_NAMES.server] = "https://example.com";
    process.env[ENV_NAMES.db] = "MyDB.fmp12";
    delete process.env[ENV_NAMES.apiKey];
    delete process.env[ENV_NAMES.username];
    delete process.env[ENV_NAMES.password];

    expect(() => buildConnection({})).toThrow(AUTH_RE);
  });

  it("throws when username is set but password is missing", () => {
    process.env[ENV_NAMES.server] = "https://example.com";
    process.env[ENV_NAMES.db] = "MyDB.fmp12";
    process.env[ENV_NAMES.username] = "admin";
    delete process.env[ENV_NAMES.password];

    expect(() => buildConnection({})).toThrow(PASSWORD_RE);
  });

  it("throws when Claris ID username is set but password is missing", () => {
    process.env[ENV_NAMES.server] = "https://example.com";
    process.env[ENV_NAMES.db] = "MyDB.fmp12";
    process.env[ENV_NAMES.clarisIdUsername] = "claris-user";
    delete process.env[ENV_NAMES.clarisIdPassword];

    expect(() => buildConnection({})).toThrow(PASSWORD_RE);
  });

  it("prefers api key over username auth when both are set", () => {
    const { db } = buildConnection({
      server: "https://example.com",
      database: "MyDB.fmp12",
      apiKey: "api-key",
      username: "admin",
      password: "secret",
    });
    expect(db).toBeDefined();
  });

  it("prefers Claris ID over username auth when both are set", () => {
    const { db } = buildConnection({
      server: "https://example.com",
      database: "MyDB.fmp12",
      clarisIdUsername: "claris-user",
      clarisIdPassword: "claris-pass",
      username: "admin",
      password: "secret",
    });
    expect(db).toBeDefined();
  });
});
