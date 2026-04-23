import {
  CognitoAccessToken,
  CognitoIdToken,
  CognitoRefreshToken,
  CognitoUser,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClarisIdAuthManager } from "../src/client/claris-id";
import { FMServerConnection } from "../src/client/filemaker-odata";

const USER_POOL_CONFIG_RE = /user pool config/i;
const MFA_UNSUPPORTED_RE = /MFA is not supported/i;

function makeJwt(expOffsetSeconds: number) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + expOffsetSeconds,
    iat: Math.floor(Date.now() / 1000) - 60,
  })}.sig`;
}

function makeSession(expOffsetSeconds: number) {
  return new CognitoUserSession({
    AccessToken: new CognitoAccessToken({ AccessToken: makeJwt(expOffsetSeconds) }),
    IdToken: new CognitoIdToken({ IdToken: makeJwt(expOffsetSeconds) }),
    RefreshToken: new CognitoRefreshToken({ RefreshToken: "refresh-token" }),
  });
}

const validSession = makeSession(3600);
const expiredSession = makeSession(-3600);

describe("ClarisIdAuthManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: {
                UserPool_ID: "us-west-2_NqkuZcXQY",
                Client_ID: "4l9rvl4mv5es1eep1qe97cautn",
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns FMID header on successful auth", async () => {
    vi.spyOn(CognitoUser.prototype, "authenticateUser").mockImplementation((_details, callbacks: any) => {
      callbacks.onSuccess(validSession);
    });

    const manager = new ClarisIdAuthManager({ username: "user", password: "pass" });
    await expect(manager.getAuthorizationHeader()).resolves.toBe(`FMID ${validSession.getIdToken().getJwtToken()}`);
  });

  it("reuses cached valid token across sequential calls", async () => {
    const authenticateSpy = vi
      .spyOn(CognitoUser.prototype, "authenticateUser")
      .mockImplementation((_details, callbacks: any) => {
        callbacks.onSuccess(validSession);
      });

    const manager = new ClarisIdAuthManager({ username: "user", password: "pass" });
    await manager.getAuthorizationHeader();
    await manager.getAuthorizationHeader();

    expect(authenticateSpy).toHaveBeenCalledTimes(1);
  });

  it("dedupes parallel auth calls", async () => {
    const authenticateSpy = vi
      .spyOn(CognitoUser.prototype, "authenticateUser")
      .mockImplementation((_details, callbacks: any) => {
        setTimeout(() => callbacks.onSuccess(validSession), 0);
      });

    const manager = new ClarisIdAuthManager({ username: "user", password: "pass" });
    await Promise.all([manager.getAuthorizationHeader(), manager.getAuthorizationHeader()]);

    expect(authenticateSpy).toHaveBeenCalledTimes(1);
  });

  it("refreshes an expired token", async () => {
    const authenticateSpy = vi
      .spyOn(CognitoUser.prototype, "authenticateUser")
      .mockImplementation((_details, callbacks: any) => {
        callbacks.onSuccess(expiredSession);
      });
    const refreshSpy = vi.spyOn(CognitoUser.prototype, "refreshSession").mockImplementation((_token, callback: any) => {
      callback(null, validSession);
    });

    const manager = new ClarisIdAuthManager({ username: "user", password: "pass" });
    await manager.getAuthorizationHeader();
    await expect(manager.getAuthorizationHeader()).resolves.toBe(`FMID ${validSession.getIdToken().getJwtToken()}`);

    expect(authenticateSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to full re-auth when refresh fails", async () => {
    const authenticateSpy = vi
      .spyOn(CognitoUser.prototype, "authenticateUser")
      .mockImplementationOnce((_details, callbacks: any) => {
        callbacks.onSuccess(expiredSession);
      })
      .mockImplementationOnce((_details, callbacks: any) => {
        callbacks.onSuccess(validSession);
      });
    vi.spyOn(CognitoUser.prototype, "refreshSession").mockImplementation((_token, callback: any) => {
      callback(new Error("refresh failed"));
    });

    const manager = new ClarisIdAuthManager({ username: "user", password: "pass" });
    await manager.getAuthorizationHeader();
    await expect(manager.getAuthorizationHeader()).resolves.toBe(`FMID ${validSession.getIdToken().getJwtToken()}`);

    expect(authenticateSpy).toHaveBeenCalledTimes(2);
  });

  it("throws when user pool config fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500, headers: { "content-type": "text/plain" } })),
    );

    vi.spyOn(CognitoUser.prototype, "authenticateUser").mockImplementation((_details, callbacks: any) => {
      callbacks.onSuccess(validSession);
    });

    const manager = new ClarisIdAuthManager({ username: "user", password: "pass" });
    await expect(manager.getAuthorizationHeader()).rejects.toThrow(USER_POOL_CONFIG_RE);
  });

  it("throws clear error for MFA challenge", async () => {
    vi.spyOn(CognitoUser.prototype, "authenticateUser").mockImplementation((_details, callbacks: any) => {
      callbacks.mfaRequired?.();
    });

    const manager = new ClarisIdAuthManager({ username: "user", password: "pass" });
    await expect(manager.getAuthorizationHeader()).rejects.toThrow(MFA_UNSUPPORTED_RE);
  });
});

describe("FMServerConnection Claris ID integration", () => {
  it("sends FMID authorization header", async () => {
    vi.spyOn(ClarisIdAuthManager.prototype, "getAuthorizationHeader").mockResolvedValue("FMID test-token");

    let authorizationHeader = "";
    const fetchHandler: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      authorizationHeader = request.headers.get("authorization") ?? "";

      return Promise.resolve(
        new Response(JSON.stringify({ value: [{ name: "contacts" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    };

    const connection = new FMServerConnection({
      serverUrl: "https://example.com",
      auth: { clarisId: { username: "user", password: "pass" } },
      fetchClientOptions: { fetchHandler },
    });

    await connection.database("TestDB").listTableNames();
    expect(authorizationHeader).toBe("FMID test-token");
  });
});
