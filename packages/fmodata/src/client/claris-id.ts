/// <reference path="./amazon-cognito-identity-js.d.ts" />

import type { CognitoUserSession } from "amazon-cognito-identity-js";
import { AuthenticationDetails, CognitoUser, CognitoUserPool } from "amazon-cognito-identity-js";

const CLARIS_USER_POOL_URL = "https://www.ifmcloud.com/endpoint/userpool/2.2.0.my.claris.com.json";
const UNSUPPORTED_MFA_ERROR =
  "Claris ID MFA is not supported by @proofkit/fmodata yet. Use a non-MFA Claris ID account for now.";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface UserPoolConfigResponse {
  data?: {
    UserPool_ID?: string;
    Client_ID?: string;
  };
}

export class ClarisIdAuthManager {
  private readonly username: string;
  private readonly password: string;
  private authenticationDetails: AuthenticationDetails | undefined;
  private userPool: CognitoUserPool | null = null;
  private cognitoUser: CognitoUser | null = null;
  private userSession: CognitoUserSession | null = null;
  private idTokenPromise: Promise<string> | null = null;

  constructor(config: { username: string; password: string }) {
    this.username = config.username;
    this.password = config.password;
  }

  async getAuthorizationHeader(fetchLike?: FetchLike): Promise<string> {
    if (!this.idTokenPromise) {
      this.idTokenPromise = this.getIdToken(fetchLike).finally(() => {
        this.idTokenPromise = null;
      });
    }

    return `FMID ${await this.idTokenPromise}`;
  }

  private getAuthenticationDetails(): AuthenticationDetails {
    if (!this.authenticationDetails) {
      this.authenticationDetails = new AuthenticationDetails({
        Username: this.username,
        Password: this.password,
      });
    }

    return this.authenticationDetails;
  }

  private async getIdToken(fetchLike?: FetchLike): Promise<string> {
    if (this.userSession) {
      return this.getStoredIdToken(this.userSession);
    }

    const userSession = await this.retrieveNewSession(fetchLike);
    return userSession.getIdToken().getJwtToken();
  }

  private async getStoredIdToken(userSession: CognitoUserSession): Promise<string> {
    const currentUserSession = userSession.isValid() ? userSession : await this.refreshSession(userSession);
    return currentUserSession.getIdToken().getJwtToken();
  }

  private async refreshSession(userSession: CognitoUserSession): Promise<CognitoUserSession> {
    const cognitoUser = await this.getCognitoUser();

    this.userSession = await new Promise<CognitoUserSession>((resolve, reject) => {
      cognitoUser.refreshSession(
        userSession.getRefreshToken(),
        async (error: unknown, session: CognitoUserSession | null) => {
          if (error || !session) {
            try {
              resolve(await this.retrieveNewSession());
              return;
            } catch (reauthError) {
              reject(reauthError);
              return;
            }
          }

          resolve(session);
        },
      );
    });

    return this.userSession;
  }

  private async retrieveNewSession(fetchLike?: FetchLike): Promise<CognitoUserSession> {
    const cognitoUser = await this.getCognitoUser(fetchLike);
    const authenticationDetails = this.getAuthenticationDetails();

    this.userSession = await new Promise<CognitoUserSession>((resolve, reject) => {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result: CognitoUserSession) => {
          resolve(result);
        },
        onFailure: (error: unknown) => {
          reject(error);
        },
        mfaRequired: () => reject(new Error(UNSUPPORTED_MFA_ERROR)),
        totpRequired: () => reject(new Error(UNSUPPORTED_MFA_ERROR)),
        selectMFAType: () => reject(new Error(UNSUPPORTED_MFA_ERROR)),
        mfaSetup: () => reject(new Error(UNSUPPORTED_MFA_ERROR)),
      });
    });

    return this.userSession;
  }

  private async getCognitoUser(fetchLike?: FetchLike): Promise<CognitoUser> {
    if (this.cognitoUser) {
      return this.cognitoUser;
    }

    this.cognitoUser = new CognitoUser({
      Username: this.getAuthenticationDetails().getUsername(),
      Pool: await this.getUserPool(fetchLike),
    });

    return this.cognitoUser;
  }

  private async getUserPool(fetchLike?: FetchLike): Promise<CognitoUserPool> {
    if (this.userPool) {
      return this.userPool;
    }

    const response = await (fetchLike ?? fetch)(CLARIS_USER_POOL_URL);
    if (!response.ok) {
      throw new Error("Could not fetch Claris ID user pool config");
    }

    const config = (await response.json()) as UserPoolConfigResponse;
    const userPoolId = config.data?.UserPool_ID;
    const clientId = config.data?.Client_ID;

    if (!(userPoolId && clientId)) {
      throw new Error("Invalid Claris ID user pool config response");
    }

    this.userPool = new CognitoUserPool({
      UserPoolId: userPoolId,
      ClientId: clientId,
    });

    return this.userPool;
  }
}
