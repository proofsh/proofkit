declare module "amazon-cognito-identity-js" {
  export class CognitoRefreshToken {
    constructor(data: { RefreshToken: string });
  }

  export class CognitoAccessToken {
    constructor(data: { AccessToken: string });
    getJwtToken(): string;
  }

  export class CognitoIdToken {
    constructor(data: { IdToken: string });
    getJwtToken(): string;
  }

  export class CognitoUserSession {
    constructor(data: {
      AccessToken: CognitoAccessToken;
      IdToken: CognitoIdToken;
      RefreshToken: CognitoRefreshToken;
    });
    isValid(): boolean;
    getIdToken(): CognitoIdToken;
    getAccessToken(): CognitoAccessToken;
    getRefreshToken(): CognitoRefreshToken;
  }

  export class AuthenticationDetails {
    constructor(data: { Username: string; Password: string });
    getUsername(): string;
  }

  export class CognitoUserPool {
    constructor(data: { UserPoolId: string; ClientId: string });
  }

  export class CognitoUser {
    constructor(data: { Username: string; Pool: CognitoUserPool });
    authenticateUser(
      details: AuthenticationDetails,
      callbacks: {
        onSuccess: (session: CognitoUserSession) => void;
        onFailure: (error: unknown) => void;
        mfaRequired?: (...args: unknown[]) => void;
        totpRequired?: (...args: unknown[]) => void;
        selectMFAType?: (...args: unknown[]) => void;
        mfaSetup?: (...args: unknown[]) => void;
      },
    ): void;
    refreshSession(
      refreshToken: CognitoRefreshToken,
      callback: (error: unknown, session: CognitoUserSession | null) => void,
    ): void;
  }
}
